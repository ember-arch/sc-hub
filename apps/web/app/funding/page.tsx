import type { Metadata } from "next";
import { Masthead } from "../masthead";
import { FigureStrip } from "../strip";
import type { ReactNode } from "react";
import { EmptyState, SegmentedLinks, TextLink, formatNumber } from "ui";
import { FUNDING_INSPIRATION, WIKI_CREDIT } from "ui/legal";
import {
  MONTHS,
  type Measure,
  type YearRow,
  type Query,
  dailyRate,
  formatChange,
  formatCompact,
  formatDay,
  formatValue,
  funding,
  fundingHref,
  declines,
  gapTotal,
  headline,
  parseMeasure,
  readings,
  trailingTrend,
  yearPaths,
  yearRows,
} from "../../lib/funding";
import { Site } from "../../lib/site";
import {
  DailyHistory,
  MonthGrid,
  TrendLine,
  YearBars,
  YearVsYear,
} from "./charts";
import { RunningTotal } from "./running-total";

export const metadata: Metadata = {
  title: "Funding",
  alternates: { canonical: "/funding" },
  description:
    "How Star Citizen's crowdfunding has grown: pledges and citizens by year and month, this year against the last two, and the trailing-year trend, from RSI's public counters.",
};

/** A gap this long is drawn dashed on the running total and named under the month grid. */
const LONG_GAP_DAYS = 60;
/** The round figure the running total marks: a presentation choice, located in the data. */
const MILESTONE_USD = 1_000_000_000;

const LABEL: Record<Measure, { noun: string; verb: string }> = {
  pledges: { noun: "pledged", verb: "raised" },
  citizens: { noun: "citizens", verb: "joined" },
};

function Section({
  id,
  title,
  intro,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly intro?: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="flex scroll-mt-8 flex-col gap-4 border-t border-hairline pt-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-heading`} className="m-0 text-heading text-primary">
          {title}
        </h2>
        {intro === undefined ? null : (
          <p className="m-0 max-w-prose text-ui text-secondary">{intro}</p>
        )}
      </div>
      {children}
    </section>
  );
}

/** A table of the same numbers, for readers who want them exact (dataviz: a table view exists). */
function TableView({
  rows,
  measure,
}: {
  readonly rows: readonly YearRow[];
  readonly measure: Measure;
}) {
  return (
    <details className="hidden text-ui md:block">
      <summary className="cursor-pointer text-secondary">
        Table of every month
      </summary>
      <table className="mt-3 w-full text-caption">
        <thead>
          <tr className="lab border-b border-hairline text-left text-secondary">
            <th scope="col" className="py-1 font-regular">
              Year
            </th>
            {MONTHS.map((m) => (
              <th key={m} scope="col" className="py-1 text-right font-regular">
                {m}
              </th>
            ))}
            <th scope="col" className="py-1 text-right font-regular">
              Year
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.year} className="border-t border-hairline">
              <th
                scope="row"
                className="py-1 text-left font-mono font-regular text-secondary"
              >
                {r.year}
              </th>
              {r.months.map((v, i) => (
                <td key={i} className="py-1 text-right font-mono text-primary">
                  {v === null ? "" : formatCompact(v, measure)}
                </td>
              ))}
              <td className="py-1 text-right font-mono text-primary">
                {r.total === null ? "" : formatCompact(r.total, measure)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/**
 * The ledger (ADR-018, ADR-020): RSI's pledge and citizen counters since 2012, the running total, by year and month, this year
 * against the last two, the trailing-year trend and every day's rate. The measure is URL state.
 */
export default async function FundingPage({
  searchParams,
}: {
  readonly searchParams: Promise<Query>;
}) {
  const series = funding();
  const measure = parseMeasure(await searchParams);

  if (series === null) {
    return (
      <Site current="funding">
        <div className="flex flex-col gap-8 pt-8">
          <h1 className="text-title text-primary">Funding</h1>
          <EmptyState>
            The funding history has not been copied yet. Run
            scripts/funding/fetch.ts to copy it.
          </EmptyState>
        </div>
      </Site>
    );
  }

  const list = readings(series, measure);
  const head = headline(list);
  const rows = yearRows(list);
  const latestYear = Number(list.at(-1)?.day.slice(0, 4));
  const paths = yearPaths(list, [latestYear, latestYear - 1, latestYear - 2]);
  const trend = trailingTrend(list);
  const daily = dailyRate(list);
  const fell = declines(list);
  const words = LABEL[measure];
  const longGap = series.source.gaps.find((g) => g.days >= LONG_GAP_DAYS);
  const crossed =
    measure === "pledges" && list.some((r) => r.value >= MILESTONE_USD);
  const longGapTotal = longGap === undefined ? null : gapTotal(list, longGap);

  return (
    <Site
      current="funding"
      stage={
        <Masthead
          eyebrow={[
            head === null
              ? "RSI's counters"
              : `${formatValue(head.latest.value, measure)} ${measure === "pledges" ? "pledged" : "citizens"}`,
            `${formatNumber(series.snapshots.length)} daily snapshots since ${formatDay(series.snapshots[0]?.day ?? "")}`,
            head === null || head.trailingChange === null
              ? "Star Citizen Wiki API"
              : `${formatChange(head.trailingChange)} year on year`,
          ]}
          title={
            measure === "pledges"
              ? "The ledger of pledges"
              : "The ledger of citizens"
          }
          lede="Star Citizen has been crowdfunded since 2012. RSI publishes two running counters, money pledged and citizens registered; the ledger reads them day by day: a line for the running total, a row for each year, a cell for each month."
          aside={
            <SegmentedLinks
              label="Measure"
              current={fundingHref(measure)}
              links={[
                { href: fundingHref("pledges"), label: "Pledges" },
                { href: fundingHref("citizens"), label: "Citizens" },
              ]}
            />
          }
        />
      }
    >
      <div className="flex flex-col gap-12 pt-8">
        {head === null ? null : (
          <FigureStrip
            columns={4}
            figures={[
              {
                label: measure === "pledges" ? "Total pledged" : "Citizens",
                value: formatValue(head.latest.value, measure),
                short: formatCompact(head.latest.value, measure),
                note: `as of ${formatDay(head.latest.day)}`,
              },
              {
                label: `${words.verb[0]?.toUpperCase()}${words.verb.slice(1)} this year`,
                value:
                  head.yearToDate === null
                    ? "unknown"
                    : formatCompact(head.yearToDate, measure),
                note:
                  head.yearToDateChange === null
                    ? "no comparison"
                    : `${formatChange(head.yearToDateChange)} on the same days of ${latestYear - 1}`,
              },
              {
                label: "Last 365 days",
                value:
                  head.trailing === null
                    ? "unknown"
                    : formatCompact(head.trailing, measure),
                note:
                  head.trailingChange === null
                    ? "no comparison"
                    : `${formatChange(head.trailingChange)} on the 365 before`,
              },
              {
                label: "Last 30 days",
                value:
                  head.last30 === null
                    ? "unknown"
                    : formatCompact(head.last30, measure),
                note: measure === "pledges" ? "pledged" : "joined",
              },
            ]}
          />
        )}

        <Section
          id="total"
          title="The running total"
          intro={`RSI's counter since the first snapshot. Solid where the API has readings; dashed where it has none for two months or more, joined across the gap, never estimated.${crossed ? " The point marks the first billion dollars." : ""}`}
        >
          <RunningTotal
            list={list}
            measure={measure}
            gapDays={LONG_GAP_DAYS}
            milestone={measure === "pledges" ? MILESTONE_USD : null}
          />
        </Section>

        <Section
          id="years"
          title="Year by year"
          intro={`The amount ${words.verb} in each calendar year. The current year is shown as far as it has got.`}
        >
          <YearBars rows={rows} measure={measure} />
        </Section>

        <Section
          id="months"
          title="Month by month"
          intro="Every month, shaded by size against the largest month on the grid. A dot means the API has no snapshot close enough to that month's ends to say."
        >
          <MonthGrid rows={rows} measure={measure} />
          {longGap === undefined ? null : (
            <p className="m-0 max-w-prose text-caption text-secondary">
              No snapshots from {formatDay(longGap.from)} to{" "}
              {formatDay(longGap.to)}
              {longGapTotal === null
                ? "."
                : `; across that stretch ${formatValue(longGapTotal, measure)} was ${words.verb} in total.`}
            </p>
          )}
          <TableView rows={rows} measure={measure} />
        </Section>

        {paths.length >= 2 ? (
          <Section
            id="year-vs-year"
            title={
              paths.length > 2
                ? "This year against the last two"
                : "This year against last year"
            }
            intro={`The running total ${words.verb} since 1 January, laid over the same days of ${paths.length > 2 ? "the two years before" : "last year"}.`}
          >
            <YearVsYear
              paths={paths}
              measure={measure}
              latestYear={latestYear}
            />
          </Section>
        ) : null}

        {trend.length >= 2 ? (
          <Section
            id="trend"
            title="Trailing-year trend"
            intro="For each day, the last 365 days against the 365 before them. Above zero, the campaign is growing faster than a year earlier; the line is read at its right-hand end."
          >
            <TrendLine points={trend} />
          </Section>
        ) : null}

        <Section
          id="daily"
          title="Every day since 2012"
          intro={`The amount ${words.verb} per day. Sales, events and the yearly expo stand out as spikes; a stretch with no snapshots is drawn as its average.`}
        >
          <DailyHistory points={daily} measure={measure} />
        </Section>

        <section
          id="sources"
          aria-labelledby="sources-heading"
          className="flex scroll-mt-8 flex-col gap-3 border-t border-hairline pt-8"
        >
          <h2 id="sources-heading" className="text-heading text-primary">
            Sources
          </h2>
          <p className="m-0 max-w-prose text-ui text-secondary">
            Daily snapshots of RSI&apos;s counters on{" "}
            <TextLink href={series.source.origin_url} external>
              robertsspaceindustries.com
            </TextLink>
            , as recorded by the{" "}
            <TextLink href={WIKI_CREDIT.url} external>
              Star Citizen Wiki API
            </TextLink>
            ; copied {formatDay(series.source.fetched_at.slice(0, 10))}. Months,
            years and comparisons are differences between snapshots; where the
            API has none within three days of a period&apos;s ends, the period
            is left blank rather than estimated.
            {fell.length === 0
              ? null
              : ` The counter read lower than the day before on ${fell.length} ${fell.length === 1 ? "day" : "days"} (${formatDay(fell[0]?.day ?? "")}${fell.length > 1 ? ` to ${formatDay(fell.at(-1)?.day ?? "")}` : ""}) and rose again; those days are shown as recorded.`}
            {series.source.dropped.length === 0
              ? null
              : ` ${series.source.dropped.length === 1 ? "One snapshot" : `${series.source.dropped.length} snapshots`} whose total fell to a fraction of the day before (${series.source.dropped.map((d) => formatDay(d.day)).join(", ")}) ${series.source.dropped.length === 1 ? "is" : "are"} left out as a recording failure.`}
          </p>
          <p className="m-0 max-w-prose text-ui text-secondary">
            {FUNDING_INSPIRATION.text}{" "}
            <TextLink href={FUNDING_INSPIRATION.url} external>
              {FUNDING_INSPIRATION.linkText}
            </TextLink>
            .
          </p>
        </section>
      </div>
    </Site>
  );
}
