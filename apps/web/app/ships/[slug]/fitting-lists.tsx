import type { ReactNode } from "react";
import type { FitVerdict } from "schema";
import { FITTING_CREDIT, TextLink } from "ui";
import { fitting, repo } from "../../../lib/data";
import {
  type Carried,
  type CarriedBy,
  SLOT_LABEL,
  VERDICT_LABEL,
  VERDICT_ORDER,
} from "../../../lib/fitting";

/**
 * The fitting list on a ship file (ADR-028): for a ship that carries, what Pegaxsus's list says
 * fits inside it, by verdict and by space; for any ship or vehicle, what it says carries it.
 * Community-tested in play, never a game stat, and the lines under the lists say whose work it
 * is, for which build, when it was last updated, and where it lives.
 */

interface Entry {
  readonly key: string;
  readonly label: string;
  readonly href: string | null;
  /** "hangar", "cargo bay or garage", or the sheet's own marker. */
  readonly where: string | null;
  readonly mark: string | null;
  readonly note: string | null;
}

const hrefOf = (classNames: readonly string[]): string | null => {
  const r = repo();
  for (const cn of classNames) {
    const ship = r.ships.find((s) => s.vehicle.class_name === cn);
    if (ship !== undefined) return `/ships/${ship.vehicle.slug}`;
  }
  return null;
};

const whereOf = (
  slot: "hangar" | "cargo" | "cargo_module" | null,
  marker: string | null,
): string | null => (slot === null ? marker : SLOT_LABEL[slot]);

function carriedEntry(c: Carried): Entry {
  return {
    key: `${c.vehicle.id}-${c.slot ?? ""}-${c.marker ?? ""}`,
    label: c.vehicle.label,
    href: hrefOf(c.vehicle.class_names),
    where: whereOf(c.slot, c.marker),
    mark: c.mark,
    note: c.note,
  };
}

function carrierEntry(c: CarriedBy): Entry {
  return {
    key: `${c.carrier.id}`,
    label: c.carrier.unreleased
      ? `${c.carrier.label} (unreleased)`
      : c.carrier.label,
    href: hrefOf(c.carrier.class_names),
    where: whereOf(c.carrier.slot, c.carrier.marker),
    mark: c.mark,
    note: c.note,
  };
}

function VerdictGroups({
  title,
  entries,
  of,
  allSpaces,
}: {
  readonly title: string;
  readonly entries: readonly (Entry & { readonly verdict: FitVerdict })[];
  /** "the list" words for the empty case. */
  readonly of: string;
  /** Every space of the carrier: an entry that names them all names none. */
  readonly allSpaces?: readonly string[] | undefined;
}) {
  // One line per ship: the Merlin that fits the Carrack's hangar and its cargo bay alike is
  // "Merlin (hangar, cargo bay or garage)"; a different verdict or mark in one space keeps its own.
  const merged = (rows: readonly Entry[]): Entry[] => {
    const out: Entry[] = [];
    for (const e of rows) {
      const same = out.find(
        (o) =>
          o.label === e.label &&
          o.href === e.href &&
          o.mark === e.mark &&
          o.note === e.note,
      );
      if (same === undefined) out.push({ ...e });
      else
        out[out.indexOf(same)] = {
          ...same,
          where:
            same.where === null
              ? e.where
              : e.where === null || same.where.includes(e.where)
                ? same.where
                : `${same.where}, ${e.where}`,
        };
    }
    return out;
  };
  const groups = VERDICT_ORDER.map((verdict) => ({
    verdict,
    rows: merged(entries.filter((e) => e.verdict === verdict)).map((e) =>
      allSpaces !== undefined &&
      allSpaces.length > 1 &&
      e.where !== null &&
      allSpaces.every((s) => e.where!.includes(s))
        ? { ...e, where: null }
        : e,
    ),
  })).filter((g) => g.rows.length > 0);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="lab m-0 text-primary">{title}</h3>
      {groups.length === 0 ? (
        <p className="m-0 text-ui text-secondary">Nothing on {of}.</p>
      ) : (
        <dl className="m-0 flex flex-col border-t border-hairline">
          {groups.map((g) => (
            <div
              key={g.verdict}
              className="flex flex-col gap-1 border-b border-hairline py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-4"
            >
              <dt className="shrink-0 text-ui text-secondary">
                {VERDICT_LABEL[g.verdict]}{" "}
                <span className="text-caption text-muted tabular-nums">
                  {g.rows.length}
                </span>
              </dt>
              <dd className="m-0 text-ui sm:text-right">
                {g.rows.map((e, i) => (
                  <span key={e.key}>
                    {i > 0 ? ", " : null}
                    {e.href === null ? (
                      <span className="text-primary">{e.label}</span>
                    ) : (
                      <TextLink href={e.href}>{e.label}</TextLink>
                    )}
                    {e.where === null ? null : (
                      <span className="text-secondary"> ({e.where})</span>
                    )}
                    {e.mark === null ? null : (
                      <span
                        className="text-secondary"
                        title={e.note ?? undefined}
                      >
                        {" "}
                        [{e.mark}
                        {e.note === null ? "" : `: ${e.note}`}]
                      </span>
                    )}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** The "Carries" and "Fits in" lists for one ship, or nothing where the list does not name it. */
export function FittingLists({
  className,
}: {
  readonly className: string;
}): ReactNode {
  const index = fitting();
  if (index === null || !index.knows(className)) return null;
  const carries = index.carries(className).map((c) => ({
    ...carriedEntry(c),
    verdict: c.verdict,
  }));
  const carriedBy = index.carriedBy(className).map((c) => ({
    ...carrierEntry(c),
    verdict: c.verdict,
  }));
  const isCarrier = index.list.carriers.some((c) =>
    c.class_names.includes(className),
  );
  const fabricator = index.fabricator(className);
  const allSpaces = [
    ...new Set(
      index.list.carriers
        .filter((c) => c.class_names.includes(className))
        .map((c) => whereOf(c.slot, c.marker))
        .filter((w): w is string => w !== null),
    ),
  ];
  const { source } = index.list;
  const updated = new Date(
    `${source.last_update}T00:00:00Z`,
  ).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <div className="flex flex-col gap-4">
      {isCarrier ? (
        <VerdictGroups
          title="Carries"
          entries={carries}
          of="the fitting list for this ship"
          allSpaces={allSpaces}
        />
      ) : null}
      {fabricator === null ? null : (
        <p className="m-0 text-ui text-secondary">
          A fabricator{" "}
          {fabricator === "fits"
            ? "fits"
            : fabricator === "no"
              ? "does not fit"
              : VERDICT_LABEL[fabricator].toLowerCase()}
          , by the list.
        </p>
      )}
      {isCarrier && carriedBy.length === 0 ? null : (
        <VerdictGroups
          title="Fits in"
          entries={carriedBy}
          of="the fitting list about this ship"
        />
      )}
      <p className="m-0 text-caption text-secondary">
        <TextLink href={source.url} external className="text-secondary">
          {source.title}
        </TextLink>{" "}
        by {source.author}, tested in play on {source.build_label}, last updated{" "}
        {updated}. {FITTING_CREDIT.notice} The list&apos;s own words for each
        verdict:{" "}
        {VERDICT_ORDER.map((v) => index.list.legend.verdicts[v])
          .filter((w) => w !== undefined)
          .join("; ")}
        .
      </p>
    </div>
  );
}
