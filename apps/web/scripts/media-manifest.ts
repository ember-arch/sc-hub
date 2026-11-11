// Fetches the media manifest from the CDN before dev and build (ADR-034), so a deploy, which has
// no `public/media/`, still knows which pictures and models exist and where. Three cases:
//
//   - `public/media/manifest.json` exists: a local build; it wins and nothing is fetched.
//   - `CDN_BASE_URL` is unset: no pictures; the pages render without them (ADR-009).
//   - otherwise `${CDN_BASE_URL}/media/manifest.json` is fetched, validated against the schema and
//     written to `generated/media-manifest.json` (git-ignored), which `lib/media.ts` reads.
//
// A fetch that fails or a manifest that does not validate fails the build: a deploy configured for
// pictures and silently published without them is a broken deploy, and Vercel keeps the previous
// one live.
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MediaManifest } from "schema";
import { envSchema } from "schema/env";

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, "..");
const local = join(web, "public", "media", "manifest.json");
const out = join(web, "generated", "media-manifest.json");

const log = (fields: Record<string, unknown>): void =>
  console.log(JSON.stringify({ job: "media:manifest", ...fields }));

function cdnBaseUrl(): string | null {
  const raw = process.env["CDN_BASE_URL"];
  if (raw === undefined || raw === "") return null;
  const parsed = envSchema.shape.CDN_BASE_URL.safeParse(raw);
  if (!parsed.success || parsed.data === undefined) {
    throw new Error(`CDN_BASE_URL is not an http(s) URL: ${raw}`);
  }
  return parsed.data.replace(/\/+$/, "");
}

async function main(): Promise<void> {
  if (existsSync(local)) {
    rmSync(out, { force: true });
    log({ source: "local", manifest: local });
    return;
  }
  const base = cdnBaseUrl();
  if (base === null) {
    rmSync(out, { force: true });
    log({
      source: "none",
      note: "CDN_BASE_URL unset; pages render without pictures",
    });
    return;
  }
  const url = `${base}/media/manifest.json`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `${url} answered ${response.status} ${response.statusText}`,
    );
  }
  const text = await response.text();
  const manifest = MediaManifest.parse(JSON.parse(text));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  log({
    source: "cdn",
    url,
    generated_at: manifest.generated_at,
    ships: manifest.ships.length,
    concepts: manifest.concepts.length,
    covers: manifest.covers.length,
    makers: manifest.makers.length,
    showcase: manifest.showcase.length,
    holo: manifest.holo.length,
    titles: manifest.titles.length,
    bytes: Buffer.byteLength(text),
  });
}

await main();
