import type { Metadata } from "next";
import { EmptyState } from "ui";
import { Site } from "../../../lib/site";
import { NewsTabs } from "../tabs";

export const metadata: Metadata = { title: "Dev tracker" };

/** Spec 00: the dev tracker is an empty state until the Spectrum adapter lands. */
export default function DevTrackerPage() {
  return (
    <Site current="news">
      <div className="flex flex-col gap-8 pt-8">
        <h1 className="text-title text-primary">News</h1>
        <NewsTabs current="/news/dev" />
        <EmptyState>
          No developer posts yet. Posts by CIG staff on Spectrum appear here
          once the tracker is connected.
        </EmptyState>
      </div>
    </Site>
  );
}
