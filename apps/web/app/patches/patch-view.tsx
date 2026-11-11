import type { ReactNode } from "react";
import { Badge, EmptyState, SegmentedLinks, TextLink, formatNumber } from "ui";
import {
  changeOf,
  formatIngredient,
  formatValue,
  topChanges,
} from "../../lib/patch-format";
import type { PatchNote } from "../../lib/patch-notes";
import type { PatchPageData } from "../../lib/patch-page";
import {
  type Build,
  type ChangeSet,
  type EntryChange,
  type FamilyChanges,
  type FigureChange,
  type Mention,
  countOf,
} from "../../lib/patches";
import { FigureStrip } from "../strip";
import { PatchFilter } from "./patch-filter";

/**
 * The patch pages' parts (ADR-049). One layout for every comparison: what moved, sorted the way
 * CIG sorts its notes (ships and vehicles, weapons and items, gameplay's crafting), each block
 * folded to a line per entry that opens on its figures, then CIG's notes for the same builds.
 */

export const day = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const plural = (n: number, one: string, many: string): string =>
  `${formatNumber(n)} ${n === 1 ? one : many}`;

/** How many entries a block lists before folding the rest away. */
const SHOWN = 40;

export type PatchTab = "live" | "ptu" | "compare" | "history";

/** The three ways in, the same on every patch page. */
export function PatchTabs({
  current,
  live,
  ptu,
}: {
  readonly current: PatchTab;
  readonly live: string | null;
  readonly ptu: string | null;
}) {
  // Short enough to sit on one line on a phone.
  const links = [
    { href: "/patches", label: live === null ? "Latest" : `Latest ${live}` },
    { href: "/patches/ptu", label: ptu === null ? "PTU" : `PTU ${ptu}` },
    { href: "/patches/compare", label: "Compare" },
  ];
  const href =
    current === "live"
      ? "/patches"
      : current === "ptu"
        ? "/patches/ptu"
        : current === "compare"
          ? "/patches/compare"
          : "";
  return <SegmentedLinks label="Patch views" links={links} current={href} />;
}

function BuildName({ build }: { readonly build: Build }) {
  return (
    <span className="flex flex-col">
      <span className="text-heading text-primary">
        {build.channel === "LIVE"
          ? build.version
          : `${build.version} ${build.channel}`}
      </span>
      <span className="font-mono text-caption text-secondary">
        <span data-build={build.code}>{build.code}</span>
        {build.releasedAt === null
          ? ""
          : ` · ${day.format(new Date(build.releasedAt))}`}
      </span>
    </span>
  );
}

/** "4.10.2 against 4.10.1": the two builds, newest first, and how far apart. */
export function ComparisonHead({
  from,
  to,
  aside,
}: {
  readonly from: Build;
  readonly to: Build;
  readonly aside?: ReactNode;
}) {
  const days =
    from.releasedAt !== null && to.releasedAt !== null
      ? Math.round(
          (Date.parse(to.releasedAt) - Date.parse(from.releasedAt)) /
            86_400_000,
        )
      : null;
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 border-b border-hairline pb-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <BuildName build={to} />
        <span className="lab pb-1 text-muted">
          against
          {days === null ? "" : `, ${plural(days, "day", "days")} earlier`}
        </span>
        <BuildName build={from} />
      </div>
      {aside}
    </div>
  );
}

/** The comparison as four figures over the rule. */
export function PatchFigures({ data }: { readonly data: PatchPageData }) {
  const c = data.comparison;
  const t = data.totals;
  const added = c.ships.added.length;
  return (
    <FigureStrip
      columns={4}
      figures={[
        {
          label: "Ships and vehicles",
          value: formatNumber(t.ships),
          note: added > 0 ? `${formatNumber(added)} new` : "changed",
          href: "#ships",
        },
        {
          label: "Weapons and parts",
          value: formatNumber(t.parts),
          note: `in ${plural(c.parts.length, "family", "families")}`,
          href: "#parts",
        },
        {
          label: "Blueprints",
          value: formatNumber(t.blueprints),
          note:
            c.blueprints.added.length > 0
              ? `${formatNumber(c.blueprints.added.length)} new`
              : "changed",
          href: "#crafting",
        },
        {
          label: "Patch notes",
          value: formatNumber(data.notes.length),
          note: data.notes.length === 1 ? "post by CIG" : "posts by CIG",
          href: "#notes",
        },
      ]}
    />
  );
}

function ChangeCell({ f }: { readonly f: FigureChange }) {
  const c = changeOf(f.from, f.to);
  return (
    <span className="flex flex-wrap items-baseline justify-end gap-x-2">
      <span aria-label={c.spoken}>{c.text}</span>
      {c.percent === null ? null : (
        <span className="text-caption text-secondary">{c.percent}</span>
      )}
    </span>
  );
}

const th = "lab py-2 text-left text-muted";
const td = "border-t border-hairline py-2 align-baseline";

/** An entry's figures, grouped, the old build's value, the new one's and the change. */
function FigureTable({
  figures,
  from,
  to,
}: {
  readonly figures: readonly FigureChange[];
  readonly from: string;
  readonly to: string;
}) {
  const groups: { group: string; rows: FigureChange[] }[] = [];
  for (const f of figures) {
    const last = groups.at(-1);
    if (last !== undefined && last.group === f.group) last.rows.push(f);
    else groups.push({ group: f.group, rows: [f] });
  }
  return (
    <table className="w-full border-collapse text-ui">
      <thead>
        <tr>
          <th scope="col" className={th}>
            Figure
          </th>
          <th scope="col" className={`${th} text-right`}>
            {from}
          </th>
          <th scope="col" className={`${th} text-right`}>
            {to}
          </th>
          <th scope="col" className={`${th} text-right`}>
            Change
          </th>
        </tr>
      </thead>
      {groups.map((g) => (
        <tbody key={g.group}>
          {groups.length > 1 ? (
            <tr>
              <th
                scope="colgroup"
                colSpan={4}
                className="lab border-t border-hairline-strong pb-1 pt-3 text-left text-secondary"
              >
                {g.group}
              </th>
            </tr>
          ) : null}
          {g.rows.map((f) => (
            <tr key={f.key}>
              <th
                scope="row"
                className={`${td} pr-3 text-left font-regular text-secondary`}
              >
                {f.label}
                {f.unit === undefined ? null : (
                  <span className="text-caption text-muted"> ({f.unit})</span>
                )}
              </th>
              <td className={`${td} pl-2 text-right font-mono text-secondary`}>
                {formatValue(f.from)}
              </td>
              <td className={`${td} pl-2 text-right font-mono text-primary`}>
                {formatValue(f.to)}
              </td>
              <td className={`${td} pl-2 text-right font-mono text-primary`}>
                <ChangeCell f={f} />
              </td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}

function PartName({
  part,
}: {
  readonly part: EntryChange["loadout"][number]["from"];
}) {
  if (part === null) return <span className="text-muted">Empty</span>;
  return part.href === null ? (
    <span>{part.name}</span>
  ) : (
    <TextLink href={part.href}>{part.name}</TextLink>
  );
}

/** A break opportunity that draws nothing. */
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

/** A game name that may wrap after each underscore and slash, never inside a word. */
function breakable(name: string): string {
  return name.replace(/([_/])/g, `$1${ZERO_WIDTH_SPACE}`);
}

/** "Left wing" where the port's name says where; else its own words, "hardpoint" dropped. */
function portLabel(r: EntryChange["loadout"][number]): string {
  if (r.place !== null) return r.place;
  const leaf = r.port.split("/").at(-1) ?? r.port;
  const words = leaf
    .split("_")
    .filter((w) => w !== "" && !/^hardpoint$/i.test(w))
    .join(" ");
  const text = words === "" ? leaf : words;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function LoadoutTable({
  rows,
  from,
  to,
}: {
  readonly rows: EntryChange["loadout"];
  readonly from: string;
  readonly to: string;
}) {
  return (
    <table className="w-full border-collapse text-ui">
      <caption className="lab pb-1 text-left text-secondary">
        Stock loadout
      </caption>
      <thead>
        <tr>
          <th scope="col" className={th}>
            Port
          </th>
          <th scope="col" className={th}>
            {from}
          </th>
          <th scope="col" className={th}>
            {to}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.port}>
            <th
              scope="row"
              className={`${td} pr-3 text-left font-regular text-secondary`}
            >
              {portLabel(r)}
              <span className="block font-mono text-caption text-muted">
                {breakable(r.port)}
              </span>
            </th>
            <td className={`${td} pr-3`}>
              <PartName part={r.from} />
            </td>
            <td className={td}>
              <PartName part={r.to} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function IngredientTable({
  rows,
  from,
  to,
  status,
}: {
  readonly rows: EntryChange["ingredients"];
  readonly from: string;
  readonly to: string;
  readonly status: EntryChange["status"];
}) {
  return (
    <table className="w-full border-collapse text-ui">
      <caption className="lab pb-1 text-left text-secondary">
        What one craft takes
      </caption>
      <thead>
        <tr>
          <th scope="col" className={th}>
            Ingredient
          </th>
          {status === "added" ? null : (
            <th scope="col" className={`${th} text-right`}>
              {from}
            </th>
          )}
          {status === "removed" ? null : (
            <th scope="col" className={`${th} text-right`}>
              {to}
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}>
            <th
              scope="row"
              className={`${td} pr-3 text-left font-regular text-secondary`}
            >
              {r.name}
            </th>
            {status === "added" ? null : (
              <td className={`${td} text-right font-mono text-secondary`}>
                {formatIngredient(r.from)}
              </td>
            )}
            {status === "removed" ? null : (
              <td className={`${td} text-right font-mono text-primary`}>
                {formatIngredient(r.to)}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Mentions({ list }: { readonly list: readonly Mention[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="lab m-0 text-secondary">In CIG&apos;s patch notes</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {list.map((m) => (
          <li
            key={`${m.note.id}:${m.text}`}
            className="border-l-2 border-hairline-strong pl-3 text-ui text-primary"
          >
            {m.text}
            <span className="block text-caption text-secondary">
              <TextLink href={m.note.url} external>
                {noteName(m.note)}
              </TextLink>
              , {m.section}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The marker of a fold: a triangle that points down when open, not animated (system.md, motion).
 * Each answers to its own fold, not to one it sits inside: named groups.
 */
const FOLD_MARKS = {
  entry: ["group-open/entry:hidden", "hidden group-open/entry:inline"],
  more: ["group-open/more:hidden", "hidden group-open/more:inline"],
  family: ["group-open/family:hidden", "hidden group-open/family:inline"],
  note: ["group-open/note:hidden", "hidden group-open/note:inline"],
} as const;

function Fold({ scope }: { readonly scope: keyof typeof FOLD_MARKS }) {
  const [closed, open] = FOLD_MARKS[scope];
  return (
    <span aria-hidden="true" className="w-4 shrink-0 font-mono text-muted">
      <span className={closed}>▸</span>
      <span className={open}>▾</span>
    </span>
  );
}

/** The words each kind of entry also answers to in the filter. */
const KIND_WORDS = {
  ship: "ship vehicle",
  part: "part",
  blueprint: "blueprint crafting",
} as const;

const summaryClass =
  "flex cursor-pointer list-none items-baseline gap-2 rounded-control py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden";

/** One entry, folded to its name and the changes that moved most; open, every figure. */
function Entry({
  entry,
  from,
  to,
  mentions,
  kind,
  tags,
}: {
  readonly entry: EntryChange;
  readonly from: string;
  readonly to: string;
  readonly mentions: readonly Mention[];
  readonly kind: "ship" | "part" | "blueprint";
  /** Further words the filter matches: a part's family. */
  readonly tags?: string | undefined;
}) {
  const changed = entry.status === "changed";
  const top = changed ? topChanges(entry.figures, 2) : [];
  const count =
    entry.figures.length +
    entry.loadout.length +
    (changed ? entry.ingredients.length : 0);
  const pageWord =
    kind === "ship" ? "ship" : kind === "part" ? "part" : "part this makes";
  return (
    <details
      data-patch-entry=""
      data-name={`${entry.name} ${entry.detail ?? ""} ${entry.id} ${KIND_WORDS[kind]} ${tags ?? ""}`.toLowerCase()}
      className="group/entry border-b border-hairline"
    >
      <summary className={summaryClass}>
        <Fold scope="entry" />
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="flex min-w-0 flex-col">
            <span className="text-ui text-primary">{entry.name}</span>
            {entry.detail === null ? null : (
              <span className="text-caption text-secondary">
                {entry.detail}
              </span>
            )}
          </span>
          <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-caption text-secondary">
            {changed
              ? null
              : entry.figures.slice(0, 3).map((f) => {
                  const v = entry.status === "added" ? f.to : f.from;
                  return (
                    <span key={f.key} className="whitespace-nowrap">
                      {f.label}{" "}
                      <span className="font-mono text-primary">
                        {formatValue(v)}
                      </span>
                      {f.unit === undefined ? "" : ` ${f.unit}`}
                    </span>
                  );
                })}
            {top.map((f) => {
              const c = changeOf(f.from, f.to);
              return (
                <span key={f.key} className="whitespace-nowrap">
                  {f.label}{" "}
                  <span className="font-mono text-primary">
                    {formatValue(f.from)} → {formatValue(f.to)}
                  </span>
                  {c.percent === null ? null : ` (${c.percent})`}
                </span>
              );
            })}
            {entry.loadout.length > 0 ? (
              <span className="whitespace-nowrap">
                {plural(
                  entry.loadout.length,
                  "port refitted",
                  "ports refitted",
                )}
              </span>
            ) : null}
            {mentions.length > 0 ? (
              <span className="whitespace-nowrap">In the notes</span>
            ) : null}
            {changed ? (
              <span className="whitespace-nowrap text-muted">
                {plural(count, "change", "changes")}
              </span>
            ) : null}
          </span>
        </span>
      </summary>
      <div className="flex flex-col gap-4 pb-6 pl-6">
        {entry.figures.length > 0 ? (
          <FigureTable figures={entry.figures} from={from} to={to} />
        ) : null}
        {entry.loadout.length > 0 ? (
          <LoadoutTable rows={entry.loadout} from={from} to={to} />
        ) : null}
        {entry.ingredients.length > 0 ? (
          <IngredientTable
            rows={entry.ingredients}
            from={from}
            to={to}
            status={entry.status}
          />
        ) : null}
        {mentions.length > 0 ? <Mentions list={mentions} /> : null}
        {entry.href === null ? null : (
          <p className="m-0 text-ui">
            <TextLink href={entry.href}>Open the {pageWord} page</TextLink>
          </p>
        )}
      </div>
    </details>
  );
}

/** A list of entries; past the first forty, the rest wait in a fold. */
function Entries({
  title,
  list,
  from,
  to,
  mentions,
  kind,
  level,
  tags,
}: {
  readonly title: string;
  readonly level: "h3" | "h4";
  readonly list: readonly EntryChange[];
  readonly from: string;
  readonly to: string;
  readonly mentions: ReadonlyMap<string, readonly Mention[]>;
  readonly kind: "ship" | "part" | "blueprint";
  /** Further words the filter matches: a part's family. */
  readonly tags?: string | undefined;
}) {
  if (list.length === 0) return null;
  const render = (e: EntryChange) => (
    <Entry
      key={e.id}
      entry={e}
      from={from}
      to={to}
      kind={kind}
      tags={tags}
      mentions={mentions.get(e.id) ?? []}
    />
  );
  const Heading = level;
  return (
    <div data-patch-block="" className="flex flex-col">
      <Heading className="lab m-0 border-b border-hairline-strong pb-2 text-secondary">
        {title}{" "}
        <span className="font-mono text-muted">
          {formatNumber(list.length)}
        </span>
      </Heading>
      {list.slice(0, SHOWN).map(render)}
      {list.length > SHOWN ? (
        <details className="group/more">
          <summary className={summaryClass}>
            <Fold scope="more" />
            <span className="text-ui text-accent">
              Show the other {formatNumber(list.length - SHOWN)}
            </span>
          </summary>
          {list.slice(SHOWN).map(render)}
        </details>
      ) : null}
    </div>
  );
}

function ChangeSetView({
  set,
  from,
  to,
  mentions,
  kind,
  words,
  level,
  tags,
}: {
  readonly level: "h3" | "h4";
  readonly set: ChangeSet;
  readonly from: string;
  readonly to: string;
  readonly mentions: ReadonlyMap<string, readonly Mention[]>;
  readonly kind: "ship" | "part" | "blueprint";
  readonly words: { added: string; changed: string; removed: string };
  readonly tags?: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Entries
        title={words.added}
        list={set.added}
        {...{ from, to, mentions, kind, level, tags }}
      />
      <Entries
        title={words.changed}
        list={set.changed}
        {...{ from, to, mentions, kind, level, tags }}
      />
      <Entries
        title={words.removed}
        list={set.removed}
        {...{ from, to, mentions, kind, level, tags }}
      />
    </div>
  );
}

function countLine(set: ChangeSet): string {
  const bits = [
    set.changed.length > 0
      ? `${formatNumber(set.changed.length)} changed`
      : null,
    set.added.length > 0 ? `${formatNumber(set.added.length)} new` : null,
    set.removed.length > 0
      ? `${formatNumber(set.removed.length)} removed`
      : null,
  ].filter((b): b is string => b !== null);
  return bits.length === 0 ? "No changes" : bits.join(" · ");
}

export function Section({
  id,
  title,
  meta,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly meta?: string | undefined;
  readonly children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="flex scroll-mt-8 flex-col gap-4 border-t border-hairline pt-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${id}-heading`} className="m-0 text-heading text-primary">
          {title}
        </h2>
        {meta === undefined ? null : (
          <p className="lab m-0 text-secondary">{meta}</p>
        )}
      </div>
      {children}
    </section>
  );
}

/** A part family, folded to its name and counts; the guns and missiles open first. */
function Family({
  family,
  from,
  to,
  open,
}: {
  readonly family: FamilyChanges;
  readonly from: string;
  readonly to: string;
  readonly open: boolean;
}) {
  return (
    <details
      data-patch-block=""
      open={open}
      className="group/family rounded-card bg-surface px-4 shadow-soft"
    >
      <summary className={summaryClass}>
        <Fold scope="family" />
        <span className="flex flex-1 flex-wrap items-baseline justify-between gap-2">
          <h3
            id={`parts-${family.id}`}
            className="m-0 text-ui font-medium text-primary"
          >
            {family.label}
          </h3>
          <span className="lab text-secondary">{countLine(family)}</span>
        </span>
      </summary>
      <div className="pb-4">
        <ChangeSetView
          set={family}
          from={from}
          to={to}
          mentions={new Map()}
          kind="part"
          tags={family.label}
          level="h4"
          words={{ added: "New", changed: "Changed", removed: "Removed" }}
        />
      </div>
    </details>
  );
}

const KIND: Readonly<Record<PatchNote["kind"], string>> = {
  ptu: "PTU",
  live: "LIVE",
  hotfix: "Hotfix",
  official: "Official notes",
  announcement: "Announcement",
};

export function noteName(n: PatchNote): string {
  const bits = [
    n.kind === "hotfix"
      ? "Hotfix Central"
      : n.kind === "official"
        ? `Alpha ${n.version} patch notes`
        : n.kind === "announcement"
          ? n.title
          : `${n.version} ${n.channel}${n.releaseCandidate === null ? "" : ` ${n.releaseCandidate}`}`,
    n.audience,
  ].filter((b): b is string => b !== null);
  return bits.join(", ");
}

/** One post of CIG's notes, laid out in its own sections, folded but for the newest. */
function Note({
  note,
  open,
}: {
  readonly note: PatchNote;
  readonly open: boolean;
}) {
  const where =
    note.kind === "official" || note.kind === "announcement"
      ? "RSI"
      : "Spectrum";
  const head = (
    <span className="flex flex-1 flex-wrap items-baseline justify-between gap-2">
      <span className="flex flex-col">
        <span className="text-ui text-primary">{noteName(note)}</span>
        <span className="text-caption text-secondary">
          {day.format(new Date(note.publishedAt))}
          {note.build === null ? "" : ` · build ${note.build}`}
        </span>
      </span>
      <Badge tone="neutral">{KIND[note.kind]}</Badge>
    </span>
  );
  if (note.flat) {
    return (
      <div className="flex items-baseline gap-2 border-b border-hairline py-3">
        <span aria-hidden="true" className="w-4 shrink-0" />
        <span className="flex flex-1 flex-col gap-1">
          {head}
          <TextLink href={note.url} external className="self-start text-ui">
            Read it on {where}
          </TextLink>
        </span>
      </div>
    );
  }
  return (
    <details open={open} className="group/note border-b border-hairline">
      <summary className={summaryClass}>
        <Fold scope="note" />
        {head}
      </summary>
      <div className="flex flex-col gap-6 pb-6 pl-6">
        {note.facts.length > 0 ? (
          <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-3">
            {note.facts.map((f) => (
              <div key={f.label} className="flex flex-col">
                <dt className="lab text-muted">{f.label}</dt>
                <dd className="m-0 text-ui text-primary">{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {note.sections.map((s) => (
          <div key={s.title} className="flex flex-col gap-3">
            <h3 className="lab m-0 border-b border-hairline-strong pb-1 text-secondary">
              {s.title}
            </h3>
            {s.groups.map((g, i) => (
              <div
                key={`${g.title ?? ""}:${i}`}
                className="flex flex-col gap-1"
              >
                {g.title === null ? null : (
                  <h4 className="m-0 text-ui font-medium text-primary">
                    {g.title}
                  </h4>
                )}
                {g.items.length > 0 ? (
                  <ul className="m-0 flex list-disc flex-col gap-1 pl-4 text-ui text-secondary marker:text-muted">
                    {g.items.map((item, j) => (
                      <li key={j} className="max-w-prose">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        ))}
        <p className="m-0 text-ui">
          <TextLink href={note.url} external>
            Read it on {where}
          </TextLink>
        </p>
      </div>
    </details>
  );
}

export function NotesList({ notes }: { readonly notes: readonly PatchNote[] }) {
  if (notes.length === 0) {
    return (
      <EmptyState>
        No patch notes for these builds are on record. CIG posts them in
        Spectrum&apos;s{" "}
        <TextLink
          href="https://robertsspaceindustries.com/spectrum/community/SC/forum/190048"
          external
        >
          Patch Notes channel
        </TextLink>
        .
      </EmptyState>
    );
  }
  const firstOpen = notes.findIndex((n) => !n.flat);
  return (
    <div className="flex flex-col">
      {notes.map((n, i) => (
        <Note key={n.id} note={n} open={i === firstOpen} />
      ))}
    </div>
  );
}

/** The page's own contents and the builds on record, beside the sections on wide screens. */
function Rail({
  data,
  current,
}: {
  readonly data: PatchPageData;
  readonly current: Build;
}) {
  const t = data.totals;
  const items = [
    { href: "#ships", label: "Ships and vehicles", n: t.ships },
    { href: "#parts", label: "Weapons and parts", n: t.parts },
    { href: "#crafting", label: "Crafting", n: t.blueprints },
    { href: "#notes", label: "Patch notes", n: data.notes.length },
    { href: "#sources", label: "Sources", n: null },
  ];
  const link =
    "flex items-baseline justify-between gap-2 rounded-control text-ui text-secondary no-underline transition-colors duration-hover hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  const live = data.history.filter((b) => b.channel === "LIVE");
  return (
    <nav
      aria-label="This patch"
      className="flex flex-col gap-6 lg:sticky lg:top-8"
    >
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 lg:flex-col lg:gap-1">
        {items.map((it) => (
          <li key={it.href}>
            <a href={it.href} className={link}>
              <span>{it.label}</span>
              {it.n === null ? null : (
                <span className="font-mono text-caption text-muted">
                  {formatNumber(it.n)}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
      <div className="hidden flex-col gap-2 lg:flex">
        <p className="lab m-0 text-muted">Patch history</p>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {live.map((b) => (
            <li key={b.code}>
              <a
                href={
                  b.code === live.at(0)?.code
                    ? "/patches"
                    : `/patches/${b.slug}`
                }
                aria-current={b.code === current.code ? "page" : undefined}
                className={`${link} ${b.code === current.code ? "text-primary" : ""}`}
              >
                <span>{b.version}</span>
                <span className="text-caption text-muted">
                  {b.releasedAt === null
                    ? ""
                    : day.format(new Date(b.releasedAt))}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

export function Sources({
  unrecorded,
  extra,
}: {
  readonly unrecorded: number;
  readonly extra?: ReactNode;
}) {
  return (
    <section
      id="sources"
      aria-labelledby="sources-heading"
      className="flex scroll-mt-8 flex-col gap-3 border-t border-hairline pt-8"
    >
      <h2 id="sources-heading" className="m-0 text-heading text-primary">
        Sources
      </h2>
      <p className="m-0 max-w-prose text-ui text-secondary">
        Every figure for every build comes from the{" "}
        <TextLink href="https://api.star-citizen.wiki" external>
          Star Citizen Wiki API
        </TextLink>
        , which keeps each LIVE build&apos;s ships, parts and blueprints and
        serves any of them by build. Figures are compared as the source states
        them: a figure shows as changed only when both builds state it.
        {unrecorded > 0
          ? ` ${plural(unrecorded, "figure", "figures")} one of the two builds does not record for any entry of its kind ${unrecorded === 1 ? "is" : "are"} left out rather than shown as new or gone.`
          : ""}{" "}
        Until the patch-day pipeline reads the game files, a figure the wiki has
        not recorded is not shown.
      </p>
      <p className="m-0 max-w-prose text-ui text-secondary">
        Patch notes are CIG&apos;s own, as posted in Spectrum&apos;s Patch Notes
        channel and on RSI&apos;s Comm-Link; each links to the original. A note
        is matched to a ship only by the ship&apos;s full name.
      </p>
      {extra}
    </section>
  );
}

/** The whole comparison: figures, the filter, the three blocks of changes, CIG's notes, sources. */
export function PatchView({
  data,
  compare,
}: {
  readonly data: PatchPageData;
  /** The "against another build" control beside the head. */
  readonly compare?: ReactNode;
}) {
  const c = data.comparison;
  const from = c.from.version;
  const to = c.to.version;
  const anything =
    data.totals.ships + data.totals.parts + data.totals.blueprints > 0;
  return (
    <div className="flex flex-col gap-8">
      <ComparisonHead from={c.from} to={c.to} aside={compare} />
      <PatchFigures data={data} />
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-5">
        <div className="lg:col-span-1">
          <Rail data={data} current={c.to} />
        </div>
        <div className="flex min-w-0 flex-col gap-12 lg:col-span-4">
          {anything ? <PatchFilter /> : null}

          <Section
            id="ships"
            title="Ships and vehicles"
            meta={countLine(c.ships)}
          >
            {countOf(c.ships) === 0 ? (
              <EmptyState>
                No ship or vehicle changed between these builds.
              </EmptyState>
            ) : (
              <ChangeSetView
                set={c.ships}
                from={from}
                to={to}
                mentions={data.mentions}
                kind="ship"
                level="h3"
                words={{
                  added: "New ships and vehicles",
                  changed: "Changed",
                  removed: "No longer in the game files",
                }}
              />
            )}
          </Section>

          <Section
            id="parts"
            title="Weapons and parts"
            meta={
              c.parts.length === 0
                ? "No changes"
                : plural(data.totals.parts, "entry", "entries")
            }
          >
            {c.parts.length === 0 ? (
              <EmptyState>
                No ship weapon or part changed between these builds.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-3">
                {c.parts.map((f, i) => (
                  <Family
                    key={f.id}
                    family={f}
                    from={from}
                    to={to}
                    open={i < 2}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section
            id="crafting"
            title="Crafting"
            meta={countLine(c.blueprints)}
          >
            {countOf(c.blueprints) === 0 ? (
              <EmptyState>
                No blueprint changed between these builds.
              </EmptyState>
            ) : (
              <ChangeSetView
                set={c.blueprints}
                from={from}
                to={to}
                mentions={new Map()}
                kind="blueprint"
                level="h3"
                words={{
                  added: "New blueprints",
                  changed: "Changed blueprints",
                  removed: "Blueprints removed",
                }}
              />
            )}
          </Section>

          <Section
            id="notes"
            title="Patch notes"
            meta={
              data.notes.length === 0
                ? undefined
                : plural(data.notes.length, "post", "posts")
            }
          >
            <p className="m-0 max-w-prose text-ui text-secondary">
              What CIG wrote about the builds between {from} and {to}, newest
              first, in CIG&apos;s own sections: the PTU waves that led to the
              patch, the LIVE release and its hotfixes.
            </p>
            <NotesList notes={data.notes} />
          </Section>

          <Sources unrecorded={c.unrecorded} />
        </div>
      </div>
    </div>
  );
}
