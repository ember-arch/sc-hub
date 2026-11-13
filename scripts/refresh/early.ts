/**
 * Starts the refresh as soon as the Star Citizen Wiki serves a build CIG has released (ADR-059).
 * The News workflow runs it every half hour. The wiki is asked only while CIG's release notes
 * name a LIVE version newer than the pack's figures (`releasedAhead`, the rule the patch pages and
 * the footer use), one request then; the rest of the time it asks nothing. When the wiki's default
 * build is newer than the pack's and has not been asked for before, it writes `dispatch=true` and
 * the build to GITHUB_OUTPUT, and the workflow starts refresh.yml unless a refresh is already
 * running or waiting, or the build waits on a fix. `--record <build>` then writes the build to
 * fixtures/refresh/early.json, so one build is asked for once; the daily refresh is the backstop.
 *
 *   pnpm exec tsx scripts/refresh/early.ts            # decide
 *   pnpm exec tsx scripts/refresh/early.ts --record <build>
 */
import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ContentItem } from "schema";
import { patchNotes, releasedAhead } from "../../apps/web/lib/patch-notes.js";
import { createWikiClient } from "../bootstrap-fixtures/fetch.js";
import { WikiGameVersionResponse } from "../bootstrap-fixtures/types.js";
import { buildNumber } from "../patches/plan.js";
import { userAgent } from "../user-agent.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const STATE = join(repoRoot, "fixtures", "refresh", "early.json");
const runId = randomUUID();

export interface EarlyState {
  /** The last build the check asked the refresh for. */
  readonly build: string;
  readonly asked_at: string;
}

export type EarlyDecision =
  | { readonly dispatch: true; readonly build: string; readonly reason: string }
  | { readonly dispatch: false; readonly reason: string };

/** "4.10.2" from "4.10.2-LIVE.12881860"; null when the code is not a build's. */
export function versionOf(code: string): string | null {
  return /^(\d+\.\d+\.\d+)/.exec(code)?.[1] ?? null;
}

/**
 * Whether the wiki's default build is one to rebuild for now: newer than the pack's (by build
 * number, which only grows) and not asked for already.
 */
export function decide(
  packBuild: string | null,
  served: string,
  asked: EarlyState | null,
): EarlyDecision {
  if (packBuild !== null && buildNumber(served) <= buildNumber(packBuild))
    return {
      dispatch: false,
      reason: `the wiki still serves ${served}, the pack's build or older`,
    };
  if (asked?.build === served)
    return {
      dispatch: false,
      reason: `${served} was asked for at ${asked.asked_at}; the daily refresh picks it up if that run did not`,
    };
  return {
    dispatch: true,
    build: served,
    reason: `the wiki serves ${served}, newer than the pack's ${packBuild ?? "(none)"}`,
  };
}

function readJson<T>(file: string): T | null {
  return existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as T)
    : null;
}

function output(name: string, value: string): void {
  const file = process.env["GITHUB_OUTPUT"];
  if (file !== undefined && file !== "")
    appendFileSync(file, `${name}=${value}\n`);
}

function say(event: Record<string, unknown>): void {
  process.stderr.write(
    `${JSON.stringify({ job: "refresh-early", run_id: runId, ...event })}\n`,
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const recordAt = args.indexOf("--record");
  if (recordAt >= 0) {
    const build = args[recordAt + 1];
    if (build === undefined || build === "")
      throw new Error("--record needs a build");
    const state: EarlyState = { build, asked_at: new Date().toISOString() };
    mkdirSync(dirname(STATE), { recursive: true });
    writeFileSync(STATE, `${JSON.stringify(state, null, 2)}\n`);
    say({ event: "early.recorded", ...state });
    return;
  }
  output("dispatch", "false");
  const pack = readJson<{ version: string }[]>(
    join(repoRoot, "fixtures", "bootstrap", "GameVersion.json"),
  );
  const packBuild = pack?.[0]?.version ?? null;
  const live = packBuild === null ? null : versionOf(packBuild);
  const news = ContentItem.array().parse(
    readJson<unknown[]>(
      join(repoRoot, "fixtures", "news", "ContentItem.json"),
    ) ?? [],
  );
  const ahead = releasedAhead(patchNotes(news), live);
  if (ahead === null) {
    say({
      event: "early.quiet",
      reason: `no LIVE release ahead of ${packBuild ?? "the pack"}`,
    });
    return;
  }
  const client = createWikiClient({
    fetch: (url, init) => globalThis.fetch(url, init),
    userAgent: userAgent("refresh-early"),
    cacheDir: null,
  });
  const served = WikiGameVersionResponse.parse(
    await client.getJson("/api/game-versions/default"),
  ).data.code;
  const decision = decide(packBuild, served, readJson<EarlyState>(STATE));
  say({
    event: "early.decision",
    released: ahead.version,
    served,
    ...decision,
  });
  if (decision.dispatch) {
    output("dispatch", "true");
    output("build", decision.build);
  }
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  main().catch((error: unknown) => {
    // A failed check never holds back the news commit: the daily refresh is the backstop.
    say({ event: "early.failed", error: String(error) });
    process.exit(1);
  });
}
