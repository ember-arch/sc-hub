/**
 * The daily refresh (ADR-023): runs the project's fetchers in order, cheapest check first, keeps
 * only real changes, and writes a summary, a commit message and, when a source failed, an issue
 * for `.github/workflows/refresh.yml` to act on. It adds no fetcher of its own; each one keeps
 * its rules, halts on an unknown shape and writes nothing when it does.
 *
 *   pnpm --filter schema build && pnpm exec tsx scripts/refresh/index.ts [--force-rebuild] [--out <dir>]
 *
 * Steps, in order:
 *   1. catalog: one request reads the build the Wiki API serves; only a new build (or
 *      `--force-rebuild`) rebuilds the pack (`scripts/bootstrap-fixtures`, "all": true).
 *   2. descriptions: after a rebuild, the ships' in-game descriptions.
 *   3. ship matrix, 4. loaners, 5. prices (pledge and shop): RSI sources, which need
 *      SC_HUB_CONTACT_EMAIL (CLAUDE.md section 9); skipped, and said so, without it.
 *   6. titles, 7. funding: the wiki's article and counters.
 *   Between 2 and 3, patches: a snapshot of every build the Wiki API lists and fixtures/patches
 *   lacks (ADR-049).
 *
 * The out folder holds summary.md, commit.txt, issue-title.txt, issue.md, needs-contact.txt,
 * build.txt (the build the API served) and one <step>.log per fetcher run; placeholders are
 * written first so the workflow always finds them. REFRESH_WAITING_BUILDS lists builds that
 * failed their checks on an earlier day and wait on a branch; they are not fetched again.
 *
 * Exit code 0 when every step ran or was skipped, 2 when a step failed (its report is in the
 * summary and the issue text), 1 when the job itself could not run.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createWikiClient } from "../bootstrap-fixtures/fetch.js";
import { WikiGameVersionResponse } from "../bootstrap-fixtures/types.js";
import { userAgent } from "../user-agent.js";
import {
  type Outcome,
  commitMessage,
  issueText,
  needsRebuild,
  sameIgnoringStamps,
  summaryMarkdown,
  tail,
} from "./plan.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const args = process.argv.slice(2);
const force = args.includes("--force-rebuild");
const outFlag = args.indexOf("--out");
const outDir =
  outFlag >= 0 && args[outFlag + 1] !== undefined
    ? args[outFlag + 1]!
    : join(tmpdir(), "sc-hub-refresh");
const day = new Date().toISOString().slice(0, 10);
const hasContact = (process.env["SC_HUB_CONTACT_EMAIL"] ?? "").trim() !== "";
const waitingBuilds = (process.env["REFRESH_WAITING_BUILDS"] ?? "")
  .split(/\s+/)
  .filter((b) => b !== "");
const runId = randomUUID();
const startedAt = Date.now();

const log = (event: Record<string, unknown>): void => {
  process.stderr.write(
    `${JSON.stringify({ job: "refresh", run_id: runId, ...event })}\n`,
  );
};

const outFile = (name: string, text: string): void =>
  writeFileSync(join(outDir, name), text);
// Placeholders first: a job that dies midway still leaves the workflow something to read.
mkdirSync(outDir, { recursive: true });
outFile(
  "summary.md",
  `## Refresh ${day}\n\nThe job did not finish; see the log.\n`,
);
outFile("commit.txt", "");
outFile("issue-title.txt", "Refresh needs attention: the job did not finish\n");
outFile(
  "issue.md",
  "The daily refresh stopped before writing its summary; see the run log.\n",
);
outFile("needs-contact.txt", "no\n");
outFile("build.txt", "");
outFile("outcomes.json", "[]\n");

interface Step {
  readonly id: string;
  readonly label: string;
  /** Repository-relative files or folders the fetcher writes. */
  readonly files: readonly string[];
  /** The script to run, relative to the repository. */
  readonly script: string;
  /** Arguments for the script. */
  readonly args?: readonly string[];
  readonly needsRsi?: boolean;
  /** Runs only when this earlier step changed something. */
  readonly after?: string;
  /** Decides whether to run, given the earlier outcomes; a string is the reason to skip. */
  readonly gate?: (
    outcomes: readonly Outcome[],
  ) =>
    | Promise<{ run: true; note?: string } | string>
    | { run: true; note?: string }
    | string;
}

/**
 * Every file under the paths, keyed by repository-relative path, read byte for byte (latin1 maps
 * each byte to one character and back): the patch snapshots are gzip (ADR-049), and a UTF-8
 * round trip would corrupt them on a restore. JSON compares the same either way.
 */
function snapshot(paths: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (abs: string): void => {
    if (!existsSync(abs)) return;
    if (statSync(abs).isDirectory()) {
      for (const name of readdirSync(abs)) walk(join(abs, name));
      return;
    }
    out.set(
      relative(repoRoot, abs).replaceAll("\\", "/"),
      readFileSync(abs, "latin1"),
    );
  };
  for (const p of paths) walk(join(repoRoot, p));
  return out;
}

/** Puts the files back as they were: a halted fetcher may have removed its folder first. */
function restore(
  before: Map<string, string>,
  after: Map<string, string>,
  only?: ReadonlySet<string>,
): void {
  for (const [path, text] of before) {
    if (only !== undefined && !only.has(path)) continue;
    const abs = join(repoRoot, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text, "latin1");
  }
  for (const path of after.keys()) {
    if (before.has(path)) continue;
    if (only !== undefined && !only.has(path)) continue;
    rmSync(join(repoRoot, path), { force: true });
  }
}

function runScript(
  script: string,
  args: readonly string[] = [],
): { code: number; stderr: string } {
  const result = spawnSync("pnpm", ["exec", "tsx", script, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 256 * 1024 * 1024,
    shell: process.platform === "win32",
  });
  if (result.error !== undefined) {
    return { code: 1, stderr: String(result.error) };
  }
  return { code: result.status ?? 1, stderr: result.stderr };
}

async function catalogGate(): Promise<{ run: true; note?: string } | string> {
  const file = join(repoRoot, "fixtures", "bootstrap", "GameVersion.json");
  const packVersion: string | null = existsSync(file)
    ? ((JSON.parse(readFileSync(file, "utf8")) as { version: string }[])[0]
        ?.version ?? null)
    : null;
  const client = createWikiClient({
    fetch: (url, init) => globalThis.fetch(url, init),
    userAgent: userAgent("refresh"),
    log,
  });
  const served = WikiGameVersionResponse.parse(
    await client.getJson("/api/game-versions/default"),
  ).data.code;
  outFile("build.txt", `${served}\n`);
  const decision = needsRebuild(packVersion, served, force, waitingBuilds);
  log({ event: "refresh.build", pack: packVersion, served, ...decision });
  return decision.rebuild ? { run: true, note: served } : decision.reason;
}

/**
 * The descriptions follow the pack: they run when the catalog changed in this run, and also when
 * the file on disk is missing or for another build than the pack's (a rebuild that landed on a
 * day the descriptions halted). Coverage is not a reason: a vehicle the wiki has no text for
 * never gets a row, and a gate on the count would fetch every description every day.
 */
function descriptionsGate(
  outcomes: readonly Outcome[],
): { run: true } | string {
  if (outcomes.find((o) => o.id === "catalog")?.kind === "changed")
    return { run: true };
  const packFile = join(repoRoot, "fixtures", "bootstrap", "GameVersion.json");
  const vehiclesFile = join(repoRoot, "fixtures", "bootstrap", "Vehicle.json");
  const file = join(
    repoRoot,
    "fixtures",
    "descriptions",
    "VehicleDescription.json",
  );
  if (!existsSync(packFile) || !existsSync(vehiclesFile))
    return "no pack to describe";
  const packVersion = (
    JSON.parse(readFileSync(packFile, "utf8")) as { version: string }[]
  )[0]?.version;
  const vehicles = (
    JSON.parse(readFileSync(vehiclesFile, "utf8")) as { class_name: string }[]
  ).map((v) => v.class_name);
  if (!existsSync(file)) return { run: true };
  const rows = JSON.parse(readFileSync(file, "utf8")) as {
    class_name: string;
    game_version: string;
  }[];
  const described = rows.filter((r) => r.game_version === packVersion);
  if (described.length === 0 && vehicles.length > 0) return { run: true };
  return `the descriptions are for the pack's build, ${packVersion ?? "this build"}`;
}

/**
 * The box shapes follow the pack the same way (ADR-028): after a rebuild, and when the file is
 * missing or for another build than the pack's.
 */
function cargoBoxesGate(outcomes: readonly Outcome[]): { run: true } | string {
  if (outcomes.find((o) => o.id === "catalog")?.kind === "changed")
    return { run: true };
  const packFile = join(repoRoot, "fixtures", "bootstrap", "GameVersion.json");
  const file = join(repoRoot, "fixtures", "cargo", "CargoBox.json");
  if (!existsSync(packFile)) return "no pack to read boxes for";
  if (!existsSync(file)) return { run: true };
  const packVersion = (
    JSON.parse(readFileSync(packFile, "utf8")) as { version: string }[]
  )[0]?.version;
  const boxes = JSON.parse(readFileSync(file, "utf8")) as {
    game_version: string;
  };
  if (boxes.game_version !== packVersion) return { run: true };
  return `the box shapes are for the pack's build, ${packVersion ?? "this build"}`;
}

/**
 * The patch snapshots (ADR-049) run when the Wiki API lists a build that has no file in
 * fixtures/patches yet: one request for the list, then about 300 for the newest such build (one
 * build a run).
 */
async function patchesGate(): Promise<{ run: true; note?: string } | string> {
  const client = createWikiClient({
    fetch: (url, init) => globalThis.fetch(url, init),
    userAgent: userAgent("refresh"),
    log,
  });
  const listed = (
    (await client.getJson("/api/game-versions?limit=100")) as {
      data?: { code?: unknown }[];
    }
  ).data
    ?.map((v) => v.code)
    .filter((c): c is string => typeof c === "string");
  if (listed === undefined || listed.length === 0)
    return "the Wiki API listed no builds";
  const dir = join(repoRoot, "fixtures", "patches");
  const filed = new Set(
    existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => /^\d.*\.json\.gz$/.test(f))
          .map((f) => f.slice(0, -".json.gz".length))
      : [],
  );
  const missing = listed.filter((c) => !filed.has(c));
  return missing.length === 0
    ? "every build the Wiki API lists is on file"
    : { run: true, note: missing.join(", ") };
}

const STEPS: readonly Step[] = [
  {
    id: "catalog",
    label: "catalog",
    files: ["fixtures/bootstrap"],
    script: "scripts/bootstrap-fixtures/index.ts",
    gate: catalogGate,
  },
  {
    id: "descriptions",
    label: "descriptions",
    files: ["fixtures/descriptions"],
    script: "scripts/bootstrap-fixtures/descriptions.ts",
    gate: descriptionsGate,
  },
  {
    id: "cargo-boxes",
    label: "cargo boxes",
    files: ["fixtures/cargo/CargoBox.json"],
    script: "scripts/bootstrap-fixtures/cargo-boxes.ts",
    gate: cargoBoxesGate,
  },
  {
    id: "patches",
    label: "patch snapshots",
    files: ["fixtures/patches"],
    script: "scripts/patches/fetch.ts",
    // One build a run: a backlog (a first run, or days the wiki was down) is worked off a
    // build a day instead of outrunning the job (ADR-049).
    args: ["--max-builds", "1"],
    gate: patchesGate,
  },
  {
    id: "ship-matrix",
    label: "ship matrix",
    files: ["fixtures/ship-matrix"],
    script: "scripts/media/snapshot-matrix.ts",
    needsRsi: true,
  },
  {
    id: "loaners",
    label: "loaners",
    files: ["fixtures/acquisition/LoanerMatrix.json"],
    script: "scripts/bootstrap-fixtures/loaners.ts",
    needsRsi: true,
  },
  {
    id: "prices",
    label: "prices",
    files: [
      "fixtures/acquisition/PledgeOffer.json",
      "fixtures/acquisition/ShopPrice.json",
    ],
    script: "scripts/bootstrap-fixtures/acquisition.ts",
    needsRsi: true,
  },
  {
    id: "titles",
    label: "titles",
    files: ["fixtures/titles"],
    script: "scripts/titles/fetch.ts",
  },
  {
    id: "fitting",
    label: "fitting list",
    files: ["fixtures/fitting/ShipFit.json"],
    script: "scripts/fitting/fetch.ts",
  },
  {
    id: "funding",
    label: "funding",
    files: ["fixtures/funding"],
    script: "scripts/funding/fetch.ts",
  },
];

async function runStep(
  step: Step,
  outcomes: readonly Outcome[],
): Promise<Outcome> {
  const { id, label } = step;
  if (step.needsRsi === true && !hasContact) {
    return {
      id,
      label,
      kind: "skipped",
      reason:
        "needs SC_HUB_CONTACT_EMAIL, the contact address RSI requests carry (CLAUDE.md section 9); set the repository variable",
    };
  }
  if (step.after !== undefined) {
    const earlier = outcomes.find((o) => o.id === step.after);
    if (earlier?.kind !== "changed") {
      return {
        id,
        label,
        kind: "skipped",
        reason: `only after a change to the ${step.after}`,
      };
    }
  }
  let note: string | undefined;
  if (step.gate !== undefined) {
    let decision: { run: true; note?: string } | string;
    try {
      decision = await step.gate(outcomes);
    } catch (error) {
      return {
        id,
        label,
        kind: "failed",
        report: `the check before the fetch failed: ${String(error)}`,
      };
    }
    if (typeof decision === "string")
      return { id, label, kind: "skipped", reason: decision };
    note = decision.note;
  }

  const before = snapshot(step.files);
  log({ event: "refresh.step", id, script: step.script });
  const started = Date.now();
  const result = runScript(step.script, step.args);
  // The fetcher's whole log, for the job's summary; the issue quotes its last lines.
  outFile(`${id}.log`, result.stderr);
  const after = snapshot(step.files);
  if (result.code !== 0) {
    restore(before, after);
    log({ event: "refresh.failed", id, code: result.code });
    return { id, label, kind: "failed", report: tail(result.stderr) };
  }
  const changed: string[] = [];
  const same = new Set<string>();
  for (const path of new Set([...before.keys(), ...after.keys()])) {
    if (sameIgnoringStamps(before.get(path) ?? null, after.get(path) ?? null))
      same.add(path);
    else changed.push(path);
  }
  // A new stamp on the same data is not a change: put those files back.
  restore(before, after, same);
  log({
    event: "refresh.done",
    id,
    changed: changed.length,
    duration_ms: Date.now() - started,
  });
  changed.sort();
  return changed.length === 0
    ? { id, label, kind: "unchanged" }
    : note === undefined
      ? { id, label, kind: "changed", files: changed }
      : { id, label, kind: "changed", files: changed, note };
}

const outcomes: Outcome[] = [];
for (const step of STEPS) outcomes.push(await runStep(step, outcomes));

const runUrl = process.env["REFRESH_RUN_URL"] ?? null;
const message = commitMessage(day, outcomes);
const issue = issueText(day, outcomes, runUrl);
writeFileSync(join(outDir, "outcomes.json"), JSON.stringify(outcomes, null, 2));
writeFileSync(join(outDir, "summary.md"), summaryMarkdown(day, outcomes));
writeFileSync(
  join(outDir, "commit.txt"),
  message === null ? "" : `${message}\n`,
);
writeFileSync(
  join(outDir, "issue-title.txt"),
  issue === null ? "" : `${issue.title}\n`,
);
writeFileSync(join(outDir, "issue.md"), issue === null ? "" : issue.body);
const needsContact = outcomes.some(
  (o) =>
    o.kind === "skipped" && o.reason.startsWith("needs SC_HUB_CONTACT_EMAIL"),
);
writeFileSync(
  join(outDir, "needs-contact.txt"),
  needsContact ? "yes\n" : "no\n",
);

const failed = outcomes.filter((o) => o.kind === "failed").length;
console.log(
  JSON.stringify({
    job: "refresh",
    run_id: runId,
    day,
    duration_ms: Date.now() - startedAt,
    errors: failed,
    changed: outcomes.filter((o) => o.kind === "changed").map((o) => o.id),
    unchanged: outcomes.filter((o) => o.kind === "unchanged").map((o) => o.id),
    skipped: outcomes.filter((o) => o.kind === "skipped").map((o) => o.id),
    failed: outcomes.filter((o) => o.kind === "failed").map((o) => o.id),
    out: outDir,
  }),
);
process.exit(failed > 0 ? 2 : 0);
