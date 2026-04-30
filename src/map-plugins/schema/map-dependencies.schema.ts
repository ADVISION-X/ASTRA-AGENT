import { z } from "zod";

export const MapDependenciesSchema = z.object({
  requiredCapabilities: z.array(z.string().min(1)).default([]),
  requiredChildCapabilities: z.array(z.string().min(1)).default([]),
  requiredPromptContracts: z.array(z.string().min(1)).default([]),
  requiredPlatformProfiles: z.array(z.string().min(1)).default([]),
  requiredForensicsRecords: z.array(z.string().min(1)).default([])
}).strict();
