import { createHash } from "node:crypto";

import type {
  ScreenshotAbilityResult,
  ScreenshotRuntimeProof,
  ScreenshotScaleMapping,
} from "../contract.js";
import { SCREENSHOT_ABILITY_GROUP_ID } from "../shared/screenshot-types.js";
import { finishScreenshotClock } from "./screenshot-clock.js";
import { buildScreenshotRuntimeProof } from "./screenshot-proof-builder.js";
import { buildScreenshotResult } from "./screenshot-result-builder.js";
import type { ScreenshotSuccessPathInput } from "./screenshot-execution-success-helpers.js";

function buildRef(prefix: string, input: string): string {
  return `${prefix}:${createHash("sha256").update(input).digest("hex").slice(0, 24)}`;
}

type ScreenshotSuccessClockFinish = ReturnType<typeof finishScreenshotClock>;

type ScreenshotSuccessRuntimeProofInput = {
  pathInput: ScreenshotSuccessPathInput;
  finished: ScreenshotSuccessClockFinish;
  sourceHash: string;
  scaleMapping: ScreenshotScaleMapping | null;
  coordinateSpace: ScreenshotRuntimeProof["coordinateSpace"];
  outputWidth: number | null;
  outputHeight: number | null;
  dataQualityFlags: ScreenshotRuntimeProof["dataQualityFlags"];
  outputBoundaryDecision: ScreenshotRuntimeProof["outputBoundaryDecision"];
};

const buildScreenshotSuccessDataQualityFlags = (input: ScreenshotSuccessPathInput): ScreenshotRuntimeProof["dataQualityFlags"] => [
  "artifact_persisted",
  input.plan.kind === "capture" ? "capture_fresh" : "scale_mapping_verified",
  input.gates.browserSessionGate.decision.status === "passed" ? "browser_session_verified" : null,
  input.gates.pageStateGate.pageStateProofRef ? "page_state_verified" : "page_state_unverified",
  input.regionGate.decision.status === "passed" ? "region_proof_verified" : null,
  input.plan.kind === "image-processing" && input.plan.operation === "optimize-lossless" ? "lossless_equivalence_verified" : null,
  input.request.childCapabilityId === "capture-desktop-screen" ? "desktop_capture_requested" : null,
].filter((value): value is ScreenshotRuntimeProof["dataQualityFlags"][number] => value !== null);

const buildScreenshotSuccessRuntimeProofIdentityFields = (input: ScreenshotSuccessRuntimeProofInput) => ({
  proofId: buildRef("screenshot-proof", `${input.pathInput.scope.inputRef}:${input.pathInput.scope.idempotencyKey}:success`),
  runId: input.pathInput.scope.runId,
  missionId: input.pathInput.scope.missionId,
  sessionId: input.pathInput.request.sessionId,
  roundId: input.pathInput.request.roundId,
  videoVisitId: input.pathInput.request.videoVisitId,
  abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
  childCapabilityId: input.pathInput.request.childCapabilityId,
  sourceAbilityGroupId: input.pathInput.request.sourceAbilityGroupId,
  sourceChildCapabilityId: input.pathInput.request.sourceChildCapabilityId,
  inputRef: input.pathInput.scope.inputRef,
  outputRef: input.pathInput.scope.outputRef,
  sourceProofRef: input.pathInput.gates.sourceGate.sourceProof?.proofRef ?? null,
  pageStateProofRef: input.pathInput.gates.pageStateGate.pageStateProofRef,
  browserSessionRef: input.pathInput.gates.browserSessionGate.browserSessionRef,
  screenshotEvidenceId: input.pathInput.scope.evidenceId,
  artifactRef: input.pathInput.artifactGate.artifactRef,
  sourceArtifactRef: input.pathInput.gates.sourceGate.sourceProof?.sourceArtifactRef ?? null,
  sourceHash: input.sourceHash,
  outputHash: input.pathInput.artifactGate.outputHash,
  sourceWidth: input.pathInput.plan.kind === "capture" ? input.outputWidth : (input.pathInput.imageRun?.output?.sourceWidth ?? input.pathInput.gates.sourceGate.sourceProof?.sourceWidth ?? null),
  sourceHeight: input.pathInput.plan.kind === "capture" ? input.outputHeight : (input.pathInput.imageRun?.output?.sourceHeight ?? input.pathInput.gates.sourceGate.sourceProof?.sourceHeight ?? null),
  outputWidth: input.outputWidth,
  outputHeight: input.outputHeight,
  coordinateSpace: input.coordinateSpace,
  sourceCoordinateSpace: input.pathInput.gates.sourceGate.sourceProof?.coordinateSpace ?? null,
  scaleMapping: input.scaleMapping,
  region: input.pathInput.request.region,
});

const buildScreenshotSuccessRuntimeProofDecisionFields = (input: ScreenshotSuccessRuntimeProofInput) => ({
  idempotencyKey: input.pathInput.scope.idempotencyKey,
  startedAt: input.pathInput.clockStart.startedAt,
  endedAt: input.finished.endedAt,
  durationMs: input.finished.durationMs,
  status: "success" as const,
  failureReason: null,
  reviewRequiredReason: null,
  privacyDecision: input.pathInput.gates.privacyGate.decision,
  sourceDecision: input.pathInput.gates.sourceGate.decision,
  browserSessionDecision: input.pathInput.gates.browserSessionGate.decision,
  pageStateDecision: input.pathInput.gates.pageStateGate.decision,
  captureDecision: input.pathInput.captureRun?.decision ?? { status: "not_applicable" as const, reason: null },
  imageProcessingDecision: input.pathInput.imageRun?.decision ?? { status: "not_applicable" as const, reason: null },
  artifactDecision: input.pathInput.artifactGate.decision,
  outputBoundaryDecision: input.outputBoundaryDecision,
  clock: {
    portKind: "system-monotonic-screenshot-clock" as const,
    startedMonotonicMs: input.pathInput.clockStart.startedMonotonicMs,
    endedMonotonicMs: input.finished.endedMonotonicMs,
  },
  dataQualityFlags: input.dataQualityFlags,
});

const buildScreenshotSuccessRuntimeProof = (input: ScreenshotSuccessRuntimeProofInput): ScreenshotRuntimeProof =>
  buildScreenshotRuntimeProof({
    request: input.pathInput.request,
    proofId: buildScreenshotSuccessRuntimeProofIdentityFields(input).proofId,
    runId: buildScreenshotSuccessRuntimeProofIdentityFields(input).runId,
    missionId: buildScreenshotSuccessRuntimeProofIdentityFields(input).missionId,
    inputRef: buildScreenshotSuccessRuntimeProofIdentityFields(input).inputRef,
    outputRef: buildScreenshotSuccessRuntimeProofIdentityFields(input).outputRef,
    idempotencyKey: buildScreenshotSuccessRuntimeProofDecisionFields(input).idempotencyKey,
    startedAt: buildScreenshotSuccessRuntimeProofDecisionFields(input).startedAt,
    endedAt: buildScreenshotSuccessRuntimeProofDecisionFields(input).endedAt,
    durationMs: buildScreenshotSuccessRuntimeProofDecisionFields(input).durationMs,
    startedMonotonicMs: buildScreenshotSuccessRuntimeProofDecisionFields(input).clock.startedMonotonicMs,
    endedMonotonicMs: buildScreenshotSuccessRuntimeProofDecisionFields(input).clock.endedMonotonicMs,
    status: buildScreenshotSuccessRuntimeProofDecisionFields(input).status,
    failureReason: buildScreenshotSuccessRuntimeProofDecisionFields(input).failureReason,
    reviewRequiredReason: buildScreenshotSuccessRuntimeProofDecisionFields(input).reviewRequiredReason,
    sourceProof: input.pathInput.gates.sourceGate.sourceProof,
    artifactRef: buildScreenshotSuccessRuntimeProofIdentityFields(input).artifactRef,
    sourceArtifactRef: input.pathInput.gates.sourceGate.sourceProof?.sourceArtifactRef ?? null,
    sourceHash: buildScreenshotSuccessRuntimeProofIdentityFields(input).sourceHash,
    outputHash: buildScreenshotSuccessRuntimeProofIdentityFields(input).outputHash,
    sourceWidth: buildScreenshotSuccessRuntimeProofIdentityFields(input).sourceWidth,
    sourceHeight: buildScreenshotSuccessRuntimeProofIdentityFields(input).sourceHeight,
    outputWidth: buildScreenshotSuccessRuntimeProofIdentityFields(input).outputWidth,
    outputHeight: buildScreenshotSuccessRuntimeProofIdentityFields(input).outputHeight,
    coordinateSpace: buildScreenshotSuccessRuntimeProofIdentityFields(input).coordinateSpace,
    scaleMapping: buildScreenshotSuccessRuntimeProofIdentityFields(input).scaleMapping,
    browserSessionRef: buildScreenshotSuccessRuntimeProofIdentityFields(input).browserSessionRef,
    pageStateProofRef: buildScreenshotSuccessRuntimeProofIdentityFields(input).pageStateProofRef,
    screenshotEvidenceId: buildScreenshotSuccessRuntimeProofIdentityFields(input).screenshotEvidenceId,
    decisions: {
      privacyDecision: buildScreenshotSuccessRuntimeProofDecisionFields(input).privacyDecision,
      sourceDecision: buildScreenshotSuccessRuntimeProofDecisionFields(input).sourceDecision,
      browserSessionDecision: buildScreenshotSuccessRuntimeProofDecisionFields(input).browserSessionDecision,
      pageStateDecision: buildScreenshotSuccessRuntimeProofDecisionFields(input).pageStateDecision,
      captureDecision: buildScreenshotSuccessRuntimeProofDecisionFields(input).captureDecision,
      imageProcessingDecision: buildScreenshotSuccessRuntimeProofDecisionFields(input).imageProcessingDecision,
      artifactDecision: buildScreenshotSuccessRuntimeProofDecisionFields(input).artifactDecision,
      outputBoundaryDecision: buildScreenshotSuccessRuntimeProofDecisionFields(input).outputBoundaryDecision,
    },
    dataQualityFlags: buildScreenshotSuccessRuntimeProofDecisionFields(input).dataQualityFlags,
  });

export const buildScreenshotSuccessResult = async (input: {
  pathInput: ScreenshotSuccessPathInput;
  sourceHash: string;
  scaleMapping: ScreenshotScaleMapping | null;
  coordinateSpace: ScreenshotRuntimeProof["coordinateSpace"];
  outputWidth: number | null;
  outputHeight: number | null;
  successOutput: NonNullable<ScreenshotAbilityResult["output"]>;
  outputBoundaryDecision: ScreenshotRuntimeProof["outputBoundaryDecision"];
}): Promise<ScreenshotAbilityResult> => {
  const finished = finishScreenshotClock({
    clockPort: input.pathInput.context.clockPort,
    startedAt: input.pathInput.clockStart.startedAt,
    startedMonotonicMs: input.pathInput.clockStart.startedMonotonicMs,
  });
  const dataQualityFlags = buildScreenshotSuccessDataQualityFlags(input.pathInput);
  const runtimeProof = buildScreenshotSuccessRuntimeProof({
    pathInput: input.pathInput,
    finished,
    sourceHash: input.sourceHash,
    scaleMapping: input.scaleMapping,
    coordinateSpace: input.coordinateSpace,
    outputWidth: input.outputWidth,
    outputHeight: input.outputHeight,
    dataQualityFlags,
    outputBoundaryDecision: input.outputBoundaryDecision,
  });

  return buildScreenshotResult({
    request: input.pathInput.request,
    status: "success",
    message: "Screenshot execution succeeded.",
    output: input.successOutput,
    failureReason: null,
    reviewRequiredReason: null,
    runtimeProof,
  });
};