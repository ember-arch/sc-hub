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
  name: z.string().min(1),
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
});
export type WikiItem = z.infer<typeof WikiItem>;

export const WikiItemResponse = z.looseObject({ data: WikiItem });

export const WikiGameVersionResponse = z.looseObject({
  data: z.looseObject({
    code: z.string().min(1),
    channel: z.string().min(1),
  }),
});

/** The five ships to fetch, by the identifier the wiki accepts (display name or slug). */
export const ShipList = z.strictObject({
  ships: z.array(z.string().min(1)).length(5),
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
});
