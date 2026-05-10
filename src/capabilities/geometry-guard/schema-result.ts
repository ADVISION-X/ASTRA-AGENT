import { z } from "zod";

import {
  GEOMETRY_GUARD_ABILITY_GROUP_ID,
  GEOMETRY_GUARD_CHILD_CAPABILITY_IDS,
} from "./shared/geometry-types.js";
import {
  GeometryGuardBoundingBoxSchema,
  GeometryGuardCheckDecisionSchema,
  GeometryGuardChildCapabilityIdSchema,
  GeometryGuardDecisionSchema,
  GeometryGuardExecutionSpaceSchema,
  GeometryGuardFailureReasonSchema,
  GeometryGuardPointSchema,
  GeometryGuardScaleMappingSchema,
  GeometryGuardStatusSchema,
} from "./schema-foundation.js";
import { nullableString } from "./schema-internal.js";
import { GeometryGuardResultOutputSchema } from "./schema-output.js";
import { GeometryGuardRuntimeProofSchema } from "./schema-runtime-proof.js";

const GeometryGuardBaseResultSchema = z.object({
  status: GeometryGuardStatusSchema,
  abilityGroupId: z.literal(GEOMETRY_GUARD_ABILITY_GROUP_ID),
  childCapabilityId: GeometryGuardChildCapabilityIdSchema,
  missionId: nullableString,
  runId: nullableString,
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  stepId: nullableString,
  capabilityCallId: nullableString,
  nerveBusEnvelopeId: nullableString,
  geometryGuardRef: z.string().min(1),
  geometryGuardProofRef: nullableString,
  geometryGuardOutputRef: nullableString,
  geometryGuardRuntimeProofRef: nullableString,
  guardDecision: GeometryGuardDecisionSchema,
  output: GeometryGuardResultOutputSchema.nullable().default(null),
  outputRef: nullableString,
  diagnosticPayloadRef: nullableString,
  normalizedCoordinateSpace: GeometryGuardExecutionSpaceSchema.nullable().default(null),
  normalizedClickPoint: GeometryGuardPointSchema.nullable().default(null),
  normalizedBbox: GeometryGuardBoundingBoxSchema.nullable().default(null),
  appliedScaleMapping: GeometryGuardScaleMappingSchema.nullable().default(null),
  sourceScreenshotEvidenceRef: nullableString,
  sourceTargetRef: nullableString,
  sourceAiResultRef: nullableString,
  sourcePageStateProofRef: nullableString,
  sourceVisualTargetResultRef: nullableString,
  failureReason: GeometryGuardFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: GeometryGuardFailureReasonSchema.nullable().default(null),
  debugLogRef: nullableString,
  runtimeProof: GeometryGuardRuntimeProofSchema,
  sourceEvidenceDecision: GeometryGuardCheckDecisionSchema,
  coordinateSpaceDecision: GeometryGuardCheckDecisionSchema,
  executionSpaceDecision: GeometryGuardCheckDecisionSchema,
  outputBoundaryDecision: GeometryGuardCheckDecisionSchema,
  policyDecision: GeometryGuardCheckDecisionSchema,
  boundsDecision: GeometryGuardCheckDecisionSchema,
  scaleDecision: GeometryGuardCheckDecisionSchema,
  transformDecision: GeometryGuardCheckDecisionSchema,
  riskLevel: z.enum(["low", "medium", "high"]).nullable().default(null),
  requiresPostClickAiVerification: z.boolean().default(false),
  fallbackReason: nullableString,
  targetSemanticOwner: z.enum(["ai", "visual-target", "profile", "missing"]).nullable().default(null),
  actionableMessage: nullableString,
  dataQualityFlags: z.array(z.string().min(1)).default([]),
  statusMessage: z.string().min(1),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
});

const createChildResultSchema = (childCapabilityId: (typeof GEOMETRY_GUARD_CHILD_CAPABILITY_IDS)[number]) =>
  GeometryGuardBaseResultSchema.extend({
    childCapabilityId: z.literal(childCapabilityId),
  });

const ValidateCoordinateSpaceResultSchema = createChildResultSchema("validate-coordinate-space");
const ValidateBBoxIntegrityResultSchema = createChildResultSchema("validate-bbox-integrity");
const ValidateClickPointResultSchema = createChildResultSchema("validate-click-point");
const ValidateScaleMappingResultSchema = createChildResultSchema("validate-scale-mapping");
const MapAiInputToViewportResultSchema = createChildResultSchema("map-ai-input-to-viewport");
const MapRegionToSourceResultSchema = createChildResultSchema("map-region-to-source");
const ValidateBrowserViewportBoundsResultSchema = createChildResultSchema("validate-browser-viewport-bounds");
const ValidateDesktopScreenBoundsResultSchema = createChildResultSchema("validate-desktop-screen-bounds");

const GeometryGuardAbilityResultSchema = z.discriminatedUnion("childCapabilityId", [
  ValidateCoordinateSpaceResultSchema,
  ValidateBBoxIntegrityResultSchema,
  ValidateClickPointResultSchema,
  ValidateScaleMappingResultSchema,
  MapAiInputToViewportResultSchema,
  MapRegionToSourceResultSchema,
  ValidateBrowserViewportBoundsResultSchema,
  ValidateDesktopScreenBoundsResultSchema,
]);

export {
  GeometryGuardAbilityResultSchema,
  MapAiInputToViewportResultSchema,
  MapRegionToSourceResultSchema,
  ValidateBBoxIntegrityResultSchema,
  ValidateBrowserViewportBoundsResultSchema,
  ValidateClickPointResultSchema,
  ValidateCoordinateSpaceResultSchema,
  ValidateDesktopScreenBoundsResultSchema,
  ValidateScaleMappingResultSchema,
};
