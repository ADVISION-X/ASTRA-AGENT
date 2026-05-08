import { createHash } from "node:crypto";

import { resolveAiVisualTargetCandidateOutputSummary } from "../../capabilities/ai/index.js";
import { resolveAbilityResultProofSummary } from "../../capabilities/orchestration/index.js";
import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadValueToString } from "./workbench-payload.js";
import {
  resolvePayloadRef,
  toDispatchPayload,
  type DispatchPayloadRecord,
} from "./workbench-action-dispatch-shared.js";
import { resolvePageStateProofSummary } from "./workbench-page-state-proof-summary-registry.js";
import { resolveScreenshotSourceHandoff } from "./workbench-screenshot-source-handoff.js";

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: JsonRecord, key: string): string | null => {
  const candidate = value[key];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
};

const readNumber = (value: JsonRecord, key: string): number | null => {
  const candidate = value[key];
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
};

const buildHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const buildCompactRef = (prefix: string, value: unknown) =>
  `${prefix}:${buildHash(value).slice(0, 24)}`;

const normalizeCandidateText = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

const NEXT_ITEM_DIRECTION_HINTS = [
  "next",
  "advance",
  "down",
  "downward",
  "lower",
  "bottom",
  "right",
  "forward",
  "next-item",
  "next item",
  "down-arrow",
  "down arrow",
  "bottom-right",
  "lower-right",
] as const;

const NOT_NEXT_ITEM_DIRECTION_HINTS = [
  "previous",
  "prev",
  "back",
  "up",
  "upward",
  "upper",
  "top",
  "left",
  "close",
  "dismiss",
] as const;

const countDirectionHints = (text: string, hints: readonly string[]) =>
  hints.reduce((count, hint) => (text.includes(hint) ? count + 1 : count), 0);

const buildNextItemCandidateSortScore = (candidate: {
  visibleText: string | null;
  evidenceObservations: readonly string[];
  uncertainty: readonly string[];
  clickPoint: { x: number; y: number };
  confidence: number;
}) => {
  const semanticText = normalizeCandidateText([
    candidate.visibleText,
    ...candidate.evidenceObservations,
    ...candidate.uncertainty,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" "));
  const positiveHintCount = countDirectionHints(semanticText, NEXT_ITEM_DIRECTION_HINTS);
  const negativeHintCount = countDirectionHints(semanticText, NOT_NEXT_ITEM_DIRECTION_HINTS);

  return {
    positiveHintCount,
    negativeHintCount,
    clickY: candidate.clickPoint.y,
    clickX: candidate.clickPoint.x,
    confidence: candidate.confidence,
  };
};

const sortNextItemCandidates = <TCandidate extends {
  visibleText: string | null;
  evidenceObservations: readonly string[];
  uncertainty: readonly string[];
  clickPoint: { x: number; y: number };
  confidence: number;
}>(candidates: readonly TCandidate[]) => [...candidates].sort((left, right) => {
  const leftScore = buildNextItemCandidateSortScore(left);
  const rightScore = buildNextItemCandidateSortScore(right);

  if (rightScore.positiveHintCount !== leftScore.positiveHintCount) {
    return rightScore.positiveHintCount - leftScore.positiveHintCount;
  }

  if (leftScore.negativeHintCount !== rightScore.negativeHintCount) {
    return leftScore.negativeHintCount - rightScore.negativeHintCount;
  }

  if (rightScore.clickY !== leftScore.clickY) {
    return rightScore.clickY - leftScore.clickY;
  }

  if (rightScore.clickX !== leftScore.clickX) {
    return rightScore.clickX - leftScore.clickX;
  }

  return rightScore.confidence - leftScore.confidence;
});

const mapCoordinateSpace = (value: string | null) => {
  if (value === "desktop_screen_pixels") {
    return "desktop_screen";
  }
  return value === "source_image_pixels" ? "source_image" : "browser_viewport";
};

const mapCoordinateAuthority = (coordinateSpace: string) =>
  coordinateSpace === "source_image" ? "optimized_equivalent" : "evidence_original";

const resolveAiTargetCandidateRef = (payload: DispatchPayloadRecord) =>
  payloadValueToString(payload.aiTargetCandidateRef)
  ?? payloadValueToString(payload.sourceAiResultRef)
  ?? payloadValueToString(payload.aiResultRef)
  ?? payloadValueToString(payload.targetCandidateRef);

const readSummaryString = (summary: Record<string, unknown> | null, key: string): string | null => {
  const value = summary?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const readSummaryNumber = (summary: Record<string, unknown> | null, key: string): number | null => {
  const value = summary?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const mapPreparedInputCoordinateSpace = (value: string | null) => {
  if (value === "desktop_screen_pixels") {
    return "desktop_screen" as const;
  }
  return value === "browser_viewport_pixels"
    ? "browser_viewport" as const
    : value === "source_image_pixels"
      ? "source_image" as const
      : null;
};

const buildAiInputScaleMapping = (summary: Record<string, unknown> | null) => {
  const sourceCoordinateSpace = mapPreparedInputCoordinateSpace(
    readSummaryString(summary, "preparedInputSourceCoordinateSpace"),
  );
  const targetCoordinateSpace = readSummaryString(summary, "preparedInputTargetCoordinateSpace");
  const sourceScreenshotEvidenceId = readSummaryString(summary, "sourceScreenshotEvidenceId");
  const sourceWidth = readSummaryNumber(summary, "preparedInputSourceWidth");
  const sourceHeight = readSummaryNumber(summary, "preparedInputSourceHeight");
  const targetWidth = readSummaryNumber(summary, "preparedInputTargetWidth");
  const targetHeight = readSummaryNumber(summary, "preparedInputTargetHeight");
  const cropOffsetX = readSummaryNumber(summary, "preparedInputCropOffsetX");
  const cropOffsetY = readSummaryNumber(summary, "preparedInputCropOffsetY");

  if (
    !sourceCoordinateSpace
    || targetCoordinateSpace !== "ai_input_pixels"
    || !sourceScreenshotEvidenceId
    || sourceWidth === null
    || sourceHeight === null
    || targetWidth === null
    || targetHeight === null
    || cropOffsetX === null
    || cropOffsetY === null
  ) {
    return null;
  }

  return {
    sourceScreenshotEvidenceId,
    sourceCoordinateSpace,
    targetCoordinateSpace: "ai_input" as const,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    cropOffsetX,
    cropOffsetY,
    scaleX: sourceWidth / targetWidth,
    scaleY: sourceHeight / targetHeight,
  };
};

const clampToRange = (
  value: number,
  minimum: number,
  maximum: number,
) => Math.min(Math.max(value, minimum), maximum);

const clampCandidateToBounds = <TCandidate extends {
  boundingBox: { x: number; y: number; width: number; height: number };
  clickPoint: { x: number; y: number };
}>(input: {
  candidate: TCandidate;
  boundsWidth: number;
  boundsHeight: number;
}) => {
  const maxX = Math.max(input.boundsWidth - 1, 0);
  const maxY = Math.max(input.boundsHeight - 1, 0);
  const x = clampToRange(input.candidate.boundingBox.x, 0, maxX);
  const y = clampToRange(input.candidate.boundingBox.y, 0, maxY);
  const width = clampToRange(input.candidate.boundingBox.width, 1, Math.max(input.boundsWidth - x, 1));
  const height = clampToRange(input.candidate.boundingBox.height, 1, Math.max(input.boundsHeight - y, 1));
  const clickPoint = {
    x: clampToRange(input.candidate.clickPoint.x, x, x + width),
    y: clampToRange(input.candidate.clickPoint.y, y, y + height),
  };

  return {
    ...input.candidate,
    boundingBox: {
      x,
      y,
      width,
      height,
    },
    clickPoint,
  };
};

const buildNextItemCandidates = (input: {
  governedAiResultRef: string;
  capturedAt: string;
  sourceFrameRef: string;
  sourceProofRef: string;
  imageWidth: number;
  imageHeight: number;
  aiInputScaleMapping: ReturnType<typeof buildAiInputScaleMapping>;
  targetCandidates: NonNullable<ReturnType<typeof resolveAiVisualTargetCandidateOutputSummary>>["targetCandidates"];
}) => sortNextItemCandidates(input.targetCandidates).map((candidate) => {
  const boundedCandidate = clampCandidateToBounds({
    candidate,
    boundsWidth: input.aiInputScaleMapping?.targetWidth ?? input.imageWidth,
    boundsHeight: input.aiInputScaleMapping?.targetHeight ?? input.imageHeight,
  });

  return {
    candidateRef: buildCompactRef("visual-target-candidate", [input.governedAiResultRef, candidate.candidateId, "next-item"]),
    candidateKind: "ai_candidate",
    targetType: "next_item_target_candidate",
    boundingBox: boundedCandidate.boundingBox,
    clickPoint: boundedCandidate.clickPoint,
    confidence: candidate.confidence,
    coordinateSpace: input.aiInputScaleMapping ? "ai_input" : candidate.coordinateSpace,
    sourceProofRef: input.sourceProofRef,
    capturedAt: input.capturedAt,
    sourceFrameRef: input.sourceFrameRef,
    detectionMethod: "ai_visual_target_candidate_analysis",
    visibleText: candidate.visibleText,
    uncertainty: candidate.uncertainty,
    blockedReason: null,
    isVisible: true,
    scaleMapping: input.aiInputScaleMapping,
    dataQualityFlags: [],
  };
});

export const buildNextItemTargetVisualTargetCommand = (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = toDispatchPayload(inputPayload);
  const aiTargetCandidateRef = resolveAiTargetCandidateRef(payload);
  const aiSummary = resolveAiVisualTargetCandidateOutputSummary(aiTargetCandidateRef);

  if (!aiSummary) {
    throw new Error("Visual Target next-item dispatch requires governed AI target candidate proof; heuristic candidate generation is forbidden.");
  }

  const screenshotHandoff = resolveScreenshotSourceHandoff([
    payloadValueToString(payload.screenshotEvidenceRef),
    payloadValueToString(payload.sourceEvidenceRef),
    payloadValueToString(payload.nextItemVerificationEvidenceRef),
  ]);

  if (!screenshotHandoff || !isRecord(screenshotHandoff.sourceArtifactRef) || !isRecord(screenshotHandoff.sourceProof)) {
    throw new Error("Visual Target next-item dispatch requires governed screenshot source proof bound to the current viewport evidence.");
  }

  const artifactHash = readString(screenshotHandoff.sourceArtifactRef, "sha256");
  const imageWidth = readNumber(screenshotHandoff.sourceProof, "sourceWidth");
  const imageHeight = readNumber(screenshotHandoff.sourceProof, "sourceHeight");
  const screenshotProofRef = readString(screenshotHandoff.sourceProof, "proofRef");
  const sourceScreenshotEvidenceId = readString(screenshotHandoff.sourceProof, "sourceScreenshotEvidenceId")
    ?? resolvePayloadRef(payload, ["screenshotEvidenceRef", "sourceEvidenceRef"], `${envelope.inputRef}:screenshotEvidenceRef`);

  if (!artifactHash || imageWidth === null || imageHeight === null || !screenshotProofRef) {
    throw new Error("Visual Target next-item dispatch screenshot proof is incomplete; image hash, dimensions, and proofRef are mandatory.");
  }

  const pageStateSummary = resolvePageStateProofSummary(payloadValueToString(payload.pageStateRef));
  if (!pageStateSummary) {
    throw new Error("Visual Target next-item dispatch requires a governed page-state proof summary.");
  }

  const coordinateSpace = mapCoordinateSpace(screenshotHandoff.coordinateSpace);
  const governedAiResultRef = aiTargetCandidateRef;
  const sourceProofRef = buildCompactRef("visual-target-source-proof", [governedAiResultRef, envelope.inputRef, "next-item"]);
  const aiInputArtifactRef = aiSummary.aiInputArtifactRef
    ?? payloadValueToString(payload.promptInputRef)
    ?? payloadValueToString(payload.nextItemVerificationPromptInputRef)
    ?? `${governedAiResultRef}:prompt-input`;
  const aiInputProofSummary = resolveAbilityResultProofSummary(aiInputArtifactRef);
  const aiInputScaleMapping = buildAiInputScaleMapping(aiInputProofSummary);

  return JSON.parse(JSON.stringify({
    abilityGroupId: "visual-target",
    childCapabilityId: "observe-next-item-target-candidate",
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
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: "next-item-target-candidate-analysis",
    inputRef: envelope.inputRef,
    idempotencyKey: envelope.idempotencyKey,
    targetType: "next_item_target_candidate",
    targetNature: "action",
    sourceProof: {
      sourceProofRef,
      screenshot: {
        screenshotEvidenceId: sourceScreenshotEvidenceId,
        artifactRef: screenshotHandoff.sourceStorageRef,
        screenshotProofRef,
        artifactHash,
        imageHash: readString(screenshotHandoff.sourceProof, "sourceHash") ?? artifactHash,
        imageWidth,
        imageHeight,
        coordinateSpace,
        coordinateAuthority: mapCoordinateAuthority(coordinateSpace),
        sourceScreenshotEvidenceId,
        scaleMapping: null,
        capturedAt: readString(screenshotHandoff.sourceProof, "stepId") ? aiSummary.capturedAt : aiSummary.capturedAt,
        sessionId: envelope.sessionId,
        roundId: envelope.roundId,
        videoVisitId: envelope.videoVisitId,
      },
      ai: {
        aiResultRef: governedAiResultRef,
        aiProofRef: aiSummary.aiProofRef,
        promptContractId: aiSummary.promptContractId,
        outputSchemaRef: aiSummary.outputSchemaRef,
        aiInputArtifactRef,
        aiInputHash: aiSummary.aiInputHash,
        outputPayloadHash: aiSummary.outputPayloadHash,
        sourceImageHash: readString(screenshotHandoff.sourceProof, "sourceHash") ?? artifactHash,
        sourceScreenshotEvidenceId,
        sourceScreenshotProofRef: screenshotProofRef,
        capturedAt: aiSummary.capturedAt,
        sessionId: aiSummary.sessionId,
        roundId: aiSummary.roundId,
        videoVisitId: aiSummary.videoVisitId,
        confidence: aiSummary.confidence,
        modelRole: aiSummary.modelRole,
      },
      pageState: {
        pageStateProofRef: pageStateSummary.pageStateProofRef,
        pageStateChildCapabilityId: pageStateSummary.pageStateChildCapabilityId,
        pageStateFingerprint: pageStateSummary.pageStateFingerprint,
        pageStateHash: pageStateSummary.pageStateHash,
        pageStateStatus: pageStateSummary.pageStateStatus,
        currentUrl: pageStateSummary.currentUrl,
        currentTitle: pageStateSummary.currentTitle,
        observedAt: pageStateSummary.observedAt,
        sessionId: pageStateSummary.sessionId,
        roundId: pageStateSummary.roundId,
        videoVisitId: pageStateSummary.videoVisitId,
      },
      operatorApproval: null,
    },
    candidates: buildNextItemCandidates({
      governedAiResultRef,
      capturedAt: aiSummary.capturedAt,
      sourceFrameRef: sourceScreenshotEvidenceId,
      sourceProofRef,
      imageWidth,
      imageHeight,
      aiInputScaleMapping,
      targetCandidates: aiSummary.targetCandidates,
    }),
  }));
};