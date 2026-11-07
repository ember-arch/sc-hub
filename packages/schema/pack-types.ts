import type { Entity } from "./keys.js";
import type { Manifest } from "./manifest.js";
import type { EntityName } from "./registry.js";

/**
 * The shapes a data pack parses into, and the error it fails with. Kept apart from `pack.ts` so
 * the package root stays free of Node built-ins: `parsePack` hashes files with `node:crypto`
 * and lives behind the `schema/pack` export, which only server-side code imports (ADR-005).
 */

export type PackRows = { [K in EntityName]: Entity<K>[] };

export interface DataPack {
  readonly manifest: Manifest;
  readonly rows: PackRows;
}

export interface PackErrorDetails {
  readonly file?: string;
  readonly entity?: EntityName;
  readonly index?: number;
  readonly path?: string;
}

export class PackError extends Error {
  readonly details: PackErrorDetails;

  constructor(message: string, details: PackErrorDetails = {}) {
    super(message);
    this.name = "PackError";
    this.details = details;
  }
}
