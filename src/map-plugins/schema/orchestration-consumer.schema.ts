import {
  MAP_PLUGIN_ALLOWED_ABILITY_GROUP_IDS,
  MapPluginAllowedAbilityGroupIdSchema,
  MapPluginOperationalMapSchema,
  MapPluginOperationalMapStepSchema,
  MapPluginPayloadRefKeySchema,
  MapPluginTransitionSchema,
} from "./operational-map-core.schema.js";
import {
  MapPluginStepKindSchema,
  MapPluginTransitionConditionSchema,
  MapPluginTransitionConditionSourceSchema,
  MapPluginTransitionStatusSchema,
} from "./operational-map-payload.schema.js";
import {
  MapPluginOrchestrationSequencePolicySchema,
  MapPluginProofPolicySchema,
  MapPluginTimeoutPolicySchema,
} from "./operational-map-policy.schema.js";
import { RequestedPlatformIdSchema } from "./platform-id.schema.js";

export const OrchestrationAllowedAbilityGroupIdsSchemaSource = MAP_PLUGIN_ALLOWED_ABILITY_GROUP_IDS;
export const OrchestrationAllowedAbilityGroupIdSchemaSource = MapPluginAllowedAbilityGroupIdSchema;
export const OrchestrationOperationalMapSchemaSource = MapPluginOperationalMapSchema;
export const OrchestrationOperationalMapStepSchemaSource = MapPluginOperationalMapStepSchema;
export const OrchestrationPayloadRefKeySchemaSource = MapPluginPayloadRefKeySchema;
export const OrchestrationTransitionSchemaSource = MapPluginTransitionSchema;
export const OrchestrationStepKindSchemaSource = MapPluginStepKindSchema;
export const OrchestrationTransitionConditionSchemaSource = MapPluginTransitionConditionSchema;
export const OrchestrationTransitionConditionSourceSchemaSource = MapPluginTransitionConditionSourceSchema;
export const OrchestrationTransitionStatusSchemaSource = MapPluginTransitionStatusSchema;
export const OrchestrationSequencePolicySchemaSource = MapPluginOrchestrationSequencePolicySchema;
export const OrchestrationProofPolicySchemaSource = MapPluginProofPolicySchema;
export const OrchestrationTimeoutPolicySchemaSource = MapPluginTimeoutPolicySchema;
export const OrchestrationRequestedPlatformIdSchemaSource = RequestedPlatformIdSchema;