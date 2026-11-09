import type { Metadata } from "next";
import { bandArt } from "../../lib/bands";
import { Masthead } from "../masthead";
import type { ReactNode } from "react";
import type { Title, TitleCatalog } from "schema";
import {
  EmptyState,
  FilterBar,
  FilterSelect,
  TextLink,
  formatNumber,
} from "ui";
import { TITLES_TEXT_CREDIT, TITLE_ICON_CREDIT } from "ui/legal";
import { Site } from "../../lib/site";
import { titleIcon } from "../../lib/title-icons";
import {
  GROUP_LABELS,
  type Query,
  STATUS_OPTIONS,
  type TitleSection,
  countLine,
  filterTitles,
  groupSlug,
  guideGrid,
  hasTitleFilters,
  parseTitleQuery,
  statusOf,
  titleCatalog,
  titleSections,
  wikiText,
} from "../../lib/titles";
import { TitleSearch } from "./title-search";
import {
  GuideGridView,
  LadderTile,
  StatusBadge,
  TitleCard,
  WikiTextView,
} from "./title-views";

// The canonical is the unfiltered page: filters are views of one page, not pages of their own.
export const metadata: Metadata = {
  title: "Titles",
  alternates: { canonical: "/titles" },
  description:
    "Every Star Citizen title, the badges shown beside a player's name on Spectrum and the citizen dossier, grouped by how each is earned.",
};

const day = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** One status for the whole list, or null when it is mixed (then each title shows its own). */
function sharedStatus(titles: readonly Title[]) {
  const statuses = new Set(titles.map(statusOf));
  const [only] = statuses;
  return statuses.size === 1 && only !== undefined ? only : null;
}

function Ladder({ titles }: { readonly titles: readonly Title[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3 xl:grid-cols-4">
      {titles.map((t) => (
        <LadderTile key={t.slug} title={t} icon={titleIcon(t)} />
      ))}
    </ul>
  );
}

function Cards({ titles }: { readonly titles: readonly Title[] }) {
  const showStatus = sharedStatus(titles) === null;
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
      {titles.map((t) => (
        <TitleCard
          key={t.slug}
          title={t}
          icon={titleIcon(t)}
          showStatus={showStatus}
        />
      ))}
    </ul>
  );
}

function SubBlock({
  heading,
  titles,
  children,
}: {
  readonly heading: string;
  readonly titles: readonly Title[];
  readonly children: ReactNode;
}) {
  const status = sharedStatus(titles);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="m-0 text-ui font-medium text-primary">{heading}</h3>
        {status === null ? null : <StatusBadge status={status} />}
      </div>
      {children}
    </div>
  );
}

/** Each group in the shape that suits it: ladders, the guide grid, or cards with the wiki's sentence. */
function SectionBody({ section }: { readonly section: TitleSection }) {
  const titles = section.titles;
  if (section.group === "backer") return <Ladder titles={titles} />;
  if (section.group === "recruitment") {
    const ladder = titles.filter((t) => t.requirement?.kind === "recruits");
    const bonus = titles.filter(
      (t) => t.requirement?.kind === "recruitment_period",
    );
    return (
      <>
        {ladder.length > 0 ? <Ladder titles={ladder} /> : null}
        {bonus.length > 0 ? (
          <SubBlock heading="Bonus titles" titles={bonus}>
            <Cards titles={bonus} />
          </SubBlock>
        ) : null}
      </>
    );
  }
  if (section.group === "guide") {
    const grid = guideGrid(titles);
    const special = titles.filter((t) => t.requirement === null);
    return (
      <>
        {grid.tracks.length > 0 ? (
          <GuideGridView grid={grid} iconFor={titleIcon} />
        ) : null}
        {special.length > 0 ? (
          <SubBlock heading="Special titles" titles={special}>
            <Cards titles={special} />
          </SubBlock>
        ) : null}
      </>
    );
  }
  return <Cards titles={titles} />;
}

function Sources({
  catalog,
  icons,
}: {
  readonly catalog: TitleCatalog;
  readonly icons: boolean;
}) {
  const source = catalog.source;
  return (
    <section
      id="sources"
      aria-labelledby="sources-heading"
      className="flex scroll-mt-8 flex-col gap-3 border-t border-hairline pt-8"
    >
      <h2 id="sources-heading" className="text-heading text-primary">
        Sources
      </h2>
      <p className="m-0 max-w-prose text-ui text-secondary">
        The titles, their groups and every sentence about how each is earned
        come from the{" "}
        <TextLink href={TITLES_TEXT_CREDIT.url} external>
          Titles article
        </TextLink>{" "}
        on the Star Citizen Wiki (starcitizen.tools), as of its{" "}
        <TextLink href={source.revision_url} external>
          revision of {day.format(new Date(source.edited_at))}
        </TextLink>
        , written by the{" "}
        <TextLink href={TITLES_TEXT_CREDIT.historyUrl} external>
          wiki&apos;s contributors
        </TextLink>
        . That text is licensed{" "}
        <TextLink href={TITLES_TEXT_CREDIT.licenceUrl} external>
          {TITLES_TEXT_CREDIT.licence}
        </TextLink>{" "}
        and stays under that licence here. {TITLES_TEXT_CREDIT.changes} Copied{" "}
        {day.format(new Date(source.fetched_at))}.
      </p>
      {icons ? (
        <p className="m-0 max-w-prose text-ui text-secondary">
          {TITLE_ICON_CREDIT.text}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Titles (ADR-017): every title, grouped as the wiki groups them by how each is earned, with
 * search, group and status as URL state. Icons show only where they were built locally.
 */
export default async function TitlesPage({
  searchParams,
}: {
  readonly searchParams: Promise<Query>;
}) {
  const catalog = titleCatalog();
  const query = parseTitleQuery(await searchParams);

  if (catalog === null) {
    return (
      <Site current="titles">
        <div className="flex flex-col gap-8 pt-8">
          <h1 className="text-title text-primary">Titles</h1>
          <EmptyState>
            The titles have not been copied yet. Run scripts/titles/fetch.ts to
            copy them.
          </EmptyState>
        </div>
      </Site>
    );
  }

  const shown = filterTitles(catalog.titles, query);
  const sections = titleSections(catalog, shown);
  const filtered = hasTitleFilters(query);
  const total = catalog.titles.length;
  const earnable = catalog.titles.filter((t) => t.earnable === "yes").length;
  const icons = catalog.titles.some((t) => titleIcon(t) !== null);

  return (
    <Site
      current="titles"
      stage={
        <Masthead
          eyebrow={[
            `${formatNumber(total)} titles`,
            `${catalog.groups.length} groups`,
            `${formatNumber(earnable)} still earnable`,
          ]}
          title="Titles"
          lede={wikiText(catalog.lead[0] ?? [])}
          art={bandArt("titles")}
        />
      }
    >
      <div className="flex flex-col gap-8 pt-8">
        <header className="flex flex-col gap-3">
          {catalog.lead.slice(1).map((p, i) => (
            <p key={i} className="m-0 max-w-prose text-body text-secondary">
              <WikiTextView runs={p} />
            </p>
          ))}
          <p className="m-0 text-caption text-secondary">
            Text from the <TextLink href="#sources">Star Citizen Wiki</TextLink>
            , {TITLES_TEXT_CREDIT.licence}
          </p>
        </header>

        <div className="flex flex-col gap-2">
          <FilterBar
            action="/titles"
            label="Filter titles"
            clearHref={filtered ? "/titles" : undefined}
          >
            <TitleSearch value={query.q} />
            <FilterSelect
              name="group"
              label="Group"
              allLabel="All groups"
              value={query.group === null ? "" : groupSlug(query.group)}
              options={catalog.groups.map((g) => ({
                value: groupSlug(g.group),
                label: GROUP_LABELS[g.group],
              }))}
            />
            <FilterSelect
              name="status"
              label="Status"
              allLabel="Any status"
              value={query.status ?? ""}
              options={STATUS_OPTIONS}
            />
          </FilterBar>
          <p
            role="status"
            className="m-0 text-caption text-secondary"
            data-testid="title-count"
          >
            {filtered
              ? `${formatNumber(shown.length)} of ${formatNumber(total)} titles`
              : ""}
          </p>
        </div>

        {sections.length === 0 ? (
          <EmptyState>
            No titles match these filters.{" "}
            <TextLink href="/titles">Clear filters</TextLink> to see every
            title.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-8 lg:grid lg:grid-cols-5">
            <nav aria-label="Title groups" className="lg:col-span-1">
              <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 lg:sticky lg:top-8 lg:flex-col lg:gap-1">
                {sections.map((s) => (
                  <li key={s.group}>
                    <a
                      href={`#${groupSlug(s.group)}`}
                      aria-label={`${s.label}, ${formatNumber(s.titles.length)} ${s.titles.length === 1 ? "title" : "titles"}`}
                      className="flex items-baseline justify-between gap-2 rounded-control text-ui text-secondary no-underline transition-colors duration-hover hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <span>{s.label}</span>
                      <span className="font-mono text-caption text-muted">
                        {formatNumber(s.titles.length)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex min-w-0 flex-col gap-12 lg:col-span-4">
              {sections.map((s) => {
                const slug = groupSlug(s.group);
                return (
                  <section
                    key={s.group}
                    id={slug}
                    aria-labelledby={`${slug}-heading`}
                    className="flex scroll-mt-8 flex-col gap-4"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2
                        id={`${slug}-heading`}
                        className="text-heading text-primary"
                      >
                        {s.label}
                      </h2>
                      <p className="m-0 text-caption text-secondary">
                        {countLine(s.titles, s.total, filtered)}
                      </p>
                    </div>
                    {s.intro.map((p, i) => (
                      <p
                        key={i}
                        className="m-0 max-w-prose break-words text-ui text-secondary"
                      >
                        <WikiTextView runs={p} />
                      </p>
                    ))}
                    <SectionBody section={s} />
                  </section>
                );
              })}
            </div>
          </div>
        )}

        <Sources catalog={catalog} icons={icons} />
      </div>
    </Site>
  );
}
