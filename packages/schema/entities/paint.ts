import { z } from "zod";
import { ClassName, Uuid } from "../common.js";

export const Paint = z.strictObject({
  id: Uuid,
  class_name: ClassName,
  name: z.string().min(1),
  preview_asset: z.string().nullable(),
});
export type Paint = z.infer<typeof Paint>;
