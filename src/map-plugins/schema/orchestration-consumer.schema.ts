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
  MapPluginTransitionStatusSchema,
} from "./operational-map-payload.schema.js";
import { RequestedPlatformIdSchema } from "./platform-id.schema.js";

const OrchestrationAllowedAbilityGroupIdsSchemaSource = MAP_PLUGIN_ALLOWED_ABILITY_GROUP_IDS;
const OrchestrationAllowedAbilityGroupIdSchemaSource = MapPluginAllowedAbilityGroupIdSchema;
const OrchestrationOperationalMapSchemaSource = MapPluginOperationalMapSchema;
const OrchestrationOperationalMapStepSchemaSource = MapPluginOperationalMapStepSchema;
const OrchestrationPayloadRefKeySchemaSource = MapPluginPayloadRefKeySchema;
const OrchestrationTransitionSchemaSource = MapPluginTransitionSchema;
const OrchestrationStepKindSchemaSource = MapPluginStepKindSchema;
const OrchestrationTransitionStatusSchemaSource = MapPluginTransitionStatusSchema;
const OrchestrationRequestedPlatformIdSchemaSource = RequestedPlatformIdSchema;

export { OrchestrationAllowedAbilityGroupIdsSchemaSource, OrchestrationAllowedAbilityGroupIdSchemaSource, OrchestrationOperationalMapSchemaSource, OrchestrationOperationalMapStepSchemaSource, OrchestrationPayloadRefKeySchemaSource, OrchestrationTransitionSchemaSource, OrchestrationStepKindSchemaSource, OrchestrationTransitionStatusSchemaSource, OrchestrationRequestedPlatformIdSchemaSource };
