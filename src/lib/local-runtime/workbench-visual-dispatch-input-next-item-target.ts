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

const buildPageStateProof = (input: {
  runtime: WorkbenchRuntime;
  envelope: AbilityCommandEnvelope;
  payload: DispatchPayloadRecord;
  screenshotProofRef: string;
}) => {
  const session = input.runtime.browserController.getSessionState();
  const currentUrl = session.currentUrl ?? payloadValueToString(input.payload.targetUrl) ?? "about:blank";
  const currentTitle = session.currentTitle ?? payloadValueToString(input.payload.targetTitle);
  const observedAt = new Date().toISOString();
  const pageStateProofRef = `${input.screenshotProofRef}:page-state`;
  const fingerprintSeed = {
    currentTitle,
    currentUrl,
    pageStateProofRef,
    pageStateType: "platform_feed",
    sessionId: input.envelope.sessionId,
  };

  return {
    pageStateProofRef,
    pageStateType: "platform_feed",
    pageStateFingerprint: buildHash(fingerprintSeed),
    pageStateHash: buildHash({ currentTitle, currentUrl, pageStateType: "platform_feed" }),
    decision: "allow",
    currentUrl,
    currentTitle: currentTitle ?? null,
    observedAt,
    sessionId: input.envelope.sessionId,
    roundId: input.envelope.roundId,
    videoVisitId: input.envelope.videoVisitId,
  };
};

const buildNextItemCandidates = (input: {
  aiResultRef: string;
  capturedAt: string;
  sourceProofRef: string;
  targetCandidates: NonNullable<ReturnType<typeof resolveAiVisualTargetCandidateOutputSummary>>["targetCandidates"];
}) => input.targetCandidates.map((candidate) => ({
  candidateRef: `${input.aiResultRef}:${candidate.candidateId}`,
  candidateKind: "ai_candidate",
  targetType: "next_item_target_candidate",
  boundingBox: candidate.boundingBox,
  clickPoint: candidate.clickPoint,
  confidence: candidate.confidence,
  coordinateSpace: candidate.coordinateSpace,
  sourceProofRef: input.sourceProofRef,
  capturedAt: input.capturedAt,
  sourceFrameRef: null,
  detectionMethod: "ai_visual_target_candidate_analysis",
  visibleText: candidate.visibleText,
  uncertainty: candidate.uncertainty,
  blockedReason: null,
  isVisible: true,
  scaleMapping: null,
  dataQualityFlags: [],
}));

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

  const coordinateSpace = mapCoordinateSpace(screenshotHandoff.coordinateSpace);
  const sourceProofRef = `${aiSummary.aiResultRef}:next-item-source-proof`;
  const aiInputArtifactRef = aiSummary.aiInputArtifactRef
    ?? payloadValueToString(payload.promptInputRef)
    ?? payloadValueToString(payload.nextItemVerificationPromptInputRef)
    ?? `${aiSummary.aiResultRef}:prompt-input`;

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
        aiResultRef: aiSummary.aiResultRef,
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
      pageState: buildPageStateProof({ runtime, envelope, payload, screenshotProofRef }),
      operatorApproval: null,
    },
    candidates: buildNextItemCandidates({
      aiResultRef: aiSummary.aiResultRef,
      capturedAt: aiSummary.capturedAt,
      sourceProofRef,
      targetCandidates: aiSummary.targetCandidates,
    }),
  }));
};