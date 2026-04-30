import { z } from "zod";

export const MapAuthoringResponseSchema = z.object({
  authoringPrompt: z.string().min(1),
  promptCatalogVersion: z.string().min(1),
  capabilityCatalogVersion: z.string().min(1),
  requiredClarifications: z.array(z.string().min(1)).default([]),
}).strict();

export type MapAuthoringResponse = z.output<typeof MapAuthoringResponseSchema>;