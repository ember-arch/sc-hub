import { z } from "zod";
import { registry } from "./registry.js";
import type { EntityName } from "./registry.js";

export type JsonSchema = Record<string, unknown>;

/**
 * JSON Schema (draft 2020-12) for every entity. The pipeline validates its output against these
 * before publishing and the import job validates again before writing (ADR-002, rule 10).
 */
export function toJsonSchemas(): Record<EntityName, JsonSchema> {
  const out: Partial<Record<EntityName, JsonSchema>> = {};
  for (const [name, schema] of Object.entries(registry) as [
    EntityName,
    z.ZodType,
  ][]) {
    const generated = z.toJSONSchema(schema, { target: "draft-2020-12" });
    out[name] = { title: name, ...generated };
  }
  return out as Record<EntityName, JsonSchema>;
}
