import { z } from "zod";
import { ManufacturerCode, Slug } from "../common.js";

export const Manufacturer = z.strictObject({
  code: ManufacturerCode,
  name: z.string().min(1),
  slug: Slug,
  /** Fankit or localization copy only; never invented. Empty when neither has it. */
  description: z.string(),
  /** CDN path, fankit-sourced. */
  logo_asset: z.string().nullable(),
});
export type Manufacturer = z.infer<typeof Manufacturer>;
