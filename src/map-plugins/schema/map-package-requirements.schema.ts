import { z } from "zod";

export const MapPackageRequirementsSchema = z.object({
  requiresGrassEye: z.string().min(1),
  requiresMapSchema: z.string().min(1),
  requiresCapabilityRegistry: z.array(z.string().min(1)).default([]),
  requiresPromptRegistry: z.array(z.string().min(1)).default([]),
  requiresPlatformProfileRegistry: z.array(z.string().min(1)).default([])
}).strict();