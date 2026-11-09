/**
 * The daily refresh's decisions (ADR-023), kept pure so they are tested without a network or a
 * shell: whether the catalog needs a rebuild, whether a rewritten file carries a real change or
 * only a new stamp, and the words of the commit, the summary and the issue the job leaves behind.
 */

/** A step's result: what the job did for one source. */
export type Outcome =
  | { readonly id: string; readonly label: string; readonly kind: "unchanged" }
  | {
      readonly id: string;
      readonly label: string;
      readonly kind: "changed";
      /** Repository-relative paths that carry a real change. */
      readonly files: readonly string[];
      /** One line for the commit message, for example the new build string. */
      readonly note?: string;
    }
  | {
      readonly id: string;
      readonly label: string;
      readonly kind: "skipped";
      readonly reason: string;
    }
  | {
      readonly id: string;
      readonly label: string;
      readonly kind: "failed";
      /** The fetcher's report: its last lines on stderr. */
      readonly report: string;
    };

/** Fields that change on every run without the data changing. */
export const STAMP_KEYS: ReadonlySet<string> = new Set(["fetched_at"]);

/**
 * Whether the pack must be rebuilt: the API serves another build, or the run was forced. A
 * build that was fetched on a day its checks failed waits on its branch (the workflow names it
 * `data/refresh-build-<build>`) and is not fetched again until the branch is gone or the run
 * is forced, so a broken page does not cost two hours of requests every day.
 */
export function needsRebuild(
  packVersion: string | null,
  apiVersion: string,
  force: boolean,
  waiting: readonly string[] = [],
): { rebuild: boolean; reason: string } {
  if (force) return { rebuild: true, reason: "rebuild forced" };
  if (waiting.includes(apiVersion))
    return {
      rebuild: false,
      reason: `build ${apiVersion} was fetched on a day its checks failed and waits on branch data/refresh-build-${apiVersion}; fix the code and merge or delete the branch, or force a rebuild`,
    };
  if (packVersion === null)
    return { rebuild: true, reason: "the pack has no game version" };
  if (packVersion === apiVersion)
    return { rebuild: false, reason: `build unchanged: ${apiVersion}` };
  return {
    rebuild: true,
    reason: `new build: ${apiVersion} (the pack has ${packVersion})`,
  };
}

/** The value with every stamp key removed, at any depth. */
export function withoutStamps(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutStamps);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!STAMP_KEYS.has(k)) out[k] = withoutStamps(v);
    }
    return out;
  }
  return value;
}

/**
 * Whether two versions of a file hold the same data. JSON is compared with its stamps removed;
 * anything else byte for byte. A file that exists on one side only differs.
 */
export function sameIgnoringStamps(
  before: string | null,
  after: string | null,
): boolean {
  if (before === null || after === null) return before === after;
  if (before === after) return true;
  let a: unknown;
  let b: unknown;
  try {
    a = JSON.parse(before);
    b = JSON.parse(after);
  } catch {
    return false;
  }
  return JSON.stringify(withoutStamps(a)) === JSON.stringify(withoutStamps(b));
}

/** `data: refresh 2026-11-10: catalog 4.10.3-LIVE.1, ship matrix, funding`. */
export function commitMessage(
  day: string,
  outcomes: readonly Outcome[],
): string | null {
  const changed = outcomes.filter((o) => o.kind === "changed");
  if (changed.length === 0) return null;
  const parts = changed.map((o) =>
    o.note === undefined ? o.label : `${o.label} ${o.note}`,
  );
  return `data: refresh ${day}: ${parts.join(", ")}`;
}

const line = (o: Outcome): string => {
  switch (o.kind) {
    case "unchanged":
      return `- ${o.label}: unchanged`;
    case "changed":
      return `- ${o.label}: changed${o.note === undefined ? "" : ` (${o.note})`}: ${o.files.join(", ")}`;
    case "skipped":
      return `- ${o.label}: skipped, ${o.reason}`;
    case "failed":
      return `- ${o.label}: **failed**`;
  }
};

/** The job's summary, as Markdown. */
export function summaryMarkdown(
  day: string,
  outcomes: readonly Outcome[],
): string {
  const failed = outcomes.filter((o) => o.kind === "failed");
  const lines = [`## Refresh ${day}`, "", ...outcomes.map(line)];
  for (const f of failed) {
    lines.push("", `### ${f.label} failed`, "", "```", f.report.trim(), "```");
  }
  return `${lines.join("\n")}\n`;
}

/** The issue the job opens or updates when a source failed, or null when none did. */
export function issueText(
  day: string,
  outcomes: readonly Outcome[],
  runUrl: string | null,
): { title: string; body: string } | null {
  const failed = outcomes.filter((o) => o.kind === "failed");
  if (failed.length === 0) return null;
  const body = [
    `The daily refresh of ${day} could not refresh ${failed.length === 1 ? "one source" : `${failed.length} sources`} (ADR-023). Nothing was written for ${failed.length === 1 ? "it" : "them"}; the other sources landed as usual.`,
    "",
    ...failed.flatMap((f) => [
      `### ${f.label}`,
      "",
      "```",
      f.report.trim(),
      "```",
      "",
    ]),
    "A fetcher halts on a shape it does not know (CLAUDE.md section 5). Read the report, add the rule the data needs in the fetcher, and rerun the workflow; do not edit the fixtures by hand.",
    runUrl === null ? "" : `\nRun: ${runUrl}`,
  ];
  return {
    title: `Refresh needs attention: ${failed.map((f) => f.label).join(", ")}`,
    body: `${body.join("\n").trim()}\n`,
  };
}

/** The last `n` non-empty lines of a fetcher's output, for a report. */
export function tail(text: string, n = 25): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  return lines.slice(-n).join("\n");
}
