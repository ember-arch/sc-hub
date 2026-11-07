import { readFileSync } from "node:fs";

/** Reads a synthetic fixture object from ./fixtures/<name>.json. No network, ever. */
export function loadFixture(name: string): Record<string, unknown> {
  const url = new URL(`./fixtures/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as Record<string, unknown>;
}
