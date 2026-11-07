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
import type { ReactNode } from "react";
import { Badge } from "../components/badge";
import { Card } from "../components/card";
import {
  CommandPalette,
  type SearchEntry,
} from "../components/command-palette";
import { DevPost } from "../components/dev-post";
import {
  EmptyState,
  EntityPage,
  Hero,
  KeyFacts,
  Section,
} from "../components/entity-page";
import { FeedItem } from "../components/feed-item";
import { Footer } from "../components/footer";
import { formatNumber, sentence } from "../components/format";
import { PageShell } from "../components/page-shell";
import { PatchStrip } from "../components/patch-strip";
import { StatList, StatRow } from "../components/stat-row";
import { vehicleStatusBadge } from "../components/status";
import { DataTableStory } from "./data-table-story";
import { storyMeta } from "./ids";

/**
 * Light and dark stories for every Phase 0 component (system.md section 3). Stories take their
 * data from fixtures (CLAUDE.md section 2: never hand-enter game data), so the gallery route in
 * apps/web loads the bootstrap pack and hands rows in. Playwright screenshots each story into
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

const renderers: Record<string, { title: string; render: Story["render"] }> = {
  badge: {
    title: "Badge",
    render: () => (
      <div className="flex flex-wrap gap-2">
        <Badge tone="success">Flight ready</Badge>
        <Badge tone="warning">In production</Badge>
        <Badge tone="neutral">Concept</Badge>
        <Badge tone="danger">Removed</Badge>
      </div>
    ),
  },
  "stat-row": {
    title: "StatRow",
    render: (s) => (
      <StatList>
        <StatRow label="Length" value={s.stats.length_m} unit="m" digits={2} />
        <StatRow label="Mass" value={s.stats.mass_kg} unit="kg" />
        <StatRow
          label="SCM speed"
          value={s.stats.scm_speed}
          unit="m/s"
          delta={{ value: 12 }}
        />
        <StatRow
          label="Cargo"
          value={s.stats.cargo_scu}
          unit="SCU"
          delta={{ value: -4 }}
        />
        <StatRow label="Hydrogen fuel" value={s.stats.hydrogen_fuel} />
      </StatList>
    ),
  },
  "key-facts": {
    title: "KeyFacts",
    render: (s) => (
      <KeyFacts
        facts={[
          { label: "Manufacturer", value: s.manufacturer.name },
          { label: "Role", value: s.vehicle.role },
          {
            label: "Size",
            value:
              s.vehicle.size_class === null
                ? null
                : sentence(s.vehicle.size_class),
          },
          { label: "Crew", value: crew(s) },
          { label: "Cargo", value: s.stats.cargo_scu, unit: "SCU" },
          {
            label: "Length",
            value: formatNumber(s.stats.length_m, 2),
            unit: "m",
          },
          { label: "Mass", value: formatNumber(s.stats.mass_kg), unit: "kg" },
          {
            label: "Status",
            value: vehicleStatusBadge(s.vehicle.status).label,
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
        placeholder="Render placeholder"
      />
    ),
  },
  section: {
    title: "Section and EmptyState",
    render: () => (
      <Section id="ptu" title="PTU differences" aside="4.10.2">
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
  "dev-post": {
    title: "DevPost",
    render: (s) => (
      <DevPost
        author={{
          name: s.author.display_name,
          role: s.author.role,
          href: "/news/dev",
        }}
        thread={s.devPost.thread_title}
        publishedAt={s.devPost.published_at}
        now={new Date(s.now)}
        bodyHtml={s.devPost.body_html}
        sourceUrl={s.devPost.url}
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
            placeholder: "Render placeholder",
          }}
          facts={[
            { label: "Manufacturer", value: s.manufacturer.name },
            { label: "Role", value: s.vehicle.role },
            { label: "Crew", value: crew(s) },
            { label: "Cargo", value: s.stats.cargo_scu, unit: "SCU" },
          ]}
        />
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
