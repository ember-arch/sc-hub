/**
 * The roadmap (spec 03, ADR-027): RSI's Release View is a public JSON board. The poller keeps
 * the board's cards as it last saw them (`fixtures/news/roadmap-state.json`) and turns each
 * change into a content item of source `roadmap`: a card added, a card's release or status
 * changed, a card removed. The first run only records the state, so the feed does not open with
 * every card ever made. The body is the diff in words, from the board's own fields.
 */
import { z } from "zod";
import type { Client } from "../client.js";
import { escapeHtml } from "../html.js";
import type { Incoming, Store } from "../store.js";

export const BOARD_URL =
  "https://robertsspaceindustries.com/api/roadmap/v1/boards/1";
export const BOARD_PAGE =
  "https://robertsspaceindustries.com/roadmap/board/1-Star-Citizen";

const Card = z.object({
  id: z.number().int(),
  url_slug: z.string(),
  name: z.string().min(1),
  description: z.string().nullable(),
  release_id: z.number().int().nullable(),
  category_id: z.number().int().nullable(),
  status: z.string().nullable(),
  released: z.number().int().nullable(),
  time_modified: z.number().int(),
});
const Release = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  released: z.number().int().nullable(),
  cards: z.array(Card).nullable(),
});
export const Board = z.object({
  data: z.object({
    id: z.number().int(),
    name: z.string(),
    last_updated: z.number().int(),
    releases: z.array(Release),
    categories: z.array(z.object({ id: z.number().int(), name: z.string() })),
  }),
});
export type Board = z.infer<typeof Board>;

/** One card as the state file keeps it. */
export const CardState = z.object({
  id: z.number().int(),
  name: z.string(),
  release: z.string(),
  release_id: z.number().int().nullable(),
  category: z.string().nullable(),
  status: z.string().nullable(),
  time_modified: z.number().int(),
  description: z.string().nullable(),
});
export type CardState = z.infer<typeof CardState>;

export const BoardState = z.object({
  last_updated: z.number().int(),
  cards: z.array(CardState),
});
export type BoardState = z.infer<typeof BoardState>;

/** The board flattened to cards with their release and category names. */
export function readBoard(board: Board): BoardState {
  const categories = new Map(board.data.categories.map((c) => [c.id, c.name]));
  const cards: CardState[] = [];
  for (const release of board.data.releases) {
    for (const card of release.cards ?? []) {
      cards.push({
        id: card.id,
        name: card.name,
        release: release.name,
        release_id: card.release_id,
        category:
          card.category_id === null
            ? null
            : (categories.get(card.category_id) ?? null),
        status: card.status,
        time_modified: card.time_modified,
        description: card.description,
      });
    }
  }
  return { last_updated: board.data.last_updated, cards };
}

export interface CardChange {
  readonly kind: "added" | "moved" | "status" | "removed" | "renamed";
  readonly card: CardState;
  readonly before: CardState | null;
  readonly words: string;
}

/** What changed between two states, in the board's own words. */
export function diffBoards(prev: BoardState, next: BoardState): CardChange[] {
  const was = new Map(prev.cards.map((c) => [c.id, c]));
  const is = new Map(next.cards.map((c) => [c.id, c]));
  const changes: CardChange[] = [];
  for (const card of next.cards) {
    const before = was.get(card.id);
    if (before === undefined) {
      changes.push({
        kind: "added",
        card,
        before: null,
        words: `${card.name} added to ${card.release}${card.status === null ? "" : `, ${card.status.toLowerCase()}`}`,
      });
      continue;
    }
    if (before.release !== card.release) {
      changes.push({
        kind: "moved",
        card,
        before,
        words: `${card.name} moved from ${before.release} to ${card.release}`,
      });
    } else if (before.status !== card.status) {
      changes.push({
        kind: "status",
        card,
        before,
        words: `${card.name} is now ${card.status?.toLowerCase() ?? "without a status"} in ${card.release}${before.status === null ? "" : `, was ${before.status.toLowerCase()}`}`,
      });
    } else if (before.name !== card.name) {
      changes.push({
        kind: "renamed",
        card,
        before,
        words: `${before.name} renamed ${card.name} in ${card.release}`,
      });
    }
  }
  for (const before of prev.cards) {
    if (!is.has(before.id)) {
      changes.push({
        kind: "removed",
        card: before,
        before,
        words: `${before.name} removed from ${before.release}`,
      });
    }
  }
  return changes;
}

/**
 * A content item for one change, dated by the board's own stamp of its last update: the change
 * was seen between two reads of the board, and a card moved between releases keeps the older
 * stamp of its own last edit, which the news window (ADR-030) would read as old news.
 */
export function changeItem(change: CardChange, lastUpdated: number): Incoming {
  const stamp = lastUpdated;
  const when = new Date(Math.max(stamp, 0) * 1000).toISOString();
  const lines = [
    `<p>${escapeHtml(change.words)}.</p>`,
    change.card.category === null
      ? ""
      : `<p>Category: ${escapeHtml(change.card.category)}.</p>`,
    change.card.description === null || change.card.description === ""
      ? ""
      : `<p>${escapeHtml(change.card.description)}</p>`,
  ].filter((l) => l !== "");
  return {
    source: "roadmap",
    external_id: `card-${change.card.id}-${change.kind}-${stamp}`,
    url: `${BOARD_PAGE}?card=${change.card.id}`,
    title: `Roadmap: ${change.words}`,
    summary: change.card.description === "" ? null : change.card.description,
    body_html: lines.join("\n"),
    published_at: when,
    author_id: null,
    thread_id: null,
    thread_title: null,
    forum: null,
  };
}

export interface RoadmapSummary {
  readonly cards: number;
  readonly changes: number;
  readonly first_run: boolean;
}

/** One run: the board, the diff against the state on file, items for the changes, the new state. */
export async function pollRoadmap(
  client: Client,
  store: Store,
  state: { read(): BoardState | null; write(next: BoardState): void },
  now: () => Date,
): Promise<RoadmapSummary> {
  const board = Board.parse(await client.json(BOARD_URL));
  const next = readBoard(board);
  const prev = state.read();
  if (prev === null) {
    state.write(next);
    return { cards: next.cards.length, changes: 0, first_run: true };
  }
  const changes = diffBoards(prev, next);
  for (const change of changes) {
    store.put(changeItem(change, next.last_updated), now().toISOString());
  }
  state.write(next);
  return {
    cards: next.cards.length,
    changes: changes.length,
    first_run: false,
  };
}
