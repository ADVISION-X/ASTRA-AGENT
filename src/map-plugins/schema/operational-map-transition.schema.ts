import { z } from "zod";

import { MapPluginMissionTerminalStatusSchema, MapPluginTransitionStatusSchema } from "./operational-map-payload.schema.js";

export const MapPluginTransitionSchema = z.object({
  transitionId: z.string().min(1),
  fromStepId: z.string().min(1),
  onStatus: MapPluginTransitionStatusSchema,
  toStepId: z.string().min(1).nullable().optional().default(null),
  finalStatus: MapPluginMissionTerminalStatusSchema.nullable().optional().default(null),
}).strict();
