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
  CDN_BASE_URL: url.optional(),
  SPECTRUM_MODE: SpectrumMode.default("off"),
  SPECTRUM_FEED_URL: url.optional(),
  SPECTRUM_SESSION_COOKIE: nonEmpty.optional(),
  SENTRY_DSN: url.optional(),
  /** The public origin for canonical URLs, the sitemap and Open Graph (spec 02, "SEO"). */
  SITE_URL: url.optional(),
  /** Windows only. */
  SC_INSTALL_ROOT: nonEmpty.optional(),
  /** Windows only. */
  STARBREAKER_BIN: nonEmpty.optional(),
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
    if (
      env.SPECTRUM_MODE === "poll" &&
      env.SPECTRUM_SESSION_COOKIE === undefined
    ) {
      missing.push("SPECTRUM_SESSION_COOKIE");
    }
  }
  if (missing.length > 0) {
    throw new EnvError(
      `Missing required environment variables for ${role}: ${missing.join(", ")}`,
      missing,
    );
  }
  return env;
}
