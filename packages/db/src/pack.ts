import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type DataPack, PackError } from "schema";
import { parsePack } from "schema/pack";

/**
 * Reads a data pack folder from disk and validates it with the shared parser. Throws `PackError`
 * before anything is written to a database; nothing partial comes back.
 */
export function loadPack(dir: string): DataPack {
  const manifestPath = join(dir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new PackError(`no manifest.json in ${dir}`, {
      file: "manifest.json",
    });
  }
  return parsePack(readFileSync(manifestPath, "utf8"), (name) => {
    const path = join(dir, name);
    return existsSync(path) ? readFileSync(path, "utf8") : undefined;
  });
}
