/**
 * Copies the Star Citizen Wiki's gallery of RSI's art for every ship (ADR-024) into
 * `fixtures/galleries/<slug>/` (git-ignored) and records each file's source in
 * `fixtures/galleries/sources.json`. One request for each ship's article page and one per upload
 * copied, every one at least 5 seconds apart through the same polite client the titles use
 * (ADR-017: article pages and uploads only, never the wiki's API), with the project User-Agent.
 * The first eight official pictures and the first four in-game ones are copied; a ship whose
 * article has no gallery, or no article, is recorded as such. A ship already on file with every
 * picture on disk is not fetched again, so a run that stops can carry on.
 *
 *   pnpm exec tsx scripts/media/fetch-galleries.ts
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  type GalleryItem,
  GalleryShapeError,
  GallerySource,
  articleUrl,
  chooseItems,
  parseGallery,
} from "./gallery.js";
import { SHOWCASE } from "./showcase.js";
import {
  PoliteFetchError,
  USER_AGENT,
  createPoliteClient,
} from "../titles/polite.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const outDir = join(repoRoot, "fixtures", "galleries");
const LIMITS = { official: 8, ingame: 4 };

const Vehicle = z.object({
  class_name: z.string(),
  slug: z.string(),
  name: z.string(),
  base_variant_of: z.string().nullable(),
});
const Concept = z.object({ slug: z.string(), name: z.string() });

async function main(): Promise<void> {
  const runId = randomUUID();
  const started = Date.now();
  const log = (event: Record<string, unknown>): void => {
    process.stderr.write(`${JSON.stringify({ run_id: runId, ...event })}\n`);
  };
  mkdirSync(outDir, { recursive: true });
  const sourcesPath = join(outDir, "sources.json");
  const previous: GallerySource[] = existsSync(sourcesPath)
    ? z
        .array(GallerySource)
        .parse(JSON.parse(readFileSync(sourcesPath, "utf8")))
    : [];
  const rows = new Map(previous.map((r) => [r.slug, r]));
  const save = (): void =>
    writeFileSync(
      sourcesPath,
      `${JSON.stringify(
        [...rows.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
        null,
        2,
      )}\n`,
    );

  const client = createPoliteClient({
    fetch: (url, init) => globalThis.fetch(url, init),
    userAgent: USER_AGENT,
    log,
  });

  // Every entry (an edition takes its base's gallery on the page) and every concept ship; the
  // curated showcase ships keep their own art.
  const curated = new Set(SHOWCASE.map((s) => s.slug));
  const vehicles = z
    .array(Vehicle)
    .parse(
      JSON.parse(
        readFileSync(
          join(repoRoot, "fixtures", "bootstrap", "Vehicle.json"),
          "utf8",
        ),
      ),
    );
  const conceptsPath = join(
    repoRoot,
    "fixtures",
    "ship-matrix",
    "ConceptShip.json",
  );
  const concepts = existsSync(conceptsPath)
    ? z.array(Concept).parse(JSON.parse(readFileSync(conceptsPath, "utf8")))
    : [];
  const wanted = [
    ...vehicles
      .filter((v) => v.base_variant_of === null)
      .map((v) => ({ slug: v.slug, name: v.name })),
    ...concepts,
  ].filter((s) => !curated.has(s.slug));

  let fetched = 0;
  let reused = 0;
  let copied = 0;
  for (const ship of wanted) {
    const known = rows.get(ship.slug);
    if (
      known !== undefined &&
      known.items.every((i) => existsSync(join(outDir, ship.slug, i.file)))
    ) {
      reused += 1;
      continue;
    }
    const url = articleUrl(ship.name);
    let html: string;
    try {
      html = await client.text(url);
    } catch (error) {
      if (error instanceof PoliteFetchError && error.status === 404) {
        rows.set(ship.slug, {
          slug: ship.slug,
          name: ship.name,
          article_url: url,
          status: "no-article",
          items: [],
          fetched_at: new Date().toISOString(),
        });
        save();
        log({ event: "galleries.no_article", slug: ship.slug, url });
        continue;
      }
      throw error;
    }
    fetched += 1;
    let chosen: GalleryItem[];
    try {
      chosen = chooseItems(parseGallery(html), LIMITS);
    } catch (error) {
      if (error instanceof GalleryShapeError) {
        log({
          event: "galleries.halt",
          slug: ship.slug,
          message: error.message,
        });
        throw error;
      }
      throw error;
    }
    const dir = join(outDir, ship.slug);
    mkdirSync(dir, { recursive: true });
    const items: GallerySource["items"] = [];
    for (const item of chosen) {
      const target = join(dir, item.file);
      const kept = known?.items.find((i) => i.url === item.url);
      if (kept !== undefined && existsSync(target)) {
        items.push(kept);
        continue;
      }
      const bytes = Buffer.from(await client.bytes(item.url));
      writeFileSync(target, bytes);
      copied += 1;
      items.push({
        file: item.file,
        url: item.url,
        width: item.width,
        height: item.height,
        kind: item.kind,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
    rows.set(ship.slug, {
      slug: ship.slug,
      name: ship.name,
      article_url: url,
      status: items.length === 0 ? "no-gallery" : "gallery",
      items,
      fetched_at: new Date().toISOString(),
    });
    save();
    log({
      event: "galleries.ship",
      slug: ship.slug,
      pictures: items.length,
      requests: client.requests,
    });
  }
  save();
  console.log(
    JSON.stringify({
      run_id: runId,
      job: "media:fetch-galleries",
      ships: wanted.length,
      articles_fetched: fetched,
      reused,
      pictures_copied: copied,
      requests: client.requests,
      without_article: [...rows.values()].filter(
        (r) => r.status === "no-article",
      ).length,
      without_gallery: [...rows.values()].filter(
        (r) => r.status === "no-gallery",
      ).length,
      errors: 0,
      duration_ms: Date.now() - started,
    }),
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({ job: "media:fetch-galleries", error: String(error) })}\n`,
  );
  process.exit(1);
});
