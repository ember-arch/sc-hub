import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pairFor, patchPageData } from "../../../lib/patch-page";
import { buildLabel, builds, latestLive } from "../../../lib/patches";
import { Site } from "../../../lib/site";
import { AgainstControl, PatchMasthead } from "../patch-masthead";
import { PatchView } from "../patch-view";

type Params = { readonly build: string };

/** Every LIVE build with one before it has a page. */
export function generateStaticParams(): Params[] {
  const list = builds();
  return list
    .filter((b) => pairFor(b.slug) !== null)
    .map((b) => ({ build: b.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { build } = await params;
  const pair = pairFor(build);
  if (pair === null) return { title: "Patch not found" };
  // The newest patch is also /patches; that address is its canonical one.
  const latest = pair.to.code === latestLive()?.code;
  return {
    title: `What changed in ${buildLabel(pair.to, pair.from)}`,
    alternates: { canonical: latest ? "/patches" : `/patches/${pair.to.slug}` },
    description: `Every Star Citizen ship, part and blueprint figure that changed in ${buildLabel(pair.to, pair.from)} (${pair.to.code}) since ${buildLabel(pair.from, pair.to)}, with CIG's patch notes.`,
  };
}

/** One patch (ADR-049): a LIVE build against the LIVE build before it. */
export default async function PatchPage({
  params,
}: {
  readonly params: Promise<Params>;
}) {
  const { build } = await params;
  const pair = pairFor(build);
  if (pair === null) notFound();
  const data = patchPageData(pair.from, pair.to);
  if (data === null) notFound();
  return (
    <Site
      current="patches"
      stage={
        <PatchMasthead
          tab="history"
          title={`What changed in ${buildLabel(pair.to, pair.from)}`}
          lede={`Every ship, part and blueprint figure that moved between ${buildLabel(pair.from, pair.to)} and ${buildLabel(pair.to, pair.from)}, with CIG's notes for the builds between.`}
        />
      }
    >
      <div className="flex flex-col gap-8 pt-8">
        <PatchView
          data={data}
          compare={<AgainstControl to={pair.to} from={pair.from} />}
        />
      </div>
    </Site>
  );
}
