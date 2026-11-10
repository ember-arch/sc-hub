import type { ContentItem, ContentSource } from "schema";
import type { DispatchPicture } from "ui";
import { media } from "./media";

/**
 * The dispatches' shared parts (ADR-029): the label each source is shown under, and the cover
 * a dispatch card carries when the local media has one.
 */

export const SOURCE_LABEL: Record<ContentSource, string> = {
  comm_link: "Comm-Link",
  patch_notes: "Patch notes",
  roadmap: "Roadmap",
  progress_tracker: "Progress tracker",
  video: "Video",
  spectrum: "Spectrum",
};

/** The cover RSI's hub shows for a Comm-Link; null for other sources and on a clone without media. */
export function coverOf(item: ContentItem): DispatchPicture | null {
  return item.source === "comm_link" ? media().cover(item.external_id) : null;
}
