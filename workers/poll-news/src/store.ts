/**
 * The news pack (ADR-027): `fixtures/news/ContentItem.json`, every content item the pollers have
 * seen, append-only (CLAUDE.md section 5). A source that changes an item makes a new row with
 * the next revision; the site shows the latest revision of each. Ids are stable: a UUID derived
 * from the source, the source's own id and the revision, so a row is the same row on every
 * machine and every run.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ContentItem, inNewsWindow } from "schema";

const NAMESPACE = "sc-hub:news:";

/** A UUID (version 5 shape) from a name: the same name is the same id, always. */
export function stableId(name: string): string {
  const h = createHash("sha1").update(`${NAMESPACE}${name}`).digest("hex");
  // Version and variant nibbles, as RFC 9562 lays a name-based UUID out.
  const hex = `${h.slice(0, 12)}5${h.slice(13, 16)}${((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 32)}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** What a source hands the store: everything but the id, the revision and the fetch time. */
export type Incoming = Omit<
  ContentItem,
  "id" | "revision" | "fetched_at" | "takedown"
>;

export interface Store {
  /** Every row, every revision, as read. */
  readonly rows: readonly ContentItem[];
  /** The latest revision of each item, newest first. */
  latest(): ContentItem[];
  /** The latest revision of one item, or undefined. */
  find(
    source: ContentItem["source"],
    externalId: string,
  ): ContentItem | undefined;
  /**
   * Records an item: nothing when the latest revision says the same; a first row when the item
   * is new; the next revision when the source changed its title, summary, body, url or time.
   * An item published before the news window (ADR-030) is not recorded and answers "older".
   */
  put(
    incoming: Incoming,
    fetchedAt: string,
  ): "unchanged" | "new" | "revised" | "older";
  /** Writes the file when anything was put. */
  save(): boolean;
  readonly added: number;
  readonly revised: number;
}

const CONTENT_FIELDS = [
  "url",
  "title",
  "summary",
  "body_html",
  "published_at",
  "author_id",
  "thread_id",
  "thread_title",
  "forum",
] as const;

function sameContent(a: ContentItem, b: Incoming): boolean {
  return CONTENT_FIELDS.every((f) => a[f] === b[f]);
}

export function openStore(path: string): Store {
  const rows: ContentItem[] = existsSync(path)
    ? ContentItem.array().parse(JSON.parse(readFileSync(path, "utf8")))
    : [];
  const latestOf = new Map<string, ContentItem>();
  for (const row of rows) {
    const key = `${row.source}:${row.external_id}`;
    const seen = latestOf.get(key);
    if (seen === undefined || row.revision > seen.revision)
      latestOf.set(key, row);
  }
  let added = 0;
  let revised = 0;
  let dirty = false;
  return {
    rows,
    latest: () =>
      [...latestOf.values()].sort((a, b) =>
        b.published_at.localeCompare(a.published_at),
      ),
    find: (source, externalId) => latestOf.get(`${source}:${externalId}`),
    put(incoming, fetchedAt) {
      const key = `${incoming.source}:${incoming.external_id}`;
      const current = latestOf.get(key);
      if (!inNewsWindow(incoming.published_at)) return "older";
      if (current !== undefined && sameContent(current, incoming))
        return "unchanged";
      const revision = current === undefined ? 1 : current.revision + 1;
      const row = ContentItem.parse({
        ...incoming,
        id: stableId(`${key}:${revision}`),
        revision,
        fetched_at: fetchedAt,
        takedown: current?.takedown ?? false,
      });
      rows.push(row);
      latestOf.set(key, row);
      dirty = true;
      if (current === undefined) added += 1;
      else revised += 1;
      return current === undefined ? "new" : "revised";
    },
    save() {
      if (!dirty) return false;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify(rows, null, 2)}\n`);
      dirty = false;
      return true;
    },
    get added() {
      return added;
    },
    get revised() {
      return revised;
    },
  };
}
