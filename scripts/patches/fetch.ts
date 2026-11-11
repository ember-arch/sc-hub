import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  type PatchBlueprint,
  type PatchPart,
  type PatchShip,
  PatchSnapshot,
  PatchSnapshotFile,
  encodeSnapshot,
} from "schema";
import { z } from "zod";
import { MapError } from "../bootstrap-fixtures/errors.js";
import {
  FetchError,
  WIKI_BASE_URL,
  createWikiClient,
} from "../bootstrap-fixtures/fetch.js";
import { mapChannel } from "../bootstrap-fixtures/map.js";
import { userAgent } from "../user-agent.js";
import {
  PART_TYPES,
  isPlaceholder,
  mapBlueprint,
  mapPart,
  mapShip,
  renderSnapshot,
} from "./snapshot.js";

/**
 * One-off dev script, also a step of the daily refresh (ADR-023, ADR-049). Reads the builds the
 * Star Citizen Wiki API keeps, and for each build without a file in `fixtures/patches/` fetches
 * that build's ships (each with its loadout), parts and blueprints with the API's `version`
 * parameter, keeps the figures a comparison reads (`snapshot.ts`), validates the result against
 * `PatchSnapshot` and writes `fixtures/patches/<build>.json.gz` (gzip: twelve builds of JSON
 * would pass the fixtures' 40 MB budget, CLAUDE.md section 4). A file already written is never
 * rewritten (CLAUDE.md section 5: a published version does not change), whatever the flags.
 *
 *   pnpm --filter schema build && pnpm exec tsx scripts/patches/fetch.ts [--build <code>] [--max-builds <n>]
 *
 * `--build <code>` limits the run to that build; `--max-builds <n>` to the newest n builds not on
 * file (the daily refresh passes 1, so a backlog never outruns the job). A build newer than every
 * build on file that holds fewer than nine tenths of the newest file's ships or parts halts the
 * run: the wiki is still importing it, and a file written now would freeze the gap.
 *
 * About 300 requests a build at the client's 2.5 s spacing (CLAUDE.md section 9). Any problem
 * halts with a JSON report on stderr and exit code 1; a build is written only when all of it
 * maps and validates. PATCHES_CACHE_DIR, outside the repository, keeps the API's answers
 * (gzipped) for reruns during development.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
export const PATCHES_DIR = join(repoRoot, "fixtures", "patches");
const runId = randomUUID();
const startedAt = Date.now();

const args = process.argv.slice(2);
const only = args.flatMap((a, i) =>
  a === "--build" && args[i + 1] !== undefined ? [args[i + 1]!] : [],
);
const maxFlag = args.indexOf("--max-builds");
const maxBuilds =
  maxFlag >= 0 ? Number.parseInt(args[maxFlag + 1] ?? "", 10) : Infinity;
if (Number.isNaN(maxBuilds) || maxBuilds < 1) {
  throw new Error("--max-builds takes a whole number of at least 1");
}

/** A snapshot's file name: the build string, gzipped JSON. */
export const SNAPSHOT_SUFFIX = ".json.gz";

/** The build number at the end of a build string, which only grows from build to build. */
const buildNumber = (code: string): number =>
  Number(/\.(\d+)$/.exec(code)?.[1] ?? 0);

function log(event: Record<string, unknown>): void {
  process.stderr.write(
    `${JSON.stringify({ job: "patches", run_id: runId, ...event })}\n`,
  );
}

const VersionList = z.looseObject({
  data: z.array(
    z.looseObject({
      code: z.string().min(1),
      channel: z.string().min(1),
      released_at: z.string().nullable().optional(),
    }),
  ),
});

const ShipPage = z.looseObject({
  data: z.array(
    z.looseObject({
      uuid: z.string().min(1),
      name: z.string().min(1),
      class_name: z.string().min(1),
      production_status: z.unknown().optional(),
    }),
  ),
  meta: z.looseObject({ last_page: z.number().int().nonnegative() }),
});

const VehicleRecord = z.looseObject({
  data: z.looseObject({
    class_name: z.string().min(1),
    name: z.string().min(1),
    version: z.string().nullable().optional(),
  }),
});

const ItemPage = z.looseObject({
  data: z.array(
    z.looseObject({
      class_name: z.string().min(1),
      name: z.string().min(1),
      type: z.string().min(1),
      version: z.string().nullable().optional(),
    }),
  ),
  meta: z.looseObject({ last_page: z.number().int().nonnegative() }),
});

const BlueprintPage = z.looseObject({
  data: z.array(
    z.looseObject({
      key: z.string().min(1),
      output_name: z.string().nullable().optional(),
      game_version: z.string().nullable().optional(),
    }),
  ),
  meta: z.looseObject({ last_page: z.number().int().nonnegative() }),
});

/** The builds on file, by game version, from the file names. */
export function filedBuilds(dir: string = PATCHES_DIR): Set<string> {
  if (!existsSync(dir)) return new Set();
  return new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith(SNAPSHOT_SUFFIX) && /\d/.test(f.charAt(0)))
      .map((f) => f.slice(0, -SNAPSHOT_SUFFIX.length)),
  );
}

/** The newest build on file and its counts, or null with none. */
function newestFiled(
  filed: ReadonlySet<string>,
): { code: string; ships: number; parts: number } | null {
  const code = [...filed].sort((a, b) => buildNumber(b) - buildNumber(a))[0];
  if (code === undefined) return null;
  const file = PatchSnapshotFile.parse(
    JSON.parse(
      gunzipSync(
        readFileSync(join(PATCHES_DIR, `${code}${SNAPSHOT_SUFFIX}`)),
      ).toString("utf8"),
    ),
  );
  return { code, ships: file.counts.ships, parts: file.counts.parts };
}

/** ISO with offset as the schema wants it; the API writes "+00:00". */
function isoOrNull(v: string | null | undefined): string | null {
  if (v === null || v === undefined || v.trim() === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function main(): Promise<void> {
  const client = createWikiClient({
    fetch: (url, init) => globalThis.fetch(url, init),
    userAgent: userAgent("patches"),
    log,
  });
  const cacheDir = process.env["PATCHES_CACHE_DIR"];
  if (cacheDir !== undefined && cacheDir !== "") {
    const inside = relative(repoRoot, resolve(cacheDir));
    if (inside === "" || (!inside.startsWith("..") && !isAbsolute(inside))) {
      throw new MapError(
        `PATCHES_CACHE_DIR must point outside the repository: ${cacheDir}`,
      );
    }
  }
  const get = async (path: string): Promise<unknown> => {
    if (cacheDir === undefined || cacheDir === "") return client.getJson(path);
    const file = join(
      cacheDir,
      `${createHash("sha1").update(path).digest("hex")}.json.gz`,
    );
    if (existsSync(file))
      return JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
    const json = await client.getJson(path);
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(file, gzipSync(JSON.stringify(json)));
    return json;
  };

  const versions = VersionList.parse(
    await get("/api/game-versions?limit=100"),
  ).data;
  const filed = filedBuilds();
  const newest = newestFiled(filed);
  // Newest first, so a cap fetches the patch readers are waiting for before the backlog.
  const todo = versions
    .filter(
      (v) => !filed.has(v.code) && (only.length === 0 || only.includes(v.code)),
    )
    .sort((a, b) => buildNumber(b.code) - buildNumber(a.code))
    .slice(0, maxBuilds);
  for (const code of only) {
    if (!versions.some((v) => v.code === code)) {
      throw new MapError(`the API lists no build ${code}`, {
        listed: versions.map((v) => v.code),
      });
    }
  }
  log({
    event: "patches.plan",
    listed: versions.length,
    filed: filed.size,
    todo: todo.map((v) => v.code),
  });

  mkdirSync(PATCHES_DIR, { recursive: true });
  for (const version of todo) {
    const out = join(PATCHES_DIR, `${version.code}${SNAPSHOT_SUFFIX}`);
    if (existsSync(out)) continue;
    const q = `version=${encodeURIComponent(version.code)}`;
    const skipped = { ships: 0, unlisted: 0, parts: 0, blueprints: 0 };

    // Ships: the list names them, each record carries the figures and the port tree.
    const listed: { class_name: string; uuid: string }[] = [];
    // Vehicles the build lists whose figures the file does not hold: not on the ship matrix in
    // that build's record, a record from another build, or one the API does not serve. The
    // comparison skips them rather than call a ship new or removed (ADR-049).
    const unrecorded = new Set<string>();
    for (let page = 1; ; page += 1) {
      const list = ShipPage.parse(
        await get(`/api/vehicles?page[size]=200&page[number]=${page}&${q}`),
      );
      for (const entry of list.data) {
        if (isPlaceholder(entry.name)) continue;
        // In-game reward and event variants the ship matrix does not list (ADR-022).
        if (entry.production_status == null) {
          skipped.unlisted += 1;
          unrecorded.add(entry.class_name);
          continue;
        }
        if (!listed.some((l) => l.class_name === entry.class_name))
          listed.push({ class_name: entry.class_name, uuid: entry.uuid });
      }
      if (page >= list.meta.last_page) break;
    }
    if (listed.length === 0) {
      throw new MapError(`the API lists no ships for ${version.code}`);
    }
    listed.sort((a, b) => a.class_name.localeCompare(b.class_name));
    const ships: Record<string, PatchShip> = {};
    for (const { class_name, uuid } of listed) {
      let json: unknown;
      try {
        json = await get(
          `/api/vehicles/${encodeURIComponent(uuid)}?include=hardpoints&${q}`,
        );
      } catch (error) {
        // The list names it but the API serves no record of it for this build.
        if (error instanceof FetchError && error.status === 404) {
          skipped.ships += 1;
          unrecorded.add(class_name);
          log({
            event: "patches.ship.missing",
            build: version.code,
            class_name,
          });
          continue;
        }
        throw error;
      }
      const record = VehicleRecord.parse(json).data;
      if (record.class_name !== class_name) {
        throw new MapError(
          `vehicle ${uuid} is ${record.class_name} on the API but the list said ${class_name}`,
          { build: version.code, class_name, uuid },
        );
      }
      // A record from another build is not this build's figure.
      if (record.version != null && record.version !== version.code) {
        skipped.ships += 1;
        unrecorded.add(class_name);
        continue;
      }
      ships[class_name] = mapShip(
        (json as { data: Record<string, unknown> }).data,
      );
    }
    log({
      event: "patches.ships",
      build: version.code,
      ships: Object.keys(ships).length,
    });

    // Parts, by type, 200 a page.
    const parts: Record<string, PatchPart> = {};
    for (const type of PART_TYPES) {
      for (let page = 1; ; page += 1) {
        const json = await get(
          `/api/items?filter[type]=${type}&page[size]=200&page[number]=${page}&${q}`,
        );
        const list = ItemPage.parse(json);
        const raws = (json as { data: Record<string, unknown>[] }).data;
        list.data.forEach((entry, i) => {
          if (
            isPlaceholder(entry.name) ||
            (entry.version != null && entry.version !== version.code) ||
            parts[entry.class_name] !== undefined
          ) {
            skipped.parts += 1;
            return;
          }
          parts[entry.class_name] = mapPart(raws[i]!);
        });
        if (page >= list.meta.last_page) break;
      }
    }
    log({
      event: "patches.parts",
      build: version.code,
      parts: Object.keys(parts).length,
    });

    // Blueprints (crafting arrived in 4.x; an earlier build lists none).
    const blueprints: Record<string, PatchBlueprint> = {};
    for (let page = 1; ; page += 1) {
      const json = await get(
        `/api/blueprints?page[size]=200&page[number]=${page}&${q}`,
      );
      const list = BlueprintPage.parse(json);
      const raws = (json as { data: Record<string, unknown>[] }).data;
      list.data.forEach((entry, i) => {
        // A blueprint that names no output is a placeholder the game files keep (a "_TEMP" key).
        if (
          (entry.game_version != null && entry.game_version !== version.code) ||
          blueprints[entry.key] !== undefined ||
          (entry.output_name ?? "").trim() === ""
        ) {
          skipped.blueprints += 1;
          return;
        }
        blueprints[entry.key] = mapBlueprint(raws[i]!);
      });
      if (list.meta.last_page === 0 || page >= list.meta.last_page) break;
    }

    const snapshot = PatchSnapshot.parse({
      schema_version: 2,
      game_version: version.code,
      channel: mapChannel(version.channel),
      released_at: isoOrNull(version.released_at),
      fetched_at: new Date().toISOString(),
      source: "wiki-api",
      source_url: WIKI_BASE_URL,
      counts: {
        ships: Object.keys(ships).length,
        parts: Object.keys(parts).length,
        blueprints: Object.keys(blueprints).length,
      },
      ships,
      unrecorded_ships: [...unrecorded]
        .filter((c) => ships[c] === undefined)
        .sort((a, b) => a.localeCompare(b)),
      parts: Object.fromEntries(
        Object.entries(parts).sort(([a], [b]) => a.localeCompare(b)),
      ),
      blueprints: Object.fromEntries(
        Object.entries(blueprints).sort(([a], [b]) => a.localeCompare(b)),
      ),
    });
    // A new build the wiki has only begun to import would be frozen with its gaps.
    if (
      newest !== null &&
      buildNumber(version.code) > buildNumber(newest.code) &&
      (snapshot.counts.ships < newest.ships * 0.9 ||
        snapshot.counts.parts < newest.parts * 0.9)
    ) {
      throw new MapError(
        `${version.code} holds ${snapshot.counts.ships} ships and ${snapshot.counts.parts} parts against ${newest.ships} and ${newest.parts} in ${newest.code}; the wiki looks to be importing it still, so nothing is written`,
        { build: version.code, counts: snapshot.counts, newest },
      );
    }
    const text = renderSnapshot(
      PatchSnapshotFile.parse(encodeSnapshot(snapshot)),
    );
    const gz = gzipSync(text, { level: 9 });
    writeFileSync(out, gz);
    log({
      event: "patches.written",
      build: version.code,
      counts: snapshot.counts,
      skipped,
      bytes: Buffer.byteLength(text),
      gzipped: gz.length,
    });
  }

  log({
    event: "patches.summary",
    written: todo.length,
    requests: client.requests,
    duration_ms: Date.now() - startedAt,
  });
}

main().catch((error: unknown) => {
  const report =
    error instanceof MapError
      ? { error: error.message, details: error.details }
      : { error: String(error) };
  log({ event: "patches.halted", ...report });
  process.exitCode = 1;
});
