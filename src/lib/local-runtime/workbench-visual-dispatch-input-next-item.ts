import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import { DEFAULT_CLICK_SAFETY_MARGIN_PX } from "../../capabilities/geometry-guard/shared/geometry-policy.js";
import { resolveAbilityResultProofSummary } from "../../capabilities/orchestration/index.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadValueToString } from "./workbench-payload.js";
import { resolveScreenshotSourceHandoff } from "./workbench-screenshot-source-handoff.js";
import {
  resolvePayloadRef,
  toDispatchPayload,
  type DispatchPayloadRecord,
} from "./workbench-action-dispatch-shared.js";

const NEXT_VIDEO_ARROW_WIDTH = 72;
const NEXT_VIDEO_ARROW_HEIGHT = 108;
const NEXT_VIDEO_ARROW_RIGHT_INSET = 28;
const NEXT_VIDEO_ARROW_LOWER_CLICK_RATIO = 0.72;
const NEXT_VIDEO_DETERMINISTIC_FALLBACK_POLICY_ENV = "GRASSEYE_ALLOW_NEXT_VIDEO_DETERMINISTIC_FALLBACK";

const clamp = (value: number, minimum: number, maximum: number) => {
  return Math.min(Math.max(value, minimum), maximum);
};

const clampViewportGeometry = (input: {
  bbox: { x: number; y: number; width: number; height: number };
  clickPoint: { x: number; y: number };
  viewportWidth: number;
  viewportHeight: number;
}) => {
  const minimumSafeDimension = DEFAULT_CLICK_SAFETY_MARGIN_PX * 2 + 1;
  const width = clamp(Math.max(input.bbox.width, minimumSafeDimension), 1, Math.max(input.viewportWidth, 1));
  const height = clamp(Math.max(input.bbox.height, minimumSafeDimension), 1, Math.max(input.viewportHeight, 1));
  const x = clamp(input.bbox.x, 0, Math.max(input.viewportWidth - width, 0));
  const y = clamp(input.bbox.y, 0, Math.max(input.viewportHeight - height, 0));
  const safeInsetX = Math.min(DEFAULT_CLICK_SAFETY_MARGIN_PX, Math.floor(width / 2));
  const safeInsetY = Math.min(DEFAULT_CLICK_SAFETY_MARGIN_PX, Math.floor(height / 2));

  return {
    bbox: {
      x,
      y,
      width,
      height,
    },
    clickPoint: {
      x: clamp(input.clickPoint.x, x + safeInsetX, x + width - safeInsetX),
      y: clamp(input.clickPoint.y, y + safeInsetY, y + height - safeInsetY),
    },
  };
};

const shouldProjectSourceGeometryToViewport = (input: {
  bbox: { x: number; y: number; width: number; height: number };
  clickPoint: { x: number; y: number };
  viewportWidth: number;
  viewportHeight: number;
  coordinateSpace: string | null;
}) => {
  if (input.coordinateSpace && input.coordinateSpace !== "browserViewport") {
    return true;
  }

  return input.bbox.x < 0
    || input.bbox.y < 0
    || input.bbox.x + input.bbox.width > input.viewportWidth
    || input.bbox.y + input.bbox.height > input.viewportHeight
    || input.clickPoint.x < 0
    || input.clickPoint.y < 0
    || input.clickPoint.x > input.viewportWidth
    || input.clickPoint.y > input.viewportHeight;
};

const projectSourceGeometryToViewport = (input: {
  bbox: { x: number; y: number; width: number; height: number };
  clickPoint: { x: number; y: number };
  sourceWidth: number;
  sourceHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}) => {
  const scaleX = input.viewportWidth / Math.max(input.sourceWidth, 1);
  const scaleY = input.viewportHeight / Math.max(input.sourceHeight, 1);

  return {
    bbox: {
      x: Math.round(input.bbox.x * scaleX),
      y: Math.round(input.bbox.y * scaleY),
      width: Math.max(1, Math.round(input.bbox.width * scaleX)),
      height: Math.max(1, Math.round(input.bbox.height * scaleY)),
    },
    clickPoint: {
      x: Math.round(input.clickPoint.x * scaleX),
      y: Math.round(input.clickPoint.y * scaleY),
    },
  };
};

const buildNextVideoArrowGeometry = (input: {
  viewportWidth: number;
  viewportHeight: number;
}) => {
  const bboxWidth = clamp(NEXT_VIDEO_ARROW_WIDTH, 48, input.viewportWidth);
  const bboxHeight = clamp(NEXT_VIDEO_ARROW_HEIGHT, 64, input.viewportHeight);
  const bboxX = clamp(
    input.viewportWidth - NEXT_VIDEO_ARROW_RIGHT_INSET - bboxWidth,
    0,
    Math.max(input.viewportWidth - bboxWidth, 0),
  );
  const bboxY = clamp(
    Math.round(input.viewportHeight / 2) - Math.round(bboxHeight / 2),
    0,
    Math.max(input.viewportHeight - bboxHeight, 0),
  );

  return {
    bbox: {
      x: bboxX,
      y: bboxY,
      width: bboxWidth,
      height: bboxHeight,
    },
    clickPoint: {
      x: bboxX + Math.round(bboxWidth / 2),
      y: clamp(
        bboxY + Math.round(bboxHeight * NEXT_VIDEO_ARROW_LOWER_CLICK_RATIO),
        bboxY + 1,
        bboxY + bboxHeight - 1,
      ),
    },
  };
};

const isAdvanceNextItemDeterministicFallbackEnabled = (): boolean =>
  process.env[NEXT_VIDEO_DETERMINISTIC_FALLBACK_POLICY_ENV] === "1";

const buildDeterministicNextVideoArrowFallbackCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = toDispatchPayload(inputPayload);
  const geometry = await runtime.browserController.getGeometrySnapshot();
  const executableGeometry = buildNextVideoArrowGeometry({
    viewportWidth: geometry.viewportWidth,
    viewportHeight: geometry.viewportHeight,
  });
  const sourceScreenshotEvidenceRef = resolvePayloadRef(
    payload,
    ["screenshotEvidenceRef", "sourceEvidenceRef"],
    `${envelope.inputRef}:next-video-arrow-screenshot`,
  );
  const sourceTargetRef = `${envelope.inputRef}:deterministic-fallback-geometry-candidate`;

  return JSON.parse(JSON.stringify({
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
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: envelope.stepId,
    inputRef: envelope.inputRef,
    sourceRef: sourceTargetRef,
    sourceScreenshotEvidenceRef,
    sourceTargetRef,
    sourceAiResultRef: null,
    sourcePageStateProofRef: null,
    sourceVisualTargetResultRef: null,
    sourceGeometryHandoffRef: `${envelope.inputRef}:deterministic-fallback-handoff`,
    sourceCoordinateSpace: "browserViewport",
    requestedExecutionSpace: "browserViewport",
    bbox: executableGeometry.bbox,
    clickPoint: executableGeometry.clickPoint,
    viewportSize: {
      width: geometry.viewportWidth,
      height: geometry.viewportHeight,
    },
    deviceScaleFactor: geometry.scaleFactor,
    riskLevel: "high",
    requiresPostClickAiVerification: true,
    fallbackReason: "missing_governed_next_item_target_candidate",
    targetSemanticOwner: "missing",
    actionableMessage: "Deterministic fallback geometry may click a previous or incorrect affordance; post-click AI verification is mandatory before treating the item as advanced.",
    dataQualityFlags: [
      "deterministic_next_video_arrow_geometry_fallback",
      "mechanical_click_success_is_not_next_item_semantic_success",
      "requires_post_click_ai_verification",
    ],
    idempotencyKey: envelope.idempotencyKey,
  }));
};

const resolveNextItemTargetCandidateRef = (payload: DispatchPayloadRecord): string | null =>
  payloadValueToString(payload.nextItemTargetCandidateRef)
  ?? payloadValueToString(payload.aiTargetCandidateRef)
  ?? payloadValueToString(payload.targetCandidateRef)
  ?? payloadValueToString(payload.sourceVisualTargetResultRef);

const readSummaryNumber = (summary: Record<string, unknown> | null, key: string): number | null => {
  const value = summary?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const readSummaryString = (summary: Record<string, unknown> | null, key: string): string | null => {
  const value = summary?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const buildStructuredNextItemGeometryCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
  targetCandidateRef: string,
) => {
  const payload = toDispatchPayload(inputPayload);
  const geometry = await runtime.browserController.getGeometrySnapshot();
  const summary = resolveAbilityResultProofSummary(targetCandidateRef);
  const bboxX = readSummaryNumber(summary, "sourceBoundsX");
  const bboxY = readSummaryNumber(summary, "sourceBoundsY");
  const bboxWidth = readSummaryNumber(summary, "sourceBoundsWidth");
  const bboxHeight = readSummaryNumber(summary, "sourceBoundsHeight");
  const clickX = readSummaryNumber(summary, "normalizedClickPointX");
  const clickY = readSummaryNumber(summary, "normalizedClickPointY");
  const normalizedCoordinateSpace = readSummaryString(summary, "normalizedCoordinateSpace");
  const sourceVisualTargetResultRef = payloadValueToString(payload.sourceVisualTargetResultRef)
    ?? payloadValueToString(payload.visualTargetRef)
    ?? readSummaryString(summary, "sourceVisualTargetResultRef");

  if (!sourceVisualTargetResultRef || bboxX === null || bboxY === null || bboxWidth === null || bboxHeight === null || clickX === null || clickY === null) {
    throw new Error("normalize-next-video-arrow received a target candidate ref but lacks structured Visual Target geometry proof; deterministic geometry is fallback-only and cannot replace candidate validation.");
  }

  const sourceTargetRef = readSummaryString(summary, "sourceTargetRef") ?? targetCandidateRef;
  const sourceScreenshotEvidenceRef = readSummaryString(summary, "sourceScreenshotEvidenceRef")
    ?? resolvePayloadRef(payload, ["screenshotEvidenceRef", "sourceEvidenceRef"], `${envelope.inputRef}:next-video-arrow-screenshot`);
  const rawGeometry = {
    bbox: { x: bboxX, y: bboxY, width: bboxWidth, height: bboxHeight },
    clickPoint: { x: clickX, y: clickY },
  };
  const screenshotHandoff = resolveScreenshotSourceHandoff([
    sourceScreenshotEvidenceRef,
    payloadValueToString(payload.screenshotEvidenceRef),
    payloadValueToString(payload.sourceEvidenceRef),
  ]);
  const sourceWidth = readSummaryNumber(screenshotHandoff?.sourceProof ?? null, "sourceWidth");
  const sourceHeight = readSummaryNumber(screenshotHandoff?.sourceProof ?? null, "sourceHeight");
  const shouldProjectGeometry = sourceWidth !== null
    && sourceHeight !== null
    && shouldProjectSourceGeometryToViewport({
      ...rawGeometry,
      viewportWidth: geometry.viewportWidth,
      viewportHeight: geometry.viewportHeight,
      coordinateSpace: normalizedCoordinateSpace,
    });
  const projectedGeometry = shouldProjectGeometry
    ? projectSourceGeometryToViewport({
      ...rawGeometry,
      sourceWidth,
      sourceHeight,
      viewportWidth: geometry.viewportWidth,
      viewportHeight: geometry.viewportHeight,
    })
    : rawGeometry;
  const executableGeometry = clampViewportGeometry({
    bbox: projectedGeometry.bbox,
    clickPoint: projectedGeometry.clickPoint,
    viewportWidth: geometry.viewportWidth,
    viewportHeight: geometry.viewportHeight,
  });
  const dataQualityFlags = [
    "governed_next_item_target_candidate_geometry",
    ...(shouldProjectGeometry ? ["governed_next_item_geometry_projected_from_source_screenshot"] : []),
  ];

  return JSON.parse(JSON.stringify({
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
    sourceAbilityGroupId: "visual-target",
    sourceChildCapabilityId: "observe-next-item-target-candidate",
    inputRef: envelope.inputRef,
    sourceRef: sourceTargetRef,
    sourceScreenshotEvidenceRef,
    sourceTargetRef,
    sourceAiResultRef: payloadValueToString(payload.sourceAiResultRef) ?? readSummaryString(summary, "sourceAiResultRef"),
    sourcePageStateProofRef: null,
    sourceVisualTargetResultRef,
    sourceGeometryHandoffRef: readSummaryString(summary, "sourceGeometryHandoffRef"),
    sourceCoordinateSpace: "browserViewport",
    requestedExecutionSpace: "browserViewport",
    bbox: executableGeometry.bbox,
    clickPoint: executableGeometry.clickPoint,
    viewportSize: {
      width: geometry.viewportWidth,
      height: geometry.viewportHeight,
    },
    deviceScaleFactor: geometry.scaleFactor,
    targetSemanticOwner: "visual-target",
    dataQualityFlags,
    idempotencyKey: envelope.idempotencyKey,
  }));
};

export const buildAdvanceNextItemGeometryGuardCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = toDispatchPayload(inputPayload);
  const targetCandidateRef = resolveNextItemTargetCandidateRef(payload);

  if (targetCandidateRef) {
    return buildStructuredNextItemGeometryCommand(runtime, envelope, inputPayload, targetCandidateRef);
  }
  if (!isAdvanceNextItemDeterministicFallbackEnabled()) {
    throw new Error("Advance Next Item target candidate is required; deterministic next-video geometry is fallback-only and disabled.");
  }
  return buildDeterministicNextVideoArrowFallbackCommand(runtime, envelope, inputPayload);
};
