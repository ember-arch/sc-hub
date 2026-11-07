import type { Metadata } from "next";
import { ItemType } from "schema";
import { Section, sentence } from "ui";
import { type ComponentView, repo } from "../../lib/data";
import { Site } from "../../lib/site";
import { ComponentTable } from "./component-table";

export const metadata: Metadata = { title: "Components" };

export function componentRows(components: readonly ComponentView[]) {
  return components.map((c) => ({
    key: c.item.class_name,
    name: c.item.name,
    href: `/components/${c.item.slug}`,
    manufacturer: c.manufacturer?.name ?? c.item.manufacturer_code,
    size: c.item.size,
    grade: c.item.grade,
    itemClass: c.item.item_class === null ? null : sentence(c.item.item_class),
  }));
}

/** Components grouped by type (system.md section 4). Size and manufacturer filters arrive with spec 02. */
export default function ComponentsPage() {
  const r = repo();
  const groups = ItemType.options
    .map((type) => ({
      type,
      items: r.components.filter((c) => c.item.type === type),
    }))
    .filter((g) => g.items.length > 0);
  return (
    <Site current="components">
      <div className="flex flex-col gap-12 pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-title text-primary">Components</h1>
          <p className="text-caption text-secondary">
            {r.components.length} components in {groups.length} types ·{" "}
            {r.liveVersion ?? "no LIVE build"}
          </p>
        </div>
        <nav
          aria-label="Component types"
          className="flex flex-wrap gap-2 text-caption"
        >
          {groups.map((g) => (
            <a
              key={g.type}
              href={`#${g.type}`}
              className="rounded-control border border-hairline bg-inset px-2 py-1 text-secondary no-underline hover:text-primary"
            >
              {sentence(g.type)} ({g.items.length})
            </a>
          ))}
        </nav>
        {groups.map((g) => (
          <Section
            key={g.type}
            id={g.type}
            title={sentence(g.type)}
            aside={`${g.items.length}`}
          >
            <ComponentTable
              caption={sentence(g.type)}
              rows={componentRows(g.items)}
            />
          </Section>
        ))}
      </div>
    </Site>
  );
}
