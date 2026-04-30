import { z } from "zod";

import { RequestedPlatformIdSchema } from "./platform-id.schema.js";

export const TaskTemplatePackageSchema = z.object({
  taskTemplateId: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().min(1),
  recommended: z.boolean().default(false),
  taskCategory: z.string().min(1),
  version: z.string().min(1),
  defaultRunLimit: z.object({
    maxRounds: z.number().int().nonnegative(),
    maxMinutes: z.number().int().nonnegative()
  }).strict(),
  maxAllowedRunLimit: z.object({
    maxRounds: z.number().int().nonnegative(),
    maxMinutes: z.number().int().nonnegative()
  }).strict(),
  safetyLevel: z.string().min(1),
  userVisibleCapabilities: z.array(z.string().min(1)).min(1),
  availabilityPolicy: z.enum(["active", "disabled", "draft"]),
  requestedPlatformId: RequestedPlatformIdSchema.nullable().optional().default(null),
  platformProfileRef: z.string().min(1).nullable().optional().default(null),
  targetProfileRef: z.string().min(1).nullable().optional().default(null),
  defaultHumanGoal: z.string()
}).strict();
