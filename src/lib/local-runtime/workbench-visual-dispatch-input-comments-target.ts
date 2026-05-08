import { createHash } from "node:crypto";

import { resolveAiVisualTargetCandidateOutputSummary } from "../../capabilities/ai/index.js";
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
import {
  normalizeCandidateTextList,
  normalizeCandidateTextValue,
} from "./workbench-visual-dispatch-input-candidate-normalization.js";

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

const buildCommentsCandidates = (input: {
  governedAiResultRef: string;
  capturedAt: string;
  sourceFrameRef: string;
  sourceProofRef: string;
  targetCandidates: NonNullable<ReturnType<typeof resolveAiVisualTargetCandidateOutputSummary>>["targetCandidates"];
}) => input.targetCandidates
  .filter((candidate) => candidate.targetType === "comments_button")
  .map((candidate) => ({
    candidateRef: buildCompactRef("visual-target-candidate", [input.governedAiResultRef, candidate.candidateId, "comments-entry"]),
    candidateKind: "ai_candidate",
    targetType: "comments_button",
    boundingBox: candidate.boundingBox,
    clickPoint: candidate.clickPoint,
    confidence: candidate.confidence,
    coordinateSpace: candidate.coordinateSpace,
    sourceProofRef: input.sourceProofRef,
    capturedAt: input.capturedAt,
    sourceFrameRef: input.sourceFrameRef,
    detectionMethod: "ai_visual_target_candidate_analysis",
    visibleText: normalizeCandidateTextValue(candidate.visibleText),
    uncertainty: normalizeCandidateTextList(candidate.uncertainty),
    blockedReason: null,
    isVisible: true,
    scaleMapping: null,
    dataQualityFlags: [],
  }));

export const buildCommentsEntryVisualTargetCommand = (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = toDispatchPayload(inputPayload);
  const aiTargetCandidateRef = resolveAiTargetCandidateRef(payload);
  const aiSummary = resolveAiVisualTargetCandidateOutputSummary(aiTargetCandidateRef);

  if (!aiSummary) {
    throw new Error("Visual Target comments dispatch requires governed AI target candidate proof; heuristic candidate generation is forbidden.");
  }

  const screenshotHandoff = resolveScreenshotSourceHandoff([
    payloadValueToString(payload.screenshotEvidenceRef),
    payloadValueToString(payload.sourceEvidenceRef),
  ]);

  if (!screenshotHandoff || !isRecord(screenshotHandoff.sourceArtifactRef) || !isRecord(screenshotHandoff.sourceProof)) {
    throw new Error("Visual Target comments dispatch requires governed screenshot source proof bound to the current viewport evidence.");
  }

  const artifactHash = readString(screenshotHandoff.sourceArtifactRef, "sha256");
  const imageWidth = readNumber(screenshotHandoff.sourceProof, "sourceWidth");
  const imageHeight = readNumber(screenshotHandoff.sourceProof, "sourceHeight");
  const screenshotProofRef = readString(screenshotHandoff.sourceProof, "proofRef");
  const sourceScreenshotEvidenceId = readString(screenshotHandoff.sourceProof, "sourceScreenshotEvidenceId")
    ?? resolvePayloadRef(payload, ["screenshotEvidenceRef", "sourceEvidenceRef"], `${envelope.inputRef}:screenshotEvidenceRef`);

  if (!artifactHash || imageWidth === null || imageHeight === null || !screenshotProofRef) {
    throw new Error("Visual Target comments dispatch screenshot proof is incomplete; image hash, dimensions, and proofRef are mandatory.");
  }

  const pageStateSummary = resolvePageStateProofSummary(payloadValueToString(payload.pageStateRef));
  if (!pageStateSummary) {
    throw new Error("Visual Target comments dispatch requires a governed page-state proof summary.");
  }

  const screenshotMissionId = readString(screenshotHandoff.sourceProof, "missionId");
  const screenshotRunId = readString(screenshotHandoff.sourceProof, "runId");
  if (!screenshotMissionId || !screenshotRunId || !aiSummary.missionId || !aiSummary.runId) {
    throw new Error("Visual Target comments dispatch requires governed screenshot and AI proof mission/run identity.");
  }

  const coordinateSpace = mapCoordinateSpace(screenshotHandoff.coordinateSpace);
  const governedAiResultRef = aiSummary.aiResultRef;
  const sourceProofRef = buildCompactRef("visual-target-source-proof", [governedAiResultRef, envelope.inputRef, "comments-entry"]);
  const aiInputArtifactRef = aiSummary.aiInputArtifactRef
    ?? payloadValueToString(payload.promptInputRef)
    ?? `${governedAiResultRef}:prompt-input`;

  return JSON.parse(JSON.stringify({
    abilityGroupId: "visual-target",
    childCapabilityId: "observe-comments-button",
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
    sourceChildCapabilityId: "comments-entry-target-candidate-analysis",
    inputRef: envelope.inputRef,
    idempotencyKey: envelope.idempotencyKey,
    targetType: "comments_button",
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
        capturedAt: aiSummary.capturedAt,
        missionId: screenshotMissionId,
        runId: screenshotRunId,
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
        missionId: aiSummary.missionId,
        runId: aiSummary.runId,
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
        missionId: pageStateSummary.missionId,
        runId: pageStateSummary.runId,
        sessionId: pageStateSummary.sessionId,
        roundId: pageStateSummary.roundId,
        videoVisitId: pageStateSummary.videoVisitId,
      },
      operatorApproval: null,
    },
    candidates: buildCommentsCandidates({
      governedAiResultRef,
      capturedAt: aiSummary.capturedAt,
      sourceFrameRef: sourceScreenshotEvidenceId,
      sourceProofRef,
      targetCandidates: aiSummary.targetCandidates,
    }),
  }));
};