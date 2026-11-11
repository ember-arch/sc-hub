import type { Metadata } from "next";
import { EmptyState, TextLink, formatNumber } from "ui";
import { currentPtu, patchPageData, siteLinks } from "../../../lib/patch-page";
import {
  builds,
  compareVersions,
  latestLive,
  shipMentions,
  snapshotOf,
} from "../../../lib/patches";
import { spectrumOn } from "../../../lib/data";
import { Site } from "../../../lib/site";
import { FigureStrip } from "../../strip";
import { PatchMasthead } from "../patch-masthead";
import { NotesList, PatchView, Section, Sources, day } from "../patch-view";

export const metadata: Metadata = {
  title: "What is changing on the PTU",
  alternates: { canonical: "/patches/ptu" },
  description:
    "The Star Citizen build in PTU testing against the current LIVE patch: CIG's notes for every wave, and the ships they name.",
};

/**
 * The PTU against LIVE (ADR-049). When a PTU build's figures are on record, it is a comparison
 * like any other; until then (the Wiki API keeps LIVE builds only) it is CIG's notes for the
 * build in testing, with the ships they name.
 */
export default function PtuPage() {
  const ptu = currentPtu();
  const live = latestLive();
  // A PTU snapshot counts only while it is ahead of LIVE: an older one has gone LIVE since.
  const recorded =
    builds()
      .filter(
        (b) =>
          b.channel === "PTU" &&
          (live === null || compareVersions(b.version, live.version) > 0),
      )
      .at(-1) ?? null;
  const data =
    recorded !== null && live !== null ? patchPageData(live, recorded) : null;

  const masthead = (
    <PatchMasthead
      tab="ptu"
      title="On the PTU"
      lede="What CIG is testing ahead of the next patch, against the LIVE build it will replace."
    />
  );

  if (data !== null) {
    return (
      <Site current="patches" stage={masthead}>
        <div className="flex flex-col gap-8 pt-8">
          <PatchView data={data} />
        </div>
      </Site>
    );
  }

  if (ptu === null) {
    return (
      <Site current="patches" stage={masthead}>
        <div className="flex flex-col gap-8 pt-8">
          {spectrumOn() ? (
            <EmptyState>
              No PTU build is in testing ahead of LIVE{" "}
              {live === null ? "" : live.version} as far as CIG&apos;s notes on
              record say.{" "}
              <TextLink href="/patches">
                See what changed in the latest patch
              </TextLink>
              .
            </EmptyState>
          ) : (
            <EmptyState>
              CIG posts the PTU&apos;s patch notes on Spectrum, which this site
              shows only while its developer posts are on. Until then they are
              in{" "}
              <TextLink
                href="https://robertsspaceindustries.com/spectrum/community/SC/forum/190048"
                external
              >
                Spectrum&apos;s Patch Notes channel
              </TextLink>
              .
            </EmptyState>
          )}
        </div>
      </Site>
    );
  }

  // The ships the notes name, matched against the newest LIVE build's names.
  const latest = live === null ? null : snapshotOf(live.code);
  const ships =
    latest === null
      ? []
      : Object.entries(latest.ships).map(([id, s]) => ({
          id,
          name: s.name,
          gameName: s.game_name,
        }));
  const mentions = shipMentions(ptu.notes, ships);
  const named = [...mentions.entries()]
    .map(([id, list]) => ({
      id,
      name: latest?.ships[id]?.name ?? id,
      href: siteLinks().ship(id),
      list,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const newest = ptu.notes[0];
  const laidOut = ptu.notes.filter((n) => !n.flat).length;

  return (
    <Site current="patches" stage={masthead}>
      <div className="flex flex-col gap-8 pt-8">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-hairline pb-4">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <span className="flex flex-col">
              <span className="text-heading text-primary">
                {ptu.version} PTU
              </span>
              <span className="font-mono text-caption text-secondary">
                {ptu.build === null
                  ? "build not stated"
                  : `${ptu.version}-PTU.${ptu.build}`}
                {newest === undefined
                  ? ""
                  : ` · ${day.format(new Date(newest.publishedAt))}`}
              </span>
            </span>
            {live === null ? null : (
              <>
                <span className="lab pb-1 text-muted">against</span>
                <span className="flex flex-col">
                  <span className="text-heading text-primary">
                    {live.version}
                  </span>
                  <span className="font-mono text-caption text-secondary">
                    {live.code}
                  </span>
                </span>
              </>
            )}
          </div>
        </div>

        <FigureStrip
          columns={3}
          figures={[
            {
              label: "PTU builds posted",
              value: formatNumber(ptu.notes.length),
              note:
                newest?.audience === null || newest === undefined
                  ? "by CIG"
                  : `newest for ${newest.audience}`,
              href: "#notes",
            },
            {
              label: "Ships named in the notes",
              value: formatNumber(named.length),
              note: "by full name",
              href: "#ships",
            },
            {
              label: "Figures on record",
              value: "None yet",
              short: "None",
              note: "LIVE builds only",
              href: "#figures",
            },
          ]}
        />

        <Section id="figures" title="Figures">
          <EmptyState>
            No figures for a PTU build are on record yet. The Star Citizen Wiki
            API keeps LIVE builds only; PTU figures arrive when the patch-day
            pipeline reads the PTU game files, and this page then compares them
            with LIVE {live?.version ?? ""} figure by figure, as the patch pages
            do.
          </EmptyState>
        </Section>

        <Section
          id="ships"
          title="Ships named in the notes"
          meta={
            named.length === 0
              ? undefined
              : `${formatNumber(named.length)} ships`
          }
        >
          {named.length === 0 ? (
            <EmptyState>
              The PTU notes on record name no ship by its full name.
            </EmptyState>
          ) : (
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
              {named.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-soft"
                >
                  <h3 className="m-0 text-ui font-medium text-primary">
                    {s.href === null ? (
                      s.name
                    ) : (
                      <TextLink href={s.href}>{s.name}</TextLink>
                    )}
                  </h3>
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {s.list.map((m) => (
                      <li
                        key={`${m.note.id}:${m.text}`}
                        className="rounded-control bg-inset px-3 py-2 text-ui text-secondary"
                      >
                        {m.text}
                        <span className="block text-caption text-muted">
                          {m.note.releaseCandidate ?? m.note.audience ?? "PTU"},{" "}
                          {day.format(new Date(m.note.publishedAt))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          id="notes"
          title="Patch notes"
          meta={`${formatNumber(ptu.notes.length)} posts, ${formatNumber(laidOut)} laid out here`}
        >
          <p className="m-0 max-w-prose text-ui text-secondary">
            Every PTU post CIG has made for {ptu.version}, newest first, in
            CIG&apos;s own sections. Each wave lists what changed since the wave
            before it.
          </p>
          <NotesList notes={ptu.notes} />
        </Section>

        <Sources unrecorded={0} />
      </div>
    </Site>
  );
}
