import { timingSafeEqual } from "node:crypto";

/**
 * Whether a cron call carries Vercel's `Authorization: Bearer <CRON_SECRET>`, compared in constant
 * time (only the length can leak). The news and refresh clocks share it (ADR-053, ADR-056).
 */
export function cronAuthorized(header: string | null, secret: string): boolean {
  const given = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
