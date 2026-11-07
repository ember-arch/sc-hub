import { z } from "zod";

/** The game's internal identifier for an entity, for example `AEGS_Gladius`. The primary key everywhere (CLAUDE.md section 5). */
export const ClassName = z.string().min(1);

/** URL slug, derived once at first publish and never changed afterwards (data-model: Slugs and redirects). */
export const Slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lower-case kebab-case");

/** Full build string of a channel at a point in time, for example `4.3.1-live.10234567`. */
export const GameVersionString = z.string().min(1);

/** Manufacturer code, for example `AEGS`, `ANVL`, `RSI`, `DRAK`. */
export const ManufacturerCode = z.string().min(1);

/** ISO 8601 timestamp with offset. The contract is JSON, so timestamps travel as strings. */
export const Timestamp = z.iso.datetime({ offset: true });

export const Uuid = z.uuid();

/** Normalized-but-unmapped remainder of a DataCore record (data-model principle 4). */
export const Raw = z.record(z.string(), z.unknown());
