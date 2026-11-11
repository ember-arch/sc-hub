import type { Metadata } from "next";
import { EmptyState } from "ui";
import { patchPageData } from "../../lib/patch-page";
import { latestLive, previousOf } from "../../lib/patches";
import { Site } from "../../lib/site";
import { AgainstControl, PatchMasthead } from "./patch-masthead";
import { PatchView } from "./patch-view";

export const metadata: Metadata = {
  title: "What changed",
  alternates: { canonical: "/patches" },
  description:
    "What changed in the latest Star Citizen patch: every ship, part and blueprint figure that moved since the LIVE build before it, with CIG's patch notes.",
};

/** The latest patch (ADR-049): the newest LIVE build against the LIVE build before it. */
export default function PatchesPage() {
  const to = latestLive();
  const from = to === null ? null : previousOf(to);
  const data = to === null || from === null ? null : patchPageData(from, to);
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
        {data === null || to === null || from === null ? (
          <EmptyState>
            Two LIVE builds are needed for a comparison and fewer are on record.
            Run scripts/patches/fetch.ts to record them.
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
