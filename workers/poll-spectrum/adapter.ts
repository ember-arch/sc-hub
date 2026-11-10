/**
 * The Spectrum adapter interface (spec 03, "Spectrum adapter interface"). Whatever the access
 * method, CIG staff posts arrive here as `StaffPost`s: the post, its thread and its author as
 * Spectrum shows them, nothing more (no avatars, no personal details beyond the post itself).
 * Two implementations stand behind it: `feed` (a CIG-provided export, format to be agreed; the
 * stub validates the documented JSON shape) and `poll` (Spectrum's own search, with a sanctioned
 * account's session). `SPECTRUM_MODE` picks one; `off` disables the module and the site's tab.
 */

export interface StaffPost {
  /** Spectrum's own id for the post (an original post or a reply). */
  readonly id: string;
  /** "op" for a thread's opening post, "reply" for a reply. */
  readonly kind: "op" | "reply";
  readonly thread_id: string;
  readonly thread_title: string;
  /** The forum channel's name as Spectrum shows it ("Announcements", "General"). */
  readonly forum: string;
  /** The post's address on Spectrum, always shown beside it (docs/legal/obligations.md). */
  readonly url: string;
  /** The post's text as Spectrum serves it (plain text with newlines; quotes kept). */
  readonly body: string;
  readonly published_at: string;
  readonly edited_at: string | null;
  readonly author: {
    readonly handle: string;
    readonly display_name: string;
    /** The badge or title Spectrum shows ("Staff", "Community Manager"), or null. */
    readonly role: string | null;
  };
}

export interface SpectrumAdapter {
  /** Staff posts published or edited since the time given, oldest first; empty when none. */
  fetchNewStaffPosts(since: Date): Promise<readonly StaffPost[]>;
}
