import { z } from "zod";

/**
 * The parts of the Star Citizen Wiki API responses that the bootstrap mapper reads. Every shape is
 * loose: unknown keys pass through (they end up in `raw`), and a key the mapper needs that is missing
 * or has the wrong type fails validation before mapping starts. Nothing here is game data; it is the
 * contract between the script and the API as observed on 2026-11-06.
 */

const num = z.number().nullable().optional();
const str = z.string().nullable().optional();
const bool = z.boolean().nullable().optional();

/** Localized text as the wiki returns it: a plain string or an object keyed by locale (`en_EN`, ...). */
export const WikiText = z.union([
  z.string(),
  z.looseObject({ en_EN: z.string().nullable().optional() }),
]);
export type WikiText = z.infer<typeof WikiText>;

export const WikiManufacturer = z.looseObject({
  code: z.string().min(1),
  name: z.string().min(1),
});
export type WikiManufacturer = z.infer<typeof WikiManufacturer>;

export const WikiEquippedItem = z.looseObject({
  uuid: z.string().min(1),
  name: z.string().min(1),
  class_name: z.string().min(1),
  type: z.string(),
  version: str,
});
export type WikiEquippedItem = z.infer<typeof WikiEquippedItem>;

export const WikiPort = z.looseObject({
  /** May be empty: the game files declare dummy hardpoints with no name, type or item (ADR-022). */
  name: z.string(),
  position: str,
  class_name: str,
  type: z.string(),
  sub_type: str,
  sizes: z.looseObject({ min: num, max: num }).nullable().optional(),
  equipped_item: WikiEquippedItem.nullable().optional(),
  version: str,
  get ports() {
    return z.array(WikiPort).nullable().optional();
  },
});
export type WikiPort = z.infer<typeof WikiPort>;

export const WikiVehicle = z.looseObject({
  uuid: z.string().min(1),
  name: z.string().min(1),
  class_name: z.string().min(1),
  sizes: z
    .looseObject({ length: num, beam: num, height: num })
    .nullable()
    .optional(),
  mass: num,
  cargo_capacity: num,
  crew: z.looseObject({ min: num, max: num }).nullable().optional(),
  health: num,
  speed: z.looseObject({ scm: num, max: num }).nullable().optional(),
  fuel: z
    .looseObject({ capacity: num, intake_rate: num })
    .nullable()
    .optional(),
  quantum: z
    .looseObject({
      quantum_speed: num,
      quantum_spool_time: num,
      quantum_fuel_capacity: num,
      quantum_range: num,
    })
    .nullable()
    .optional(),
  manufacturer: WikiManufacturer,
  is_spaceship: bool,
  is_vehicle: bool,
  is_gravlev: bool,
  production_status: WikiText.nullable().optional(),
  foci: z.array(WikiText).nullable().optional(),
  size: z.union([WikiText, z.number()]).nullable().optional(),
  version: str,
  ports: z.array(WikiPort).nullable().optional(),
});
export type WikiVehicle = z.infer<typeof WikiVehicle>;

export const WikiVehicleResponse = z.looseObject({ data: WikiVehicle });

export const WikiItem = z.looseObject({
  uuid: z.string().min(1),
  name: z.string().min(1),
  class_name: z.string().min(1),
  type: z.string(),
  sub_type: str,
  size: num,
  grade: z.union([z.string(), z.number()]).nullable().optional(),
  class: str,
  manufacturer: WikiManufacturer,
  version: str,
  durability: z.looseObject({ health: num }).nullable().optional(),
  emission: z
    .looseObject({ ir: num, em_min: num, em_max: num })
    .nullable()
    .optional(),
  shield: z
    .looseObject({ max_health: num, regen_rate: num })
    .nullable()
    .optional(),
  quantum_drive: z
    .looseObject({
      standard_jump: z
        .looseObject({ drive_speed: num, spool_up_time: num })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  vehicle_weapon: z
    .looseObject({
      damage: z.looseObject({ alpha_total: num }).nullable().optional(),
      rpm: num,
      range: num,
    })
    .nullable()
    .optional(),
  ammunition: z.looseObject({ speed: num }).nullable().optional(),
  power_plant: z
    .looseObject({ power_segment_generation: num, power_output: num })
    .nullable()
    .optional(),
  cooler: z
    .looseObject({ coolant_segment_generation: num, cooling_rate: num })
    .nullable()
    .optional(),
});
export type WikiItem = z.infer<typeof WikiItem>;

export const WikiItemResponse = z.looseObject({ data: WikiItem });

/** A page of `/api/items?filter[type]=…`: whole item records, as `/api/items/<uuid>` returns them. */
export const WikiItemListResponse = z.looseObject({
  data: z.array(WikiItem),
  meta: z.looseObject({ last_page: z.number().int().positive() }),
});

/**
 * The parts the loadout editor offers (ADR-016): every ship gun, missile and torpedo, shield,
 * power plant, cooler and quantum drive the API lists, not only those on the five ships.
 */
export const CATALOG_TYPES = [
  "WeaponGun",
  "Missile",
  "Shield",
  "PowerPlant",
  "Cooler",
  "QuantumDrive",
] as const;

export const WikiGameVersionResponse = z.looseObject({
  data: z.looseObject({
    code: z.string().min(1),
    channel: z.string().min(1),
  }),
});

/**
 * The ships to fetch by game class name, or every vehicle the API lists for the build when
 * `all` is true (ADR-022). The named list stays for a quick rebuild and the tests.
 */
export const ShipList = z.strictObject({
  ships: z.array(z.string().min(1)).min(5),
  all: z.boolean().default(false),
});

/** One entry of GET /api/vehicles?filter[class_name]=...: enough to pick the exact class name and fetch by uuid. */
export const WikiVehicleListResponse = z.looseObject({
  data: z.array(
    z.looseObject({
      uuid: z.string().min(1),
      name: z.string().min(1),
      class_name: z.string().min(1),
    }),
  ),
  /** Present on the unfiltered, paged list. */
  meta: z.looseObject({ last_page: z.number().int().positive() }).optional(),
});
