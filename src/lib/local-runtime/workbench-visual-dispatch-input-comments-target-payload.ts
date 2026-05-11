import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";

type CommentsAiSummary = {
  aiProofRef: string;
  promptContractId: string;
  outputSchemaRef: string;
  aiInputArtifactRef: string | null;
  aiInputHash: string;
  outputPayloadHash: string;
  capturedAt: string;
  missionId: string | null;
  runId: string | null;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  confidence: number;
  modelRole: string;
};

type CommentsPageStateSummary = {
  pageStateProofRef: string;
  pageStateChildCapabilityId: string;
  pageStateFingerprint: string;
  pageStateHash: string;
  pageStateStatus: string;
  currentUrl: string | null;
  currentTitle: string | null;
  observedAt: string;
  missionId: string;
  runId: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
};

type CommentsScreenshotHandoff = {
  sourceStorageRef: string;
  sourceProof: Record<string, unknown>;
};

type CommentsSourceProofInput = {
  aiSummary: CommentsAiSummary;
  artifactHash: string;
  coordinateSpace: string;
  coordinateAuthority: string;
  governedAiResultRef: string;
  imageHeight: number;
  imageWidth: number;
  pageStateSummary: CommentsPageStateSummary;
  screenshotHandoff: CommentsScreenshotHandoff;
  screenshotMissionId: string | null;
  screenshotProofRef: string;
  screenshotRunId: string | null;
  sourceImageHash: string;
  sourceProofRef: string;
  sourceScreenshotEvidenceId: string;
};

type CommentsCommandPayloadInput = {
  candidates: unknown[];
  envelope: AbilityCommandEnvelope;
  sourceProof: ReturnType<typeof buildCommentsEntrySourceProof>;
};

const buildCommentsCommandIdentity = (envelope: AbilityCommandEnvelope) => ({
  abilityGroupId: "visual-target",
  childCapabilityId: "observe-comments-button",
  missionId: envelope.missionId,
  runId: envelope.runId,
  sessionId: envelope.sessionId,
  roundId: envelope.roundId,
  videoVisitId: envelope.videoVisitId,
  stepId: envelope.stepId,
  bindingPackageId: envelope.bindingPackageId,
  bindingPackageVersion: envelope.bindingPackageVersion,
  selectedBindingId: envelope.mapId,
  bindingVersion: envelope.bindingVersion,
  bindingActivationRef: envelope.bindingActivationRef,
  bindingSnapshotRef: envelope.bindingSnapshotRef,
  capabilityCallId: envelope.capabilityCallId,
  nerveBusEnvelopeId: envelope.nerveBusEnvelopeId,
  requestedBy: "orchestration",
  sourceAbilityGroupId: "orchestration",
  sourceChildCapabilityId: "comments-entry-target-candidate-analysis",
  inputRef: envelope.inputRef,
  idempotencyKey: envelope.idempotencyKey,
  targetType: "comments_button",
  targetNature: "action",
});

const buildCommentsScreenshotProof = (input: CommentsSourceProofInput) => ({
  screenshotEvidenceId: input.sourceScreenshotEvidenceId,
  artifactRef: input.screenshotHandoff.sourceStorageRef,
  screenshotProofRef: input.screenshotProofRef,
  artifactHash: input.artifactHash,
  imageHash: input.sourceImageHash,
  imageWidth: input.imageWidth,
  imageHeight: input.imageHeight,
  coordinateSpace: input.coordinateSpace,
  coordinateAuthority: input.coordinateAuthority,
  sourceScreenshotEvidenceId: input.sourceScreenshotEvidenceId,
  scaleMapping: null,
  capturedAt: input.aiSummary.capturedAt,
  missionId: input.screenshotMissionId,
  runId: input.screenshotRunId,
  sessionId: input.aiSummary.sessionId,
  roundId: input.aiSummary.roundId,
  videoVisitId: input.aiSummary.videoVisitId,
});

const buildCommentsAiProof = (input: CommentsSourceProofInput) => ({
  aiResultRef: input.governedAiResultRef,
  aiProofRef: input.aiSummary.aiProofRef,
  promptContractId: input.aiSummary.promptContractId,
  outputSchemaRef: input.aiSummary.outputSchemaRef,
  aiInputArtifactRef: input.aiSummary.aiInputArtifactRef ?? `${input.governedAiResultRef}:prompt-input`,
  aiInputHash: input.aiSummary.aiInputHash,
  outputPayloadHash: input.aiSummary.outputPayloadHash,
  sourceImageHash: input.sourceImageHash,
  sourceScreenshotEvidenceId: input.sourceScreenshotEvidenceId,
  sourceScreenshotProofRef: input.screenshotProofRef,
  capturedAt: input.aiSummary.capturedAt,
  missionId: input.aiSummary.missionId,
  runId: input.aiSummary.runId,
  sessionId: input.aiSummary.sessionId,
  roundId: input.aiSummary.roundId,
  videoVisitId: input.aiSummary.videoVisitId,
  confidence: input.aiSummary.confidence,
  modelRole: input.aiSummary.modelRole,
});

const buildCommentsPageStateProof = (pageStateSummary: CommentsPageStateSummary) => ({
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
});

export const buildCommentsEntrySourceProof = (input: CommentsSourceProofInput) => ({
  sourceProofRef: input.sourceProofRef,
  screenshot: buildCommentsScreenshotProof(input),
  ai: buildCommentsAiProof(input),
  pageState: buildCommentsPageStateProof(input.pageStateSummary),
  operatorApproval: null,
});

export const buildCommentsEntryCommandPayload = (input: CommentsCommandPayloadInput) => ({
  ...buildCommentsCommandIdentity(input.envelope),
  sourceProof: input.sourceProof,
  candidates: input.candidates,
});