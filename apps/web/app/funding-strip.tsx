import NextLink from "next/link";
import {
  formatChange,
  formatCompact,
  formatDay,
  formatValue,
  funding,
  headline,
  readings,
} from "../lib/funding";

/**
 * The live counters on the home page (ADR-019): money pledged, citizens and this year against
 * last, from the same daily snapshots as the funding page. Nothing without the fixture.
 */
export function FundingStrip() {
  const series = funding();
  if (series === null) return null;
  const money = headline(readings(series, "pledges"));
  const people = headline(readings(series, "citizens"));
  if (money === null || people === null) return null;
  const figures = [
    {
      label: "Pledged since 2012",
      value: formatValue(money.latest.value, "pledges"),
      note: `as of ${formatDay(money.latest.day)}`,
    },
    {
      label: "Citizens",
      value: formatValue(people.latest.value, "citizens"),
      note: `${people.last30 === null ? "" : `${formatCompact(people.last30, "citizens")} joined in the last 30 days`}`,
    },
    {
      label: "Raised this year",
      value:
        money.yearToDate === null
          ? "unknown"
          : formatCompact(money.yearToDate, "pledges"),
      note:
        money.yearToDateChange === null
          ? ""
          : `${formatChange(money.yearToDateChange)} on the same days last year`,
    },
  ];
  return (
    <NextLink
      href="/funding"
      aria-label="Funding: the counters by month and year"
      className="group grid grid-cols-1 gap-px overflow-hidden rounded-card border border-hairline bg-hairline no-underline transition-colors duration-hover hover:border-hairline-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent md:grid-cols-3"
    >
      {figures.map((f) => (
        <span key={f.label} className="flex flex-col gap-1 bg-surface p-4">
          <span className="text-caption text-secondary">{f.label}</span>
          <span className="font-mono text-heading text-primary group-hover:text-accent">
            {f.value}
          </span>
          {f.note === "" ? null : (
            <span className="text-caption text-secondary">{f.note}</span>
          )}
        </span>
      ))}
    </NextLink>
  );
}
