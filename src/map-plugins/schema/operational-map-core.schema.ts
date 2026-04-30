import { z } from "zod";

import { MAP_PLUGIN_ALLOWED_ABILITY_GROUP_IDS, MapPluginAllowedAbilityGroupIdSchema } from "./operational-map-ability.schema.js";
import { MapPluginOperationalMapStepSchema } from "./operational-map-step.schema.js";
import { MapPluginMissionTerminalStatusSchema, MapPluginPayloadRefKeySchema } from "./operational-map-payload.schema.js";
import { MapPluginOrchestrationSequencePolicySchema } from "./operational-map-policy.schema.js";
import { MapPluginTransitionSchema } from "./operational-map-transition.schema.js";
import { validateMapPluginOperationalMap } from "./operational-map-document-validation.js";

export const MapPluginOperationalMapSchema = z.object({
  mapId: z.string().min(1),
  displayName: z.string().min(1),
  humanGoal: z.string().min(1),
  allowedAbilityGroups: z.array(MapPluginAllowedAbilityGroupIdSchema).min(1),
  initialStepId: z.string().min(1),
  steps: z.array(MapPluginOperationalMapStepSchema).min(1),
  transitions: z.array(MapPluginTransitionSchema).min(1),
  failureBranches: z.array(z.string().min(1)).default([]),
  reviewBranches: z.array(z.string().min(1)).default([]),
  finalStates: z.array(MapPluginMissionTerminalStatusSchema).min(1),
  forbiddenDirectCalls: z.array(z.string().min(1)).default([]),
  sequencePolicy: MapPluginOrchestrationSequencePolicySchema,
}).strict().superRefine((value, context) => {
  validateMapPluginOperationalMap(value, context);
});