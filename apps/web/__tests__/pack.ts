import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DataPack } from "schema";
import { parsePack } from "schema/pack";

/**
 * The bootstrap fixture pack for the web unit tests (CLAUDE.md section 6: unit tests run on files
 * in fixtures/, never on the network). Parsed once per test file through the shared validator.
 */
const PACK_DIR = fileURLToPath(
  new URL("../../../fixtures/bootstrap/", import.meta.url),
);

let cached: DataPack | undefined;

export function bootstrapPack(): DataPack {
  cached ??= parsePack(
    readFileSync(join(PACK_DIR, "manifest.json"), "utf8"),
    (name) => {
      const path = join(PACK_DIR, name);
      return existsSync(path) ? readFileSync(path, "utf8") : undefined;
    },
  );
  return cached;
}
