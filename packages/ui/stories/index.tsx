import type {
  Author,
  ContentItem,
  GameVersion,
  Item,
  ItemStats,
  Manufacturer,
  Vehicle,
  VehicleStats,
} from "schema";
import { VehicleStatus } from "schema";
import type { ReactNode } from "react";
import { Badge } from "../components/badge";
import { Card } from "../components/card";
import { CommandPalette } from "../components/command-palette";
import { DevPost } from "../components/dev-post";
import {
  EmptyState,
  EntityPage,
  Hero,
  KeyFacts,
  Section,
} from "../components/entity-page";
import { DispatchCard } from "../components/dispatch-card";
import { FeedItem } from "../components/feed-item";
import { FilterBar, FilterSelect } from "../components/filter-bar";
import { Footer } from "../components/footer";
import { formatNumber, sentence } from "../components/format";
import { PageShell } from "../components/page-shell";
import { PatchStrip } from "../components/patch-strip";
import type { SearchEntry } from "../components/search-match";
import { SegmentedLinks } from "../components/segmented-links";
import { StatList, StatRow } from "../components/stat-row";
import { StatsByChannel } from "../components/stats-by-channel";
import { ThemeToggle } from "../components/theme-toggle";
import { Logo } from "../components/logo";
import { ICON_NAMES, Icon } from "../components/icon";
import { SITE_NAME } from "../brand";
import { channelBadge, vehicleStatusBadge } from "../components/status";
import { DataTableStory } from "./data-table-story";
import { storyMeta } from "./ids";

/**
 * Light and dark stories for every Phase 0 component (system.md section 3). Stories take their
 * data from fixtures (CLAUDE.md section 2: never hand-enter game data), so the gallery route in
 * apps/web loads the bootstrap pack and hands rows in; nothing here types a stat, a version or a
 * status that the pack or the schema does not hold. Playwright screenshots each story into
 * packages/ui/__screenshots__/. Ids and widths live in ids.ts so the spec can import them.
 */

export interface StorySample {
  readonly vehicle: Vehicle;
  readonly stats: VehicleStats;
  readonly manufacturer: Manufacturer;
  readonly items: readonly Item[];
  readonly itemStats: readonly ItemStats[];
  readonly versions: readonly GameVersion[];
  readonly news: readonly ContentItem[];
  readonly author: Author;
  readonly devPost: ContentItem;
  /** ISO timestamp used as "now" so relative times are stable in screenshots. */
  readonly now: string;
}

export interface Story {
  readonly id: string;
  readonly title: string;
  /** Viewport width for the screenshot. */
  readonly width: number;
  readonly render: (sample: StorySample) => ReactNode;
}

const versions = (sample: StorySample) =>
  sample.versions
    .filter((v) => v.is_current)
    .map((v) => ({ channel: v.channel, version: v.version }));

const liveVersion = (sample: StorySample): string =>
  versions(sample).find((v) => v.channel === "LIVE")?.version ??
  sample.stats.game_version;

const entries = (sample: StorySample): SearchEntry[] => [
  {
    type: "ship",
    name: sample.vehicle.name,
    href: `/ships/${sample.vehicle.slug}`,
    meta: sample.manufacturer.name,
  },
  ...sample.items.slice(0, 8).map((item) => ({
    type: "component" as const,
    name: item.name,
    href: `/components/${item.slug}`,
    meta: sentence(item.type),
  })),
  {
    type: "manufacturer",
    name: sample.manufacturer.name,
    href: `/manufacturers/${sample.manufacturer.slug}`,
  },
];

const crew = (s: StorySample): string =>
  s.stats.crew_min === s.stats.crew_max
    ? String(s.stats.crew_min)
    : `${s.stats.crew_min}–${s.stats.crew_max}`;

const card = (s: StorySample) => ({
  href: `/ships/${s.vehicle.slug}`,
  name: s.vehicle.name,
  manufacturer: s.manufacturer.name,
  role: s.vehicle.role,
  stats: [
    { label: "Crew", value: crew(s) },
    { label: "Cargo", value: s.stats.cargo_scu, unit: "SCU" },
  ] as const,
});

/** Filter options come from the sample's rows: the manufacturer, the ship's size class and the item sizes. */
function FilterBarStory({ sample }: { readonly sample: StorySample }) {
  const sizes = [...new Set(sample.items.map((i) => i.size))].sort(
    (a, b) => a - b,
  );
  return (
    <FilterBar
      action="/ships"
      label="Filter ships"
      clearHref="/ships"
      hidden={{ view: "table" }}
    >
      <FilterSelect
        name="manufacturer"
        label="Manufacturer"
        allLabel="All manufacturers"
        value={sample.manufacturer.slug}
        options={[
          { value: sample.manufacturer.slug, label: sample.manufacturer.name },
        ]}
      />
      <FilterSelect
        name="size"
        label="Size"
        allLabel="All sizes"
        value=""
        options={
          sample.vehicle.size_class === null
            ? []
            : [
                {
                  value: sample.vehicle.size_class,
                  label: sentence(sample.vehicle.size_class),
                },
              ]
        }
      />
      <FilterSelect
        name="item-size"
        label="Component size"
        allLabel="All sizes"
        value=""
        options={sizes.map((size) => ({
          value: String(size),
          label: `Size ${size}`,
        }))}
      />
    </FilterBar>
  );
}

const renderers: Record<string, { title: string; render: Story["render"] }> = {
  badge: {
    title: "Badge",
    render: () => (
      <div className="flex flex-wrap gap-2">
        {VehicleStatus.options.map((status) => {
          const badge = vehicleStatusBadge(status);
          return (
            <Badge key={status} tone={badge.tone}>
              {badge.label}
            </Badge>
          );
        })}
        <Badge tone={channelBadge("PTU").tone}>
          {channelBadge("PTU").label}
        </Badge>
      </div>
    ),
  },
  "stat-row": {
    title: "StatRow",
    render: (s) => (
      <StatList>
        <StatRow label="Length" value={s.stats.length_m} unit="m" digits={2} />
        <StatRow label="Mass" value={s.stats.mass_kg} unit="kg" />
        <StatRow label="SCM speed" value={s.stats.scm_speed} unit="m/s" />
        <StatRow label="Cargo" value={s.stats.cargo_scu} unit="SCU" />
        <StatRow label="Hydrogen fuel" value={s.stats.hydrogen_fuel} />
      </StatList>
    ),
  },
  "key-facts": {
    title: "KeyFacts",
    render: (s) => (
      <KeyFacts
        facts={[
          { label: "Role", value: s.vehicle.role },
          {
            label: "Size",
            value:
              s.vehicle.size_class === null
                ? null
                : sentence(s.vehicle.size_class),
          },
          { label: "Crew", value: crew(s), numeric: true },
          { label: "Cargo", value: s.stats.cargo_scu, unit: "SCU" },
          {
            label: "Length",
            value: formatNumber(s.stats.length_m, 2),
            unit: "m",
            numeric: true,
          },
          {
            label: "Mass",
            value: formatNumber(s.stats.mass_kg),
            unit: "kg",
            numeric: true,
          },
        ]}
      />
    ),
  },
  hero: {
    title: "Hero",
    render: (s) => (
      <Hero
        name={s.vehicle.name}
        kicker={{
          label: s.manufacturer.name,
          href: `/manufacturers/${s.manufacturer.slug}`,
        }}
        status={vehicleStatusBadge(s.vehicle.status)}
        image={null}
        placeholder="No image yet"
      />
    ),
  },
  section: {
    title: "Section and EmptyState",
    render: (s) => (
      <Section
        id="ptu"
        title="PTU differences"
        aside={`LIVE ${liveVersion(s)}`}
      >
        <EmptyState>No PTU differences for this version.</EmptyState>
      </Section>
    ),
  },
  card: {
    title: "Card",
    render: (s) => <Card {...card(s)} />,
  },
  "data-table": {
    title: "DataTable",
    render: (s) => <DataTableStory items={s.items.slice(0, 8)} />,
  },
  "data-table-phone": {
    title: "DataTable on phone",
    render: (s) => <DataTableStory items={s.items.slice(0, 4)} phone />,
  },
  "feed-item": {
    title: "FeedItem",
    render: (s) => {
      const item = s.news[0] ?? s.devPost;
      return (
        <FeedItem
          source={sentence(item.source)}
          title={item.title}
          sourceUrl={item.url}
          publishedAt={item.published_at}
          now={new Date(s.now)}
          excerpt={item.summary}
          entities={[
            { name: s.vehicle.name, href: `/ships/${s.vehicle.slug}` },
          ]}
        />
      );
    },
  },
  "dispatch-card": {
    title: "DispatchCard",
    // Without media (CI, a deployment) the card is its words alone, as the page shows it there.
    render: (s) => {
      const item = s.news.find((n) => n.source !== "spectrum") ?? s.devPost;
      return (
        <DispatchCard
          source={sentence(item.source)}
          title={item.title}
          sourceUrl={item.url}
          publishedAt={item.published_at}
          now={new Date(s.now)}
          excerpt={item.summary}
          picture={null}
        />
      );
    },
  },
  "dev-post": {
    title: "DevPost",
    render: (s) => (
      <DevPost
        title={s.devPost.thread_title ?? s.devPost.title}
        author={{
          name: s.author.display_name,
          role: s.author.role,
          href: "/news/dev",
        }}
        publishedAt={s.devPost.published_at}
        now={new Date(s.now)}
        bodyHtml={s.devPost.body_html}
        excerpt={s.devPost.body_html.replace(/<[^>]+>/g, " ").trim()}
        sourceUrl={s.devPost.url}
        open
      />
    ),
  },
  "patch-strip": {
    title: "PatchStrip",
    render: (s) => <PatchStrip versions={versions(s)} />,
  },
  footer: {
    title: "Footer",
    render: (s) => <Footer versions={versions(s)} wikiCredit />,
  },
  "command-palette": {
    title: "CommandPalette",
    render: (s) => (
      <CommandPalette entries={entries(s)} initialOpen initialQuery="a" />
    ),
  },
  "filter-bar": {
    title: "FilterBar",
    render: (s) => <FilterBarStory sample={s} />,
  },
  "filter-bar-phone": {
    title: "FilterBar on phone",
    render: (s) => <FilterBarStory sample={s} />,
  },
  "segmented-links": {
    title: "SegmentedLinks",
    render: () => (
      <SegmentedLinks
        label="View"
        current="/ships"
        links={[
          { href: "/ships", label: "Cards" },
          { href: "/ships?view=table", label: "Table" },
        ]}
      />
    ),
  },
  "stats-by-channel": {
    // The PTU row is the LIVE row plus one on every stat: a transparent, mechanical stand-in
    // for the PTU build the pack does not have, so the toggle's open state can be seen.
    title: "StatsByChannel with PTU differences",
    render: (s) => (
      <StatsByChannel
        initialOpen
        ptuVersion={`${liveVersion(s)}-story`}
        hasPtuRow
        rows={[
          {
            key: "length",
            label: "Length",
            value: s.stats.length_m,
            unit: "m",
            digits: 2,
            delta: 1,
          },
          {
            key: "mass",
            label: "Mass",
            value: s.stats.mass_kg,
            unit: "kg",
            delta: 1,
          },
          {
            key: "scm",
            label: "SCM speed",
            value: s.stats.scm_speed,
            unit: "m/s",
            delta: s.stats.scm_speed === null ? undefined : 1,
          },
          {
            key: "cargo",
            label: "Cargo",
            value: s.stats.cargo_scu,
            unit: "SCU",
          },
        ]}
      />
    ),
  },
  "theme-toggle": {
    title: "ThemeToggle",
    render: () => (
      <div className="flex items-center gap-3 p-4">
        <ThemeToggle />
        <span className="text-ui text-secondary">Light or dark</span>
      </div>
    ),
  },
  logo: {
    title: "Logo",
    render: () => (
      <div className="flex flex-col gap-4 p-4">
        <p className="m-0 flex items-center">
          <Logo height={24} />
          <span className="sr-only">{SITE_NAME}</span>
        </p>
        <p className="m-0 flex items-center">
          <Logo height={32} />
        </p>
        <p className="m-0 flex items-center">
          <Logo height={48} />
        </p>
      </div>
    ),
  },
  icon: {
    title: "Icon",
    render: () => (
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-4">
        {ICON_NAMES.map((name) => (
          <li
            key={name}
            className="flex items-center gap-2 text-ui text-secondary"
          >
            <Icon name={name} className="text-primary" />
            <Icon name={name} size={24} className="text-primary" />
            {name}
          </li>
        ))}
      </ul>
    ),
  },
  "page-shell": {
    title: "PageShell",
    render: (s) => (
      <PageShell
        searchEntries={entries(s)}
        versions={versions(s)}
        current="ships"
      >
        <EntityPage
          hero={{
            name: s.vehicle.name,
            kicker: { label: s.manufacturer.name },
            status: vehicleStatusBadge(s.vehicle.status),
            image: null,
            placeholder: "No image yet",
          }}
          facts={[
            { label: "Role", value: s.vehicle.role },
            { label: "Crew", value: crew(s), numeric: true },
            { label: "Cargo", value: s.stats.cargo_scu, unit: "SCU" },
          ]}
          related={[
            {
              title: `More from ${s.manufacturer.name}`,
              items: [card(s)],
            },
          ]}
        >
          <Section
            id="specs"
            title="Specifications"
            aside={`LIVE ${liveVersion(s)}`}
          >
            <StatList>
              <StatRow
                label="Length"
                value={s.stats.length_m}
                unit="m"
                digits={2}
              />
              <StatRow label="Mass" value={s.stats.mass_kg} unit="kg" />
            </StatList>
          </Section>
        </EntityPage>
      </PageShell>
    ),
  },
};

export const stories: readonly Story[] = storyMeta.map(({ id, width }) => {
  const found = renderers[id];
  if (found === undefined) throw new Error(`story ${id} has no renderer`);
  return { id, width, title: found.title, render: found.render };
});

for (const id of Object.keys(renderers)) {
  if (!storyMeta.some((s) => s.id === id)) {
    throw new Error(`story ${id} is missing from stories/ids.ts`);
  }
}
