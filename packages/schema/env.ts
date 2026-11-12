import { z } from "zod";

export const SpectrumMode = z.enum(["feed", "poll", "off"]);
export type SpectrumMode = z.infer<typeof SpectrumMode>;

const nonEmpty = z.string().min(1);
const url = z.url({ protocol: /^https?$/ });

/**
 * Every variable from CLAUDE.md section 9. All are optional at the schema level because each
 * runtime needs a different subset; `loadEnv(role)` enforces the subset and fails startup when
 * a required one is missing.
 */
export const envSchema = z.object({
  DATABASE_URL: nonEmpty.optional(),
  MEILI_HOST: url.optional(),
  MEILI_MASTER_KEY: nonEmpty.optional(),
  MEILI_SEARCH_KEY: nonEmpty.optional(),
  R2_ACCOUNT_ID: nonEmpty.optional(),
  R2_ACCESS_KEY_ID: nonEmpty.optional(),
  R2_SECRET_ACCESS_KEY: nonEmpty.optional(),
  R2_BUCKET: nonEmpty.optional(),
  /**
   * The media bucket's public address (ADR-034): the site resolves every `/media/` path against it
   * and fetches the media manifest from it at build when no media is built locally.
   */
  CDN_BASE_URL: url.optional(),
  /**
   * Vercel Blob read-write token for the media store (ADR-034): `scripts/media/publish.ts` on the
   * owner's machine only; Vercel sets it on the project, where nothing reads it.
   */
  BLOB_READ_WRITE_TOKEN: nonEmpty.optional(),
  /** The media store's id; with VERCEL_OIDC_TOKEN it stands in for the token locally (ADR-034). */
  BLOB_STORE_ID: nonEmpty.optional(),
  SPECTRUM_MODE: SpectrumMode.default("off"),
  SPECTRUM_FEED_URL: url.optional(),
  /**
   * Overrides the staff role id the Spectrum worker resolves each run from Spectrum's own role
   * list (ADR-027); unset in every deployment so far.
   */
  SPECTRUM_STAFF_ROLE_ID: nonEmpty.optional(),
  SENTRY_DSN: url.optional(),
  /** The public origin for canonical URLs, the sitemap and Open Graph (spec 02, "SEO"). */
  SITE_URL: url.optional(),
  /** Windows only. */
  SC_INSTALL_ROOT: nonEmpty.optional(),
  /** Windows only. */
  STARBREAKER_BIN: nonEmpty.optional(),
  /** Dev scripts, the daily refresh and the news workers: the contact address RSI requests carry, in every User-Agent (ADR-015, ADR-036). */
  SC_HUB_CONTACT_EMAIL: z.email().optional(),
  /**
   * The Vercel site only: the shared secret Vercel's cron sends as a bearer token to
   * /api/cron/news; without it the route refuses every call (ADR-053).
   */
  CRON_SECRET: nonEmpty.optional(),
  /**
   * The Vercel site only: a fine-grained GitHub token for this repository alone, with Actions read
   * and write and nothing else, which the news clock uses to start the News workflow; without it
   * the clock does nothing and the workflow's own schedule runs it (ADR-053).
   */
  NEWS_DISPATCH_TOKEN: nonEmpty.optional(),
});
export type Env = z.infer<typeof envSchema>;
export type EnvKey = keyof Env;

export const roles = ["web", "worker", "pipeline"] as const;
export type Role = (typeof roles)[number];

/** What each runtime must have, from the Environments table in CLAUDE.md section 9. */
export const requiredFor: Readonly<Record<Role, readonly EnvKey[]>> = {
  web: ["DATABASE_URL", "MEILI_HOST", "MEILI_SEARCH_KEY"],
  worker: [
    "DATABASE_URL",
    "MEILI_HOST",
    "MEILI_MASTER_KEY",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "CDN_BASE_URL",
  ],
  pipeline: [
    "SC_INSTALL_ROOT",
    "STARBREAKER_BIN",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
  ],
};

export class EnvError extends Error {
  readonly missing: readonly string[];
  constructor(message: string, missing: readonly string[] = []) {
    super(message);
    this.name = "EnvError";
    this.missing = missing;
  }
}

/** `KEY=` in a .env file means unset, not "the empty string". */
function withoutEmpty(
  source: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && value !== "") out[key] = value;
  }
  return out;
}

/**
 * Validate the environment for one runtime. Throws `EnvError` naming every missing variable, so a
 * misconfigured deploy fails at startup instead of at first request. Nothing is read at import time.
 */
export function loadEnv(
  role: Role,
  source: Readonly<Record<string, string | undefined>> = process.env,
): Env {
  const parsed = envSchema.safeParse(withoutEmpty(source));
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    throw new EnvError(`Invalid environment for ${role}: ${issues.join("; ")}`);
  }

  const env = parsed.data;
  const missing: EnvKey[] = requiredFor[role].filter(
    (key) => env[key] === undefined,
  );
  if (role === "worker") {
    if (env.SPECTRUM_MODE === "feed" && env.SPECTRUM_FEED_URL === undefined) {
      missing.push("SPECTRUM_FEED_URL");
    }
    // `poll` mode needs nothing more: Spectrum's search answers without a sign-in (ADR-027).
  }
  if (missing.length > 0) {
    throw new EnvError(
      `Missing required environment variables for ${role}: ${missing.join(", ")}`,
      missing,
    );
  }
  return env;
}
