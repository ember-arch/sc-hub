import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  EmptyState,
  EntityPage,
  Section,
  StatList,
  StatRow,
  sentence,
} from "ui";
import { repo } from "../../../lib/data";
import { Site } from "../../../lib/site";
import { componentFacts, shipCard } from "../../../lib/views";

interface Params {
  readonly params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return repo().components.map((c) => ({ slug: c.item.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const c = repo().componentBySlug(slug);
  if (c === undefined) return { title: "Component not found" };
  return {
    title: c.item.name,
    description: `${c.item.name}: a size ${c.item.size} ${sentence(c.item.type).toLowerCase()} by ${c.manufacturer?.name ?? c.item.manufacturer_code}, stats by game version and the ships that carry it.`,
  };
}

/** Every stat the pack has for this item; nulls are omitted rather than shown as zero. */
const STAT_LABELS: readonly { key: keyof StatKeys; label: string }[] = [
  { key: "hp", label: "Health" },
  { key: "power_draw", label: "Power draw" },
  { key: "power_output", label: "Power output" },
  { key: "heat_generation", label: "Heat generation" },
  { key: "cooling_rate", label: "Cooling rate" },
  { key: "em_signature", label: "EM signature" },
  { key: "ir_signature", label: "IR signature" },
  { key: "weapon_damage", label: "Damage" },
  { key: "weapon_fire_rate", label: "Fire rate" },
  { key: "weapon_range", label: "Range" },
  { key: "projectile_speed", label: "Projectile speed" },
  { key: "shield_hp", label: "Shield health" },
  { key: "shield_regen", label: "Shield regeneration" },
  { key: "shield_delay", label: "Shield delay" },
  { key: "qd_speed", label: "Quantum speed" },
  { key: "qd_range", label: "Quantum range" },
  { key: "qd_fuel_per_jump", label: "Fuel per jump" },
  { key: "qd_spool_time", label: "Spool time" },
];

interface StatKeys {
  hp: number | null;
  power_draw: number | null;
  power_output: number | null;
  heat_generation: number | null;
  cooling_rate: number | null;
  em_signature: number | null;
  ir_signature: number | null;
  weapon_damage: number | null;
  weapon_fire_rate: number | null;
  weapon_range: number | null;
  projectile_speed: number | null;
  shield_hp: number | null;
  shield_regen: number | null;
  shield_delay: number | null;
  qd_speed: number | null;
  qd_range: number | null;
  qd_fuel_per_jump: number | null;
  qd_spool_time: number | null;
}

export default async function ComponentPage({ params }: Params) {
  const { slug } = await params;
  const r = repo();
  const c = r.componentBySlug(slug);
  if (c === undefined) notFound();
  const stats = c.stats;
  const shown =
    stats === null ? [] : STAT_LABELS.filter(({ key }) => stats[key] !== null);
  const stockOn = r.stockOn(c.item.class_name);
  return (
    <Site current="components">
      <EntityPage
        hero={{
          name: c.item.name,
          kicker:
            c.manufacturer === null
              ? { label: c.item.manufacturer_code }
              : {
                  label: c.manufacturer.name,
                  href: `/manufacturers/${c.manufacturer.slug}`,
                },
        }}
        facts={componentFacts(c)}
        related={[
          {
            title: "Stock on",
            items: stockOn.map(shipCard),
          },
        ]}
      >
        <Section
          id="stats"
          title="Stats"
          aside={
            stats === null ? "No LIVE build" : `LIVE ${stats.game_version}`
          }
        >
          {shown.length === 0 ? (
            <EmptyState>
              No stats for this component in the current data pack. Units and
              the remaining fields arrive with the real extraction in spec 01.
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
              <StatList>
                {shown
                  .slice(0, Math.ceil(shown.length / 2))
                  .map(({ key, label }) => (
                    <StatRow
                      key={key}
                      label={label}
                      value={stats?.[key] ?? null}
                      digits={2}
                    />
                  ))}
              </StatList>
              <StatList>
                {shown
                  .slice(Math.ceil(shown.length / 2))
                  .map(({ key, label }) => (
                    <StatRow
                      key={key}
                      label={label}
                      value={stats?.[key] ?? null}
                      digits={2}
                    />
                  ))}
              </StatList>
            </div>
          )}
        </Section>
        {stockOn.length === 0 ? (
          <Section id="stock" title="Stock on">
            <EmptyState>
              No ship in the current data pack carries this component by
              default.
            </EmptyState>
          </Section>
        ) : null}
        <Section id="news" title="In the news">
          <EmptyState>
            No news mentions this component yet. Entity linking arrives with
            spec 03.
          </EmptyState>
        </Section>
      </EntityPage>
    </Site>
  );
}
