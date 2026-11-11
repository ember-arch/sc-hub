import type { Metadata } from "next";
import { EmptyState, FilterBar, FilterSelect, TextLink } from "ui";
import { patchPageData } from "../../../lib/patch-page";
import {
  type Build,
  builds,
  latestLive,
  previousOf,
} from "../../../lib/patches";
import { Site } from "../../../lib/site";
import { PatchMasthead, buildOptions } from "../patch-masthead";
import { PatchView } from "../patch-view";

export const metadata: Metadata = {
  title: "Compare builds",
  // One page whatever the pair: the pairs are views of it.
  alternates: { canonical: "/patches/compare" },
  description:
    "Compare any two Star Citizen builds on record: every ship, part and blueprint figure that changed between them, with CIG's patch notes for the builds between.",
};

type Query = {
  readonly from?: string | string[];
  readonly to?: string | string[];
};

const one = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

/** Any two builds (ADR-049), oldest on the left whichever order they are picked in. */
export default async function ComparePage({
  searchParams,
}: {
  readonly searchParams: Promise<Query>;
}) {
  const q = await searchParams;
  const list = builds();
  const bySlug = (slug: string): Build | null =>
    list.find((b) => b.slug === slug) ?? null;
  const latest = latestLive(list);
  let to = bySlug(one(q.to)) ?? latest;
  let from = bySlug(one(q.from)) ?? (to === null ? null : previousOf(to, list));
  if (from !== null && to !== null && list.indexOf(from) > list.indexOf(to)) {
    [from, to] = [to, from];
  }
  const same = from !== null && to !== null && from.code === to.code;
  const data =
    from === null || to === null || same ? null : patchPageData(from, to);

  const options = buildOptions(list);
  const picker = (
    <FilterBar action="/patches/compare" label="Pick two builds">
      <FilterSelect
        name="from"
        label="From"
        allLabel="Choose a build"
        value={from?.slug ?? ""}
        options={options}
      />
      <FilterSelect
        name="to"
        label="To"
        allLabel="Choose a build"
        value={to?.slug ?? ""}
        options={options}
      />
    </FilterBar>
  );

  return (
    <Site
      current="patches"
      stage={
        <PatchMasthead
          tab="compare"
          title="Compare builds"
          lede="Any two builds on record, side by side: everything that moved between them, however many patches apart."
        />
      }
    >
      <div className="flex flex-col gap-8 pt-8">
        {data === null ? (
          <>
            {picker}
            <EmptyState>
              {same
                ? "Pick two different builds to compare."
                : "Two builds are needed for a comparison and fewer are on record."}{" "}
              <TextLink href="/patches">See the latest patch</TextLink>.
            </EmptyState>
          </>
        ) : (
          <PatchView data={data} compare={picker} />
        )}
      </div>
    </Site>
  );
}
