import type { Metadata } from "next";
import { Badge, EmptyState, TextLink } from "ui";
import { patchPageData, patchRelease } from "../../lib/patch-page";
import {
  buildLabel,
  latestLive,
  previousOf,
  releaseNotesOf,
} from "../../lib/patches";
import { Site } from "../../lib/site";
import { AgainstControl, PatchMasthead } from "./patch-masthead";
import { PatchView, day } from "./patch-view";

export const metadata: Metadata = {
  title: "What changed",
  alternates: { canonical: "/patches" },
  description:
    "What changed in the latest Star Citizen patch: every ship, part and blueprint figure that moved since the LIVE build before it, with CIG's patch notes.",
};

/**
 * The latest patch (ADR-049): the newest LIVE build against the LIVE build before it. When CIG has
 * released a newer version than the figures on record (ADR-049, amended 2026-11-12), one line
 * above the comparison says so: the version, since when, that its figures follow when the Star
 * Citizen Wiki publishes the build, and CIG's release notes. The owner asked for the top to get
 * to the comparison (2026-11-13: "we dont need this running tally here"), so the PTU posts that
 * led to the release are not listed here; they join the comparison's notes once its figures do.
 */
export default function PatchesPage() {
  const to = latestLive();
  const from = to === null ? null : previousOf(to);
  const data = to === null || from === null ? null : patchPageData(from, to);
  const ahead = patchRelease();
  // CIG's release notes for the version, else RSI's official notes.
  const release = ahead === null ? null : releaseNotesOf(ahead);
  return (
    <Site
      current="patches"
      stage={
        <PatchMasthead
          tab="live"
          title="What changed"
          lede="Every ship, part and blueprint figure that moved in the latest patch, sorted the way CIG sorts its notes, with those notes beside them."
        />
      }
    >
      <div className="flex flex-col gap-8 pt-8">
        {ahead === null || to === null || from === null ? null : (
          <section
            id="released"
            aria-labelledby="released-title"
            className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3 shadow-soft md:flex-row md:items-baseline md:gap-4 md:px-6"
          >
            <div className="flex shrink-0 items-baseline gap-2">
              <Badge tone="success">LIVE</Badge>
              <h2
                id="released-title"
                className="m-0 text-ui font-medium text-primary"
              >
                {ahead.version} is live
              </h2>
            </div>
            <p className="m-0 text-ui text-secondary md:flex-1">
              Since {day.format(new Date(ahead.releasedAt))}. Its figures follow
              when the Star Citizen Wiki publishes the build; until then, below:{" "}
              {buildLabel(to, from)} against {buildLabel(from, to)}.
            </p>
            {release === null ? null : (
              <TextLink href={release.url} external>
                {release.kind === "official" ? "Patch notes" : "Release notes"}{" "}
                for {ahead.version}
              </TextLink>
            )}
          </section>
        )}
        {data === null || to === null || from === null ? (
          <EmptyState>
            A comparison needs two LIVE builds, and fewer are on record yet.
          </EmptyState>
        ) : (
          <PatchView
            data={data}
            compare={<AgainstControl to={to} from={from} />}
          />
        )}
      </div>
    </Site>
  );
}
