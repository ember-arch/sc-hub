import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PackError } from "schema";
import { describe, expect, it } from "vitest";
import { loadPack } from "../src/pack.js";
import { BOOTSTRAP_PACK } from "./helpers.js";

describe("loadPack", () => {
  it("loads the bootstrap pack and its counts match the manifest", () => {
    const pack = loadPack(BOOTSTRAP_PACK);
    expect(pack.manifest.source).toBe("wiki-bootstrap");
    for (const file of pack.manifest.files) {
      expect(pack.rows[file.entity]).toHaveLength(file.count);
    }
    expect(pack.rows.Vehicle).toHaveLength(6);
    expect(pack.rows.GameVersion).toHaveLength(1);
  });

  it("refuses a folder without a manifest", () => {
    const dir = mkdtempSync(join(tmpdir(), "sc-hub-pack-"));
    try {
      expect(() => loadPack(dir)).toThrow(PackError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
