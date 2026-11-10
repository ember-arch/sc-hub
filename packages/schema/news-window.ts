/**
 * The news window (ADR-030): the site carries dispatches and developer posts published on or
 * after the first day of DefenseCon 2956, which that year took in Invictus Launch Week 2956; the
 * owner's cut of 2026-11-10 ("going as far back as the beginning of Invictus Launch Week 2026,
 * no need to do so beyond that"). The pollers record nothing older, the site shows nothing
 * older, and the pack was trimmed to it once. UTC midnight on the event's first day.
 */
export const NEWS_WINDOW_START = "2026-05-14T00:00:00.000Z";

/** Whether a publication time falls inside the window. */
export function inNewsWindow(publishedAt: string): boolean {
  return publishedAt >= NEWS_WINDOW_START;
}
