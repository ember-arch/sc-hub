import { FilterBar, FilterSelect, formatNumber } from "ui";
import { spectrumOn } from "../../lib/data";
import { currentPtu, currentRelease } from "../../lib/patch-page";
import { type Build, builds, latestLive } from "../../lib/patches";
import { Masthead } from "../masthead";
import { type PatchTab, PatchTabs, day } from "./patch-view";

/**
 * The patch pages' masthead (ADR-049): what is on record, the page's title, and the three ways
 * in (the latest patch, the PTU, any two builds) as one control on the right.
 */
export function PatchMasthead({
  tab,
  title,
  lede,
}: {
  readonly tab: PatchTab;
  readonly title: string;
  readonly lede: string;
}) {
  const list = builds();
  const live = latestLive(list);
  const ptu = currentPtu();
  // A version CIG has released ahead of the figures on record leads (ADR-049, amended).
  const ahead = currentRelease();
  const eyebrow = [
    ...(ahead === null
      ? []
      : [`LIVE ${ahead.version}, ${day.format(new Date(ahead.releasedAt))}`]),
    live === null
      ? "No LIVE build on record"
      : `${ahead === null ? "LIVE" : "Figures from"} ${live.version}${live.releasedAt === null ? "" : `, ${day.format(new Date(live.releasedAt))}`}`,
    ptu !== null
      ? `PTU ${ptu.version} in testing`
      : spectrumOn()
        ? "No PTU build in testing"
        : "PTU notes on Spectrum",
    `${formatNumber(list.length)} ${list.length === 1 ? "build" : "builds"} on record`,
  ];
  return (
    <Masthead
      eyebrow={eyebrow}
      title={title}
      lede={lede}
      aside={
        <PatchTabs
          current={tab}
          live={ahead?.version ?? live?.version ?? null}
          ptu={ptu?.version ?? null}
        />
      }
    />
  );
}

/** The builds as select options, newest first. */
export function buildOptions(list: readonly Build[] = builds()) {
  return [...list].reverse().map((b) => ({
    value: b.slug,
    label: `${b.channel === "LIVE" ? b.version : `${b.version} ${b.channel}`}${b.slug.includes("-") && b.channel === "LIVE" ? ` (build ${b.number})` : ""}${b.releasedAt === null ? "" : `, ${day.format(new Date(b.releasedAt))}`}`,
  }));
}

/** "Against another build": compares this page's build with any build on record. */
export function AgainstControl({
  to,
  from,
}: {
  readonly to: Build;
  readonly from: Build;
}) {
  const options = buildOptions().filter((o) => o.value !== to.slug);
  return (
    <FilterBar
      action="/patches/compare"
      label="Compare with another build"
      hidden={{ to: to.slug }}
    >
      <FilterSelect
        name="from"
        label="Against"
        allLabel="Choose a build"
        value={from.slug}
        options={options}
      />
    </FilterBar>
  );
}
