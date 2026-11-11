/**
 * The media store's credentials (ADR-034, ADR-048), for `publish.ts` on the owner's machine and
 * `publish-covers.ts` in the News workflow. Read from the environment, then `.env.local` and
 * `.env` at the repository root; never from arguments, and never printed.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { envSchema } from "schema/env";
import type { BlobAuth } from "./blob.js";

export interface BlobSettings {
  auth: BlobAuth;
  cdnBaseUrl: string | null;
}

/**
 * `.env.local` then `.env` at the repository root; a variable already set wins over both. Either
 * credential form is enough; `vercel env pull` writes the OIDC pair and marks the read-write token
 * sensitive.
 */
export function loadBlobSettings(
  repoRoot: string,
): BlobSettings | { missing: string } {
  for (const file of [".env.local", ".env"]) {
    const path = join(repoRoot, file);
    if (existsSync(path)) process.loadEnvFile(path);
  }
  const source: Record<string, string> = {};
  for (const key of [
    "BLOB_READ_WRITE_TOKEN",
    "BLOB_STORE_ID",
    "VERCEL_OIDC_TOKEN",
    "CDN_BASE_URL",
  ]) {
    const value = process.env[key];
    // `vercel env pull` writes "[SENSITIVE]" for a value it may not read back: that is no value.
    if (value !== undefined && value !== "" && value !== "[SENSITIVE]") {
      source[key] = value;
    }
  }
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `invalid environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  const env = parsed.data;
  const cdnBaseUrl = env.CDN_BASE_URL?.replace(/\/+$/, "") ?? null;
  if (env.BLOB_READ_WRITE_TOKEN !== undefined) {
    return { auth: { token: env.BLOB_READ_WRITE_TOKEN }, cdnBaseUrl };
  }
  const oidc = source["VERCEL_OIDC_TOKEN"];
  if (oidc !== undefined && env.BLOB_STORE_ID !== undefined) {
    return {
      auth: { oidcToken: oidc, storeId: env.BLOB_STORE_ID },
      cdnBaseUrl,
    };
  }
  return {
    missing:
      "BLOB_READ_WRITE_TOKEN, or VERCEL_OIDC_TOKEN with BLOB_STORE_ID (vercel env pull .env.local)",
  };
}
