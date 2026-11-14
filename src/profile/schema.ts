import { z } from "zod";
const list = z.array(z.string().max(200)).max(12).optional();
export const profileIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,64}$/)
  .refine(
    (id) => !["__proto__", "constructor", "prototype"].includes(id),
    "Reserved profile ID",
  );
export const profileSchema = z
  .object({
    guitars: list,
    pickupTypes: list,
    tunings: list,
    audioInterface: z.string().max(120).optional(),
    preferredGenres: list,
    favoriteAmps: list,
    preferredIrs: list,
    ownsAmplitube5Max: z.boolean().optional(),
    outputDevice: z.string().max(120).optional(),
  })
  .strict();
export type UserProfile = z.infer<typeof profileSchema>;
