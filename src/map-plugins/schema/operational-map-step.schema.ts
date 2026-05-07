import { z } from "zod";

import { MapPluginAllowedAbilityGroupIdSchema } from "./operational-map-ability.schema.js";
import { MapPluginPayloadRefKeySchema, MapPluginStepKindSchema } from "./operational-map-payload.schema.js";
import { validateMapPluginOperationalMapStep } from "./operational-map-step-validation.js";

const MAP_PLUGIN_CAPABILITY_ID = "orchestration";

export const MapPluginOperationalMapStepSchema = z.object({
  stepId: z.string().min(1),
  capabilityId: z.literal(MAP_PLUGIN_CAPABILITY_ID),
  childCapabilityId: z.string().min(1),
  stepKind: MapPluginStepKindSchema,
  targetAbilityGroupId: MapPluginAllowedAbilityGroupIdSchema.nullable().optional().default(null),
  inputRefs: z.array(MapPluginPayloadRefKeySchema).default([]),
  outputRefPolicy: z.object({
    storeAs: z.array(MapPluginPayloadRefKeySchema).default([]),
  }).strict(),
  promptContractId: z.string().min(1).nullable().optional().default(null),
}).strict().superRefine((value, context) => {
  validateMapPluginOperationalMapStep(value, context);
});
