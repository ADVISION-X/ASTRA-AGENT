export { createVisualTargetAbilityGroup } from "./ability-group.js";
export { listVisualTargetChildren } from "./registry.js";
export {
  VISUAL_TARGET_ABILITY_GROUP_ID,
  VISUAL_TARGET_CHILD_CAPABILITY_IDS,
} from "./contract.js";
export type {
  VisualTargetAbilityGroup,
  VisualTargetAbilityInput,
  VisualTargetAbilityResult,
  VisualTargetBbox,
  VisualTargetChildCapabilityId,
  VisualTargetGridCell,
  VisualTargetGridRegion,
  VisualTargetOutput,
  VisualTargetPackage,
  VisualTargetRuntimeProof,
  ParsedVisualTargetAbilityInput,
} from "./contract.js";
export {
  VisualTargetAbilityInputSchema,
  VisualTargetAbilityResultSchema,
  VisualTargetBboxSchema,
  VisualTargetChildCapabilityIdSchema,
  VisualTargetGridCellSchema,
  VisualTargetGridRegionSchema,
  VisualTargetOutputSchema,
  VisualTargetPackageSchema,
  VisualTargetRuntimeProofSchema,
} from "./schema.js";

/**
 * Visual Target is an optional non-executable packaging step.
 * It must not become mandatory between AI and Geometry Guard.
 *
 * AI selects the gridCell/gridRegion/bbox → Visual Target packages it as
 * a non-executable targetRef → Geometry Guard converts to executable geometry.
 *
 * Visual Target does NOT discover business targets (buttons, panels, metrics).
 * Visual Target does NOT approve execution.
 * Visual Target does NOT generate executable coordinates.
 */
