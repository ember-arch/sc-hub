import { z } from "zod";
import {
  ClassName,
  GameVersionString,
  ManufacturerCode,
  Slug,
} from "../common.js";
import { VehicleKind, VehicleStatus } from "../enums.js";

export const Vehicle = z.strictObject({
  class_name: ClassName,
  /** Kebab of display name; prefixed with manufacturer only on collision; never changes after first publish. */
  slug: Slug,
  /** Current display name (localized English). */
  name: z.string().min(1),
  manufacturer_code: ManufacturerCode,
  kind: VehicleKind,
  /** From the ship matrix; the game files only know flyable ships. */
  status: VehicleStatus,
  /** Ship-matrix focus, for example `Light Fighter`. */
  role: z.string().nullable(),
  /** vehicle, snub, small, medium, large, capital. */
  size_class: z.string().nullable(),
  /** Variants point at their base. */
  base_variant_of: ClassName.nullable(),
  /** In the 20-ship 3D list. */
  is_hero: z.boolean(),
  first_seen_version: GameVersionString,
  /** Old slugs, served as redirects. */
  slug_history: z.array(Slug),
});
export type Vehicle = z.infer<typeof Vehicle>;
