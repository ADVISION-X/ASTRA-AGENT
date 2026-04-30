import { z } from "zod";

import { MapPluginAllowedAbilityGroupIdSchema } from "./operational-map-ability.schema.js";
import { MapPluginPayloadRefKeySchema, MapPluginStepKindSchema, MapPluginTransitionConditionSchema } from "./operational-map-payload.schema.js";
import { MapPluginProofPolicySchema, MapPluginTimeoutPolicySchema } from "./operational-map-policy.schema.js";
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
  successCondition: MapPluginTransitionConditionSchema,
  failureBranch: z.string().min(1),
  reviewBranch: z.string().min(1),
  timeoutPolicy: MapPluginTimeoutPolicySchema,
  proofPolicy: MapPluginProofPolicySchema,
}).strict().superRefine((value, context) => {
  validateMapPluginOperationalMapStep(value, context);
});