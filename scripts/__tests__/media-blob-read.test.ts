import type * as VercelBlob from "@vercel/blob";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ADR-048: the store adapter's read takes the strong ETag from the store's API and the bytes from
// the public URL (the edge), and gives them back only when the two agree; otherwise it waits for
// the edge's purge. The SDK is replaced, so nothing here reaches the network.

const sdk = vi.hoisted(() => ({
  head: vi.fn(),
  get: vi.fn(),
}));
vi.mock("@vercel/blob", async (importOriginal) => ({
  ...(await importOriginal<typeof VercelBlob>()),
  head: sdk.head,
  get: sdk.get,
}));

const { BlobNotFoundError } = await import("@vercel/blob");
const { READ_ATTEMPTS, vercelBlobStore } = await import("../media/blob.js");

const answer = (text: string, etag: string) => ({
  statusCode: 200,
  stream: new Response(text).body,
  headers: new Headers(),
  blob: { etag },
});

describe("reading the manifest from the store", () => {
  const waits: number[] = [];
  const store = vercelBlobStore({ token: "test" }, async (ms) => {
    waits.push(ms);
  });
  beforeEach(() => {
    sdk.head.mockReset();
    sdk.get.mockReset();
    waits.length = 0;
  });

  it("gives the bytes with the store's strong ETag when the edge's copy is the same", async () => {
    sdk.head.mockResolvedValue({ etag: '"new"' });
    sdk.get.mockResolvedValue(answer("{}", 'W/"new"'));
    const read = await store.read("media/manifest.json");
    expect(read?.etag).toBe('"new"');
    expect(new TextDecoder().decode(read!.bytes)).toBe("{}");
    expect(waits).toEqual([]);
    expect(sdk.get.mock.calls[0]![1]).toMatchObject({ access: "public" });
  });

  it("waits while the edge still serves an older copy, then reads the new one", async () => {
    sdk.head.mockResolvedValue({ etag: '"new"' });
    sdk.get
      .mockResolvedValueOnce(answer("old", 'W/"old"'))
      .mockResolvedValueOnce(answer("old", 'W/"old"'))
      .mockResolvedValueOnce(answer("new", 'W/"new"'));
    const read = await store.read("media/manifest.json");
    expect(new TextDecoder().decode(read!.bytes)).toBe("new");
    expect(waits.length).toBe(2);
  });

  it("gives up, naming the CDN, when the edge never catches up", async () => {
    sdk.head.mockResolvedValue({ etag: '"new"' });
    sdk.get.mockImplementation(async () => answer("old", 'W/"old"'));
    await expect(store.read("media/manifest.json")).rejects.toThrow(
      /CDN still served an older copy/,
    );
    expect(sdk.get).toHaveBeenCalledTimes(READ_ATTEMPTS);
  });

  it("answers null when there is no manifest", async () => {
    sdk.head.mockRejectedValue(new BlobNotFoundError());
    expect(await store.read("media/manifest.json")).toBeNull();
  });
});
