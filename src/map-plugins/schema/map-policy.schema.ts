import { z } from "zod";

export const MapPolicySchema = z.object({
  safetyPolicy: z.string().min(1),
  runLimitPolicy: z.object({
    defaultMaxRounds: z.number().int().nonnegative(),
    maxAllowedMaxRounds: z.number().int().nonnegative(),
    maxAllowedMaxMinutes: z.number().int().nonnegative()
  }).strict(),
  reviewPolicy: z.string().min(1),
  exportPolicy: z.string().min(1),
  debugPolicy: z.string().min(1)
}).strict();
