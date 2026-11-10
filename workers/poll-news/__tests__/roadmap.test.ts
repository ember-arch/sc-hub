import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createClient } from "../src/client.js";
import {
  BOARD_URL,
  Board,
  type BoardState,
  changeItem,
  diffBoards,
  pollRoadmap,
  readBoard,
} from "../src/sources/roadmap.js";
import { openStore } from "../src/store.js";

const samples = new URL("../../../fixtures/news/samples/", import.meta.url);
const boardJson = readFileSync(
  new URL("roadmap-board-1.sample.json", samples),
  "utf8",
);

describe("readBoard and diffBoards", () => {
  const state = readBoard(Board.parse(JSON.parse(boardJson)));

  it("flattens the board to cards with their release and category", () => {
    expect(state.cards.length).toBeGreaterThan(3);
    const card = state.cards[0]!;
    expect(card.release).toMatch(/\d/);
    expect(typeof card.time_modified).toBe("number");
    expect(state.last_updated).toBeGreaterThan(1_700_000_000);
  });

  it("names a card added, moved, changed in status, renamed and removed, in the board's words", () => {
    const [a, b, c, d] = state.cards;
    const next: BoardState = {
      last_updated: state.last_updated + 60,
      cards: [
        { ...a!, release: "5.1" },
        {
          ...b!,
          status: b!.status === "Released" ? "In Progress" : "Released",
        },
        { ...c!, name: `${c!.name} (renamed)` },
        { ...d!, id: 999_999, name: "Brand new card" },
      ],
    };
    const changes = diffBoards(state, next);
    const kinds = changes.map((ch) => ch.kind);
    expect(kinds).toContain("moved");
    expect(kinds).toContain("status");
    expect(kinds).toContain("renamed");
    expect(kinds).toContain("added");
    expect(kinds.filter((k) => k === "removed").length).toBe(
      state.cards.length - 3,
    );
    const moved = changes.find((ch) => ch.kind === "moved")!;
    expect(moved.words).toBe(`${a!.name} moved from ${a!.release} to 5.1`);
    const status = changes.find((ch) => ch.kind === "status")!;
    expect(status.words).toContain(`${b!.name} is now `);
  });

  it("makes a roadmap item from a change, dated by the board's stamp, linking the board", () => {
    const card = state.cards[0]!;
    const item = changeItem(
      {
        kind: "moved",
        card: { ...card, release: "5.1" },
        before: card,
        words: `${card.name} moved from ${card.release} to 5.1`,
      },
      state.last_updated,
    );
    expect(item).toMatchObject({
      source: "roadmap",
      title: `Roadmap: ${card.name} moved from ${card.release} to 5.1`,
      url: `https://robertsspaceindustries.com/roadmap/board/1-Star-Citizen?card=${card.id}`,
      // The board's own stamp of its last update, not the card's older one (ADR-030).
      published_at: new Date(state.last_updated * 1000).toISOString(),
    });
    expect(item.published_at).not.toBe(
      new Date(card.time_modified * 1000).toISOString(),
    );
    expect(item.body_html).toContain("<p>");
    expect(item.body_html).not.toContain("<script");
  });
});

describe("pollRoadmap", () => {
  const quiet = {
    sleep: async () => undefined,
    now: () => 0,
    contact: "x@example.com",
  };
  const fetchBoard = (text: string) => async (url: string) => {
    if (url !== BOARD_URL) throw new Error(`unexpected ${url}`);
    return { ok: true, status: 200, text: async () => text };
  };

  it("records the state on the first run without items, then items for the changes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "news-"));
    const store = openStore(join(dir, "ContentItem.json"));
    let saved: BoardState | null = null;
    const state = { read: () => saved, write: (n: BoardState) => (saved = n) };
    const first = await pollRoadmap(
      createClient({ fetch: fetchBoard(boardJson), ...quiet }),
      store,
      state,
      () => new Date(),
    );
    expect(first.first_run).toBe(true);
    expect(first.changes).toBe(0);
    expect(store.rows).toHaveLength(0);
    expect(saved).not.toBeNull();
    // The next board moves one card.
    const board = JSON.parse(boardJson) as {
      data: {
        releases: { name: string; cards: { release_id: number }[] | null }[];
      };
    };
    const from = board.data.releases.find((r) => (r.cards ?? []).length > 0)!;
    const to = board.data.releases.find((r) => r !== from)!;
    const card = from.cards!.shift()!;
    to.cards = [...(to.cards ?? []), card];
    const second = await pollRoadmap(
      createClient({ fetch: fetchBoard(JSON.stringify(board)), ...quiet }),
      store,
      state,
      () => new Date("2026-11-10T00:00:00Z"),
    );
    expect(second.first_run).toBe(false);
    expect(second.changes).toBe(1);
    expect(store.latest()[0]?.title).toContain(
      `moved from ${from.name} to ${to.name}`,
    );
  });
});
