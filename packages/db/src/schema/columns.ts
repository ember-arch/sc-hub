import { customType } from "drizzle-orm/pg-core";

/**
 * `timestamp with time zone` that travels as an ISO 8601 string in both directions, so a row read
 * from the database satisfies the schema's `Timestamp` without a conversion layer. Drizzle's own
 * string mode returns Postgres text (`2026-01-01 00:00:00+00`), which the contract rejects.
 */
export const isoTimestamp = customType<{ data: string; driverData: string }>({
  dataType() {
    return "timestamp with time zone";
  },
  toDriver(value: string): string {
    return value;
  },
  fromDriver(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value !== "string") {
      throw new TypeError(`timestamp column returned ${typeof value}`);
    }
    // Postgres text form: `YYYY-MM-DD HH:MM:SS[.fff]+HH[:MM]`. Make it strict ISO 8601 first.
    const iso = value.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00");
    const time = Date.parse(iso);
    if (Number.isNaN(time)) {
      throw new TypeError(
        `timestamp column returned an unparseable value: ${value}`,
      );
    }
    return new Date(time).toISOString();
  },
});
