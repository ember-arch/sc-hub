import type { Metadata } from "next";
import { EmptyState, TextLink } from "ui";
import { currentRelease, patchPageData } from "../../lib/patch-page";
import {
  buildLabel,
  latestLive,
  previousOf,
  releaseNotesOf,
} from "../../lib/patches";
import { Site } from "../../lib/site";
import { AgainstControl, PatchMasthead } from "./patch-masthead";
import { NotesList, PatchView, Section, day } from "./patch-view";

export const metadata: Metadata = {
  title: "What changed",
  alternates: { canonical: "/patches" },
  description:
    "What changed in the latest Star Citizen patch: every ship, part and blueprint figure that moved since the LIVE build before it, with CIG's patch notes.",
};

/**
 * The latest patch (ADR-049): the newest LIVE build against the LIVE build before it. When CIG has
 * released a newer version than the figures on record (ADR-049, amended 2026-11-12), the page
 * leads with it: that it is live, since when, and CIG's notes for it, its figures to follow when
 * the Star Citizen Wiki publishes the build; the comparison on record stands under it.
 */
export default function PatchesPage() {
  const to = latestLive();
  const from = to === null ? null : previousOf(to);
  const data = to === null || from === null ? null : patchPageData(from, to);
  const ahead = currentRelease();
  // CIG's release notes for the version (else RSI's official notes), linked first: the pack may
  // hold them as one run of text, which the list below folds away with the other linked posts.
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
        {ahead === null || to === null ? null : (
          <Section
            id="released"
            title={`${ahead.version} is live`}
            meta={`Released ${day.format(new Date(ahead.releasedAt))}`}
          >
            <p className="m-0 max-w-prose text-body text-secondary">
              CIG put {ahead.version} out on LIVE on{" "}
              {day.format(new Date(ahead.releasedAt))}. Its ship, part and
              blueprint figures come from the Star Citizen Wiki, which has not
              published this build yet; the daily refresh adds them the morning
              after it does, and this page then compares {ahead.version} with{" "}
              {to.version}.
              {release === null ? null : (
                <>
                  {" "}
                  CIG&apos;s{" "}
                  <TextLink href={release.url} external>
                    {release.kind === "official"
                      ? "patch notes"
                      : "release notes"}{" "}
                    for {ahead.version}
                  </TextLink>{" "}
                  say what it brings.
                </>
              )}{" "}
              CIG&apos;s posts on it follow.
            </p>
            {/* Folded, so the comparison on record is not pushed far down the page. */}
            <NotesList notes={ahead.notes} openFirst={false} />
          </Section>
        )}
        {data === null || to === null || from === null ? (
          <EmptyState>
            A comparison needs two LIVE builds, and fewer are on record yet.
          </EmptyState>
        ) : ahead === null ? (
          <PatchView
            data={data}
            compare={<AgainstControl to={to} from={from} />}
          />
        ) : (
          <Section
            id="on-record"
            title={`Before it: ${buildLabel(to, from)} against ${buildLabel(from, to)}`}
            meta="The latest figures on record"
          >
            <PatchView
              data={data}
              compare={<AgainstControl to={to} from={from} />}
            />
          </Section>
        )}
      </div>
    </Site>
  );
}
