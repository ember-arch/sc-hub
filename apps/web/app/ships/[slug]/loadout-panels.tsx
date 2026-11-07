import { TextLink, formatNumber, sentence } from "ui";
import {
  type LoadoutEntry,
  type LoadoutGroup,
  headlineStat,
} from "../../../lib/loadout";

/**
 * The stock loadout as panels by system (spec 02, "Ship page"). Each panel lists what is mounted:
 * the item linked to its page, its size and how many of it, one headline number when the pack
 * has it, and a turret's or rack's own items nested beneath. Empty ports close each list.
 */

function EntryRow({
  entry,
  depth,
}: {
  readonly entry: LoadoutEntry;
  readonly depth: number;
}) {
  const headline =
    entry.item === null ? null : headlineStat(entry.item, entry.stats);
  const size =
    entry.sizeMin === entry.sizeMax
      ? `S${entry.sizeMax}`
      : `S${entry.sizeMin}–${entry.sizeMax}`;
  return (
    <li className={depth === 0 ? "" : "border-l border-hairline pl-3"}>
      <div className="flex items-baseline justify-between gap-4 py-2 text-ui">
        <span className="min-w-0">
          {entry.item === null ? (
            <span className="text-secondary">
              Empty {sentence(entry.portType).toLowerCase()} port
            </span>
          ) : (
            <TextLink href={`/components/${entry.item.slug}`}>
              {entry.item.name}
            </TextLink>
          )}
          <span className="text-caption text-secondary">
            {" "}
            {size}
            {entry.count > 1 ? ` · ×${entry.count}` : ""}
          </span>
        </span>
        {headline !== null ? (
          <span className="shrink-0 font-mono text-primary">
            {formatNumber(headline.value, 2)}
            <span className="font-sans text-caption text-secondary">
              {" "}
              {headline.label}
            </span>
          </span>
        ) : null}
      </div>
      {entry.children.length > 0 ? (
        <ul className="m-0 list-none p-0">
          {entry.children.map((child) => (
            <EntryRow key={child.key} entry={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function LoadoutPanels({
  groups,
}: {
  readonly groups: readonly LoadoutGroup[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <section
          key={group.id}
          aria-labelledby={`loadout-${group.id}`}
          className="flex flex-col rounded-card border border-hairline bg-surface p-4"
        >
          <div className="flex items-baseline justify-between gap-4 border-b border-hairline pb-2">
            <h3
              id={`loadout-${group.id}`}
              className="text-ui font-medium text-primary"
            >
              {group.title}
            </h3>
            <span className="text-caption text-secondary">
              {group.ports} {group.ports === 1 ? "port" : "ports"}
            </span>
          </div>
          <ul className="m-0 list-none p-0">
            {group.entries.map((entry) => (
              <EntryRow key={entry.key} entry={entry} depth={0} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
