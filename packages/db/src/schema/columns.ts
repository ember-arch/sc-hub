import { customType } from "drizzle-orm/pg-core";

/**
 * Postgres returns `timestamptz` as text (`YYYY-MM-DD HH:MM:SS[.fff]+HH[:MM]`) or, through some
 * drivers, as a Date. Both become a strict ISO 8601 string in UTC.
 */
export function postgresTimestampToIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "string") {
    throw new TypeError(`timestamp column returned ${typeof value}`);
  }
  const iso = value.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00");
  const time = Date.parse(iso);
  if (Number.isNaN(time)) {
    throw new TypeError(
      `timestamp column returned an unparseable value: ${value}`,
    );
  }
  return new Date(time).toISOString();
}

/**
 * `timestamp with time zone` that travels as an ISO 8601 string in both directions, so a row read
 * from the database satisfies the schema's `Timestamp` without a conversion layer. Drizzle's own
 * string mode returns Postgres text, which the contract rejects.
 */
export const isoTimestamp = customType<{ data: string; driverData: string }>({
  dataType() {
    return "timestamp with time zone";
  },
  toDriver(value: string): string {
    return value;
  },
  fromDriver(value: unknown): string {
    return postgresTimestampToIso(value);
  },
});
