import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";

type ClickPoint = { x: number; y: number };
type Bbox = { x: number; y: number; width: number; height: number };
type GeometrySnapshot = { viewportWidth: number; viewportHeight: number; scaleFactor: number };

type GeometryGuardIdentityInput = {
  envelope: AbilityCommandEnvelope;
  bbox: Bbox;
  clickPoint: ClickPoint;
  geometry: GeometrySnapshot;
  sourceAbilityGroupId: string;
  sourceChildCapabilityId: string;
  sourceRef: string;
  sourceScreenshotEvidenceRef: string;
  sourceTargetRef: string;
  sourceAiResultRef: string | null;
  sourcePageStateProofRef: string | null;
  sourceVisualTargetResultRef: string | null;
  sourceGeometryHandoffRef: string;
  sourceCoordinateSpace: string;
  targetSemanticOwner: string;
  dataQualityFlags: string[];
};

const buildGeometryGuardEnvelopeChain = (envelope: AbilityCommandEnvelope) => ({
  abilityGroupId: "geometry-guard",
  childCapabilityId: "validate-browser-viewport-bounds",
  missionId: envelope.missionId,
  runId: envelope.runId,
  sessionId: envelope.sessionId,
  roundId: envelope.roundId,
  videoVisitId: envelope.videoVisitId,
  stepId: envelope.stepId,
  mapPackageId: envelope.mapPackageId,
  mapPackageVersion: envelope.mapPackageVersion,
  selectedMapId: envelope.selectedMapId,
  selectedMapVersion: envelope.selectedMapVersion,
  activationSnapshotRef: envelope.activationSnapshotRef,
  capabilityCallId: envelope.capabilityCallId,
  nerveBusEnvelopeId: envelope.nerveBusEnvelopeId,
  requestedBy: "orchestration",
  purpose: "click_next_video",
  inputRef: envelope.inputRef,
  idempotencyKey: envelope.idempotencyKey,
});

const buildGeometryGuardSourceFields = (input: GeometryGuardIdentityInput) => ({
  sourceAbilityGroupId: input.sourceAbilityGroupId,
  sourceChildCapabilityId: input.sourceChildCapabilityId,
  sourceRef: input.sourceRef,
  sourceScreenshotEvidenceRef: input.sourceScreenshotEvidenceRef,
  sourceTargetRef: input.sourceTargetRef,
  sourceAiResultRef: input.sourceAiResultRef,
  sourcePageStateProofRef: input.sourcePageStateProofRef,
  sourceVisualTargetResultRef: input.sourceVisualTargetResultRef,
  sourceGeometryHandoffRef: input.sourceGeometryHandoffRef,
  sourceCoordinateSpace: input.sourceCoordinateSpace,
});

const buildGeometryGuardViewportFields = (input: GeometryGuardIdentityInput) => ({
  requestedExecutionSpace: "browserViewport",
  bbox: input.bbox,
  clickPoint: input.clickPoint,
  viewportSize: {
    width: input.geometry.viewportWidth,
    height: input.geometry.viewportHeight,
  },
  deviceScaleFactor: input.geometry.scaleFactor,
  targetSemanticOwner: input.targetSemanticOwner,
  dataQualityFlags: input.dataQualityFlags,
});

const buildGeometryGuardCommandIdentity = (input: GeometryGuardIdentityInput) => ({
  ...buildGeometryGuardEnvelopeChain(input.envelope),
  ...buildGeometryGuardSourceFields(input),
  ...buildGeometryGuardViewportFields(input),
});

const buildDeterministicNextItemGeometryPayload = (input: {
  envelope: AbilityCommandEnvelope;
  geometry: GeometrySnapshot;
  executableGeometry: { bbox: Bbox; clickPoint: ClickPoint };
  sourceScreenshotEvidenceRef: string;
  sourceTargetRef: string;
}) => ({
  ...buildGeometryGuardCommandIdentity({
    envelope: input.envelope,
    bbox: input.executableGeometry.bbox,
    clickPoint: input.executableGeometry.clickPoint,
    geometry: input.geometry,
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: input.envelope.stepId,
    sourceRef: input.sourceTargetRef,
    sourceScreenshotEvidenceRef: input.sourceScreenshotEvidenceRef,
    sourceTargetRef: input.sourceTargetRef,
    sourceAiResultRef: null,
    sourcePageStateProofRef: null,
    sourceVisualTargetResultRef: null,
    sourceGeometryHandoffRef: `${input.envelope.inputRef}:deterministic-fallback-handoff`,
    sourceCoordinateSpace: "browserViewport",
    targetSemanticOwner: "missing",
    dataQualityFlags: [
      "deterministic_next_video_arrow_geometry_fallback",
      "mechanical_click_success_is_not_next_item_semantic_success",
      "requires_post_click_ai_verification",
    ],
  }),
  riskLevel: "high",
  requiresPostClickAiVerification: true,
  fallbackReason: "missing_governed_next_item_target_candidate",
  actionableMessage: "Deterministic fallback geometry may click a previous or incorrect affordance; post-click AI verification is mandatory before treating the item as advanced.",
});

const buildStructuredNextItemGeometryPayload = (input: {
  envelope: AbilityCommandEnvelope;
  geometry: GeometrySnapshot;
  executableGeometry: { bbox: Bbox; clickPoint: ClickPoint };
  sourceRef: string;
  sourceScreenshotEvidenceRef: string;
  sourceTargetRef: string;
  sourceAiResultRef: string | null;
  sourcePageStateProofRef: string | null;
  sourceVisualTargetResultRef: string;
  sourceGeometryHandoffRef: string;
  sourceCoordinateSpace: string;
  dataQualityFlags: string[];
}) => buildGeometryGuardCommandIdentity({
  envelope: input.envelope,
  bbox: input.executableGeometry.bbox,
  clickPoint: input.executableGeometry.clickPoint,
  geometry: input.geometry,
  sourceAbilityGroupId: "visual-target",
  sourceChildCapabilityId: "observe-next-item-target-candidate",
  sourceRef: input.sourceRef,
  sourceScreenshotEvidenceRef: input.sourceScreenshotEvidenceRef,
  sourceTargetRef: input.sourceTargetRef,
  sourceAiResultRef: input.sourceAiResultRef,
  sourcePageStateProofRef: input.sourcePageStateProofRef,
  sourceVisualTargetResultRef: input.sourceVisualTargetResultRef,
  sourceGeometryHandoffRef: input.sourceGeometryHandoffRef,
  sourceCoordinateSpace: input.sourceCoordinateSpace,
  targetSemanticOwner: "visual-target",
  dataQualityFlags: input.dataQualityFlags,
});

export { buildDeterministicNextItemGeometryPayload, buildStructuredNextItemGeometryPayload };