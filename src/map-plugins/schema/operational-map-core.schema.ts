import { z } from "zod";

import { MAP_PLUGIN_ALLOWED_ABILITY_GROUP_IDS, MapPluginAllowedAbilityGroupIdSchema } from "./operational-map-ability.schema.js";
import { MapPluginOperationalMapStepSchema } from "./operational-map-step.schema.js";
import { MapPluginMissionTerminalStatusSchema, MapPluginPayloadRefKeySchema } from "./operational-map-payload.schema.js";
import { MapPluginTransitionSchema } from "./operational-map-transition.schema.js";
import { validateMapPluginOperationalMap } from "./operational-map-document-validation.js";

export {
  MAP_PLUGIN_ALLOWED_ABILITY_GROUP_IDS,
  MapPluginAllowedAbilityGroupIdSchema,
  MapPluginOperationalMapStepSchema,
  MapPluginPayloadRefKeySchema,
  MapPluginTransitionSchema,
};

export const MapPluginOperationalMapKindSchema = z.enum(["routePlanBoundMap", "genericDiagnosticMap"]);

export const MapPluginOperationalMapSchema = z.object({
  mapKind: MapPluginOperationalMapKindSchema,
  mapId: z.string().min(1),
  displayName: z.string().min(1),
  humanGoal: z.string().min(1),
  routePlanId: z.string().min(1).nullable().optional().default(null),
  persistentPayloadRefs: z.array(MapPluginPayloadRefKeySchema).default([]),
  initialStepId: z.string().min(1),
  steps: z.array(MapPluginOperationalMapStepSchema).min(1),
  transitions: z.array(MapPluginTransitionSchema).min(1),
  finalStates: z.array(MapPluginMissionTerminalStatusSchema).min(1),
  forbiddenDirectCalls: z.array(z.string().min(1)).default([]),
}).strict().superRefine((value, context) => {
  validateMapPluginOperationalMap(value, context);
});
