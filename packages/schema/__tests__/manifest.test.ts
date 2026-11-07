import { describe, expect, it } from "vitest";
import { Manifest, ManifestFile } from "../manifest.js";
import { loadFixture } from "./helpers.js";

// The manifest is the index of a data pack. The bootstrap pack test (scripts/__tests__) checks
// the real manifest in fixtures/bootstrap; this file proves the shape on a synthetic one.

describe("Manifest", () => {
  const fixture = loadFixture("Manifest");
  const file = (fixture["files"] as Record<string, unknown>[])[0] ?? {};

  it("accepts the synthetic manifest and round-trips it through JSON", () => {
    const parsed = Manifest.parse(fixture);
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(fixture);
  });

  it("rejects an unknown field on the manifest and on a file entry", () => {
    expect(Manifest.safeParse({ ...fixture, extra: 1 }).success).toBe(false);
    expect(ManifestFile.safeParse({ ...file, extra: 1 }).success).toBe(false);
  });

  it("only knows schema_version 1", () => {
    expect(Manifest.safeParse({ ...fixture, schema_version: 2 }).success).toBe(
      false,
    );
  });

  it("requires at least one file", () => {
    expect(Manifest.safeParse({ ...fixture, files: [] }).success).toBe(false);
  });

  it("only lists files for known entities", () => {
    expect(
      ManifestFile.safeParse({ ...file, entity: "Spaceship" }).success,
    ).toBe(false);
  });

  it.each(["sha256:0000", "a".repeat(64).toUpperCase(), "abc"])(
    "rejects a checksum that is not 64 lowercase hex characters: %s",
    (sha256) => {
      expect(ManifestFile.safeParse({ ...file, sha256 }).success).toBe(false);
    },
  );

  it("rejects negative byte and row counts", () => {
    expect(ManifestFile.safeParse({ ...file, bytes: -1 }).success).toBe(false);
    expect(ManifestFile.safeParse({ ...file, count: -1 }).success).toBe(false);
    expect(ManifestFile.safeParse({ ...file, count: 1.5 }).success).toBe(false);
  });

  it("accepts an http(s) source url and rejects anything else", () => {
    expect(
      Manifest.safeParse({ ...fixture, source_url: "https://api.example.test" })
        .success,
    ).toBe(true);
    expect(
      Manifest.safeParse({ ...fixture, source_url: "ftp://api.example.test" })
        .success,
    ).toBe(false);
  });
});
