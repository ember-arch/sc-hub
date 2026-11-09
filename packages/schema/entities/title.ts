import { z } from "zod";
import { Slug, Timestamp } from "../common.js";

/**
 * Titles (ADR-017): the badges RSI shows beside a player's name on Spectrum, the forums and the
 * citizen dossier. They are a website feature, not game data, so they have no `class_name`; the
 * catalogue is copied by `scripts/titles/fetch.ts` from the Star Citizen Wiki's "Titles" article
 * (starcitizen.tools), never written by hand, and lives in `fixtures/titles/` beside the data
 * pack. Its sentences are the wiki's own text and stay under CC BY-SA 4.0 (docs/legal/attribution.md).
 */

/** The article's sections, in the order the wiki gives them. */
export const TitleGroup = z.enum([
  "backer",
  "recruitment",
  "guide",
  "minigame",
  "arena_commander",
  "persistent_universe",
  "website_event",
  "other",
  "unique",
  "official",
]);
export type TitleGroup = z.infer<typeof TitleGroup>;

/**
 * One run of the wiki's text, verbatim. `href` is set only where the wiki links out to another
 * site (a Comm-Link, a Spectrum thread); links to other wiki pages become plain text.
 */
export const WikiTextRun = z.strictObject({
  text: z.string().min(1),
  href: z.url({ protocol: /^https?$/ }).nullable(),
});
export type WikiTextRun = z.infer<typeof WikiTextRun>;

/** A sentence or paragraph of wiki text as runs; never empty. */
export const WikiText = z.array(WikiTextRun).min(1);
export type WikiText = z.infer<typeof WikiText>;

/** What a title's place in a ladder or grid says it takes. Plain facts from the article's columns. */
export const TitleRequirement = z.discriminatedUnion("kind", [
  /** Backer titles: the pledge total on the account's billing page, in US dollars. */
  z.strictObject({
    kind: z.literal("pledge_total"),
    usd: z.int().nonnegative(),
  }),
  /** Recruitment titles: recruited backers. */
  z.strictObject({
    kind: z.literal("recruits"),
    count: z.int().positive(),
  }),
  /** Recruitment bonus titles: the dates of the bonus period, as the wiki writes them. */
  z.strictObject({
    kind: z.literal("recruitment_period"),
    period: z.string().min(1),
  }),
  /** Guide titles: successful guide sessions in one track. */
  z.strictObject({
    kind: z.literal("guide_sessions"),
    track: z.string().min(1),
    rank: z.string().min(1),
    sessions: z.int().positive(),
  }),
]);
export type TitleRequirement = z.infer<typeof TitleRequirement>;

/** The icon as the wiki holds it. The file itself is CIG's art, copied only to local development (ADR-017). */
export const TitleIcon = z.strictObject({
  /** The wiki's file name, for example `Title_Civilian.png`; the key the media manifest uses. */
  file: z.string().regex(/^[^/\\]+\.(png|jpg|jpeg|svg|webp|gif)$/i),
  /** The original upload on media.starcitizen.tools. */
  url: z.url({ protocol: /^https$/ }),
  width: z.int().positive(),
  height: z.int().positive(),
});
export type TitleIcon = z.infer<typeof TitleIcon>;

export const TitleSourceLink = z.strictObject({
  label: z.string().min(1),
  url: z.url({ protocol: /^https?$/ }),
});
export type TitleSourceLink = z.infer<typeof TitleSourceLink>;

export const Title = z.strictObject({
  /** Group plus name (or guide track plus rank), derived once and never changed. */
  slug: Slug,
  /** As the wiki lists it. For guide titles, the rank; the track is in `requirement`. */
  name: z.string().min(1),
  group: TitleGroup,
  /** Whether it can still be earned; null where the question does not apply (unique and official titles). */
  earnable: z.enum(["yes", "no", "unknown"]).nullable(),
  requirement: TitleRequirement.nullable(),
  /** How it is earned, or for unique and official titles who holds it: the wiki's sentence. */
  earned_by: WikiText.nullable(),
  /** Recruitment titles: the reward that comes with the title. */
  reward: z
    .strictObject({ name: z.string().min(1).nullable(), text: WikiText })
    .nullable(),
  /** Backer titles: the original pledge packages that came with it; empty for "None". */
  packages: z.array(z.string().min(1)).nullable(),
  /** The wiki's footnotes for this row: the RSI pages it cites. */
  sources: z.array(TitleSourceLink),
  icon: TitleIcon.nullable(),
});
export type Title = z.infer<typeof Title>;

export const TitleGroupText = z.strictObject({
  group: TitleGroup,
  /** The wiki's section heading, verbatim. */
  heading: z.string().min(1),
  /** The wiki's paragraphs under it, verbatim; may be empty. */
  intro: z.array(WikiText),
});
export type TitleGroupText = z.infer<typeof TitleGroupText>;

/**
 * One icon's web copies (ADR-017), listed under `titles` in `apps/web/public/media/manifest.json`
 * by `scripts/media/prepare.ts`. Both are git-ignored: the icons are CIG's art, local only.
 */
export const TitleIconMedia = z.strictObject({
  /** The wiki's file name, as in `TitleIcon.file`. */
  file: z.string().min(1),
  /** The original's size. */
  width: z.int().positive(),
  height: z.int().positive(),
  /** Largest first; static files under `/media/titles/`. */
  renditions: z
    .array(
      z.strictObject({
        src: z.string().regex(/^\/media\/titles\/[a-z0-9_.-]+$/),
        width: z.int().positive(),
        height: z.int().positive(),
      }),
    )
    .min(1),
});
export type TitleIconMedia = z.infer<typeof TitleIconMedia>;

/** `fixtures/titles/Titles.json`: the whole catalogue from one revision of the article. */
export const TitleCatalog = z
  .strictObject({
    source: z.strictObject({
      article_url: z.url(),
      revision_id: z.int().positive(),
      /** A permanent link to the revision copied. */
      revision_url: z.url(),
      edited_at: Timestamp,
      fetched_at: Timestamp,
      licence: z.strictObject({
        name: z.literal("CC BY-SA 4.0"),
        url: z.literal("https://creativecommons.org/licenses/by-sa/4.0/"),
      }),
    }),
    /** The article's opening paragraphs. */
    lead: z.array(WikiText),
    groups: z.array(TitleGroupText),
    titles: z.array(Title),
  })
  .superRefine((catalog, ctx) => {
    const seen = new Set<string>();
    for (const [index, title] of catalog.titles.entries()) {
      if (seen.has(title.slug)) {
        ctx.addIssue({
          code: "custom",
          path: ["titles", index, "slug"],
          message: `duplicate slug ${title.slug}`,
        });
      }
      seen.add(title.slug);
    }
    const groups = new Set(catalog.groups.map((g) => g.group));
    if (groups.size !== catalog.groups.length) {
      ctx.addIssue({
        code: "custom",
        path: ["groups"],
        message: "a group appears twice",
      });
    }
    for (const group of TitleGroup.options) {
      const count = catalog.titles.filter((t) => t.group === group).length;
      if (!groups.has(group) || count === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["groups"],
          message: `group ${group} is missing or has no titles`,
        });
      }
    }
  });
export type TitleCatalog = z.infer<typeof TitleCatalog>;
