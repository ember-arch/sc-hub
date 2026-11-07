/**
 * Story ids and screenshot widths, kept free of JSX so the Playwright gallery spec can import
 * them without a React toolchain. `stories/index.tsx` asserts it defines exactly this list.
 */
export const storyMeta: readonly {
  id: string;
  width: number;
  /** The palette is a fixed overlay, so its screenshot is the viewport rather than the story element. */
  capture?: "viewport";
}[] = [
  { id: "badge", width: 390 },
  { id: "stat-row", width: 390 },
  { id: "key-facts", width: 390 },
  { id: "hero", width: 1280 },
  { id: "section", width: 390 },
  { id: "card", width: 390 },
  { id: "data-table", width: 1280 },
  { id: "data-table-phone", width: 390 },
  { id: "feed-item", width: 390 },
  { id: "dev-post", width: 390 },
  { id: "patch-strip", width: 390 },
  { id: "footer", width: 1280 },
  { id: "command-palette", width: 1280, capture: "viewport" },
  { id: "page-shell", width: 1280 },
  { id: "filter-bar", width: 1280 },
  { id: "filter-bar-phone", width: 390 },
  { id: "segmented-links", width: 390 },
  { id: "stats-by-channel", width: 1280 },
];
