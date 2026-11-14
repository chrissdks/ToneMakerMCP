import { z } from "zod";
const httpsUrl = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:");
const taxonomy = z.array(
  z.object({ id: z.number().optional(), name: z.string() }),
);
/** Runtime boundary for upstream metadata; unknown gear stays unknown. */
export const toneSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  url: httpsUrl,
  gear: z.string(),
  format: z.string(),
  description: z.string().nullish(),
  user: z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
      username: z.string().optional(),
      display_name: z.string().nullish(),
      is_verified: z.boolean().optional(),
      avatar_url: z.string().nullish(),
    })
    .optional(),
  images: z.array(z.string()).nullish(),
  links: z.array(z.string()).nullish(),
  makes: taxonomy.optional(),
  tags: taxonomy.optional(),
  sizes: z.array(z.string()).optional(),
  models_count: z.number().nonnegative().optional(),
  downloads_count: z.number().nonnegative().optional(),
  favorites_count: z.number().nonnegative().optional(),
});
export const modelSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  model_url: httpsUrl,
  tone_id: z.number().int().positive(),
  size: z.string().optional(),
  architecture_version: z.enum(["1", "2", "custom"]).nullish(),
});
export const pageSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    page: z.number().int().positive(),
    page_size: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    total_pages: z.number().int().nonnegative(),
  });
