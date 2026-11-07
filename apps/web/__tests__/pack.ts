import { fileURLToPath } from "node:url";
import type { DataPack } from "schema";
import { loadPack } from "../lib/data";

/**
 * The bootstrap fixture pack for the web unit tests (CLAUDE.md section 6: unit tests run on files
 * in fixtures/, never on the network). Parsed once per test file through the app's own loader.
 */
const PACK_DIR = fileURLToPath(
  new URL("../../../fixtures/bootstrap/", import.meta.url),
);

let cached: DataPack | undefined;

export function bootstrapPack(): DataPack {
  cached ??= loadPack(PACK_DIR);
  return cached;
}
