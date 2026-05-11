import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";

type NextItemAiSummary = {
  aiProofRef: string;
  promptContractId: string;
  outputSchemaRef: string;
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

type NextItemPageStateSummary = {
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

type NextItemScreenshotHandoff = {
  sourceStorageRef: string;
};

type NextItemSourceProofInput = {
  aiInputArtifactRef: string;
  aiSummary: NextItemAiSummary;
  artifactHash: string;
  coordinateAuthority: string;
  coordinateSpace: string;
  governedAiResultRef: string;
  imageHeight: number;
  imageWidth: number;
  pageStateSummary: NextItemPageStateSummary;
  screenshotHandoff: NextItemScreenshotHandoff;
  screenshotMissionId: string | null;
  screenshotProofRef: string;
  screenshotRunId: string | null;
  sourceImageHash: string;
  sourceProofRef: string;
  sourceScreenshotEvidenceId: string;
};

type NextItemCommandPayloadInput = {
  candidates: unknown[];
  envelope: AbilityCommandEnvelope;
  sourceProof: ReturnType<typeof buildNextItemTargetSourceProof>;
};

const buildNextItemCommandIdentity = (envelope: AbilityCommandEnvelope) => ({
  abilityGroupId: "visual-target",
  childCapabilityId: "observe-next-item-target-candidate",
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
  sourceChildCapabilityId: "next-item-target-candidate-analysis",
  inputRef: envelope.inputRef,
  idempotencyKey: envelope.idempotencyKey,
  targetType: "next_item_target_candidate",
  targetNature: "action",
});

const buildNextItemScreenshotProof = (input: NextItemSourceProofInput) => ({
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

const buildNextItemAiProof = (input: NextItemSourceProofInput) => ({
  aiResultRef: input.governedAiResultRef,
  aiProofRef: input.aiSummary.aiProofRef,
  promptContractId: input.aiSummary.promptContractId,
  outputSchemaRef: input.aiSummary.outputSchemaRef,
  aiInputArtifactRef: input.aiInputArtifactRef,
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

const buildNextItemPageStateProof = (pageStateSummary: NextItemPageStateSummary) => ({
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

const buildNextItemTargetSourceProof = (input: NextItemSourceProofInput) => ({
  sourceProofRef: input.sourceProofRef,
  screenshot: buildNextItemScreenshotProof(input),
  ai: buildNextItemAiProof(input),
  pageState: buildNextItemPageStateProof(input.pageStateSummary),
  operatorApproval: null,
});

const buildNextItemTargetCommandPayload = (input: NextItemCommandPayloadInput) => ({
  ...buildNextItemCommandIdentity(input.envelope),
  sourceProof: input.sourceProof,
  candidates: input.candidates,
});

export { buildNextItemTargetCommandPayload, buildNextItemTargetSourceProof };