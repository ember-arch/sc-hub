/**
 * The media store behind the CDN (ADR-034): Vercel Blob, through the `@vercel/blob` SDK, behind a
 * small interface so `publish-sync.ts` can be tested against an in-memory store with no network
 * (CLAUDE.md section 6). The store is connected to the Vercel project; its read-write token is in
 * the owner's `.env.local` and nowhere else.
 */
import { del, list, put } from "@vercel/blob";

export interface StoredObject {
  /** The pathname in the store, `media/...`. */
  readonly key: string;
  readonly size: number;
  /** The public address the CDN serves it from. */
  readonly url: string;
}

export interface PutOptions {
  readonly contentType: string;
  /** Seconds for the CDN and browsers; Blob composes the Cache-Control header from it. */
  readonly cacheMaxAge: number;
  /** Whether an object already at the key may be replaced; the store refuses otherwise. */
  readonly overwrite: boolean;
}

export interface MediaStore {
  /** Every object under `prefix`, by key. */
  list(prefix: string): Promise<Map<string, StoredObject>>;
  put(
    key: string,
    body: Uint8Array,
    options: PutOptions,
  ): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  /** The current bytes at `key`, or null when there is none. */
  read(key: string): Promise<Uint8Array | null>;
}

/** `https://x.public.blob.vercel-storage.com/media/a.webp` + `media/a.webp` → the store's base. */
export function storeBaseUrl(url: string, key: string): string {
  const suffix = `/${key}`;
  if (!url.endsWith(suffix)) {
    throw new Error(`${url} does not end with ${suffix}`);
  }
  return url.slice(0, -suffix.length);
}

/** A read-write token, or the OIDC pair `vercel env pull` writes (the token itself is sensitive). */
export type BlobAuth =
  | { readonly token: string }
  | { readonly oidcToken: string; readonly storeId: string };

export function vercelBlobStore(
  auth: BlobAuth,
  fetchImpl: typeof fetch = fetch,
): MediaStore {
  const credentials =
    "token" in auth
      ? { token: auth.token }
      : { oidcToken: auth.oidcToken, storeId: auth.storeId };
  return {
    async list(prefix) {
      const out = new Map<string, StoredObject>();
      let cursor: string | undefined;
      do {
        const page = await list({
          ...credentials,
          prefix,
          limit: 1000,
          ...(cursor === undefined ? {} : { cursor }),
        });
        for (const blob of page.blobs) {
          out.set(blob.pathname, {
            key: blob.pathname,
            size: blob.size,
            url: blob.url,
          });
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor !== undefined);
      return out;
    },
    async put(key, body, options) {
      const result = await put(key, Buffer.from(body), {
        ...credentials,
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: options.overwrite,
        contentType: options.contentType,
        cacheControlMaxAge: options.cacheMaxAge,
      });
      return { key: result.pathname, size: body.byteLength, url: result.url };
    },
    async delete(key) {
      await del(key, credentials);
    },
    async read(key) {
      const held = await list({ ...credentials, prefix: key, limit: 1 });
      const blob = held.blobs.find((b) => b.pathname === key);
      if (blob === undefined) return null;
      const response = await fetchImpl(blob.url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`${blob.url} answered ${response.status}`);
      }
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}
