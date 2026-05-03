import type { ScreenshotAbilityInput, ScreenshotAbilityResult, ScreenshotFailure, ScreenshotRuntimeProof, ScreenshotSourceProof } from "../contract.js";
import { runRegionProofGate } from "./region-proof-gate.js";
import { runCaptureRunner } from "./capture-runner.js";
import { runImageProcessingRunner } from "./image-processing-runner.js";
import { runArtifactStorageGate } from "./artifact-storage-gate.js";
import { executeScreenshotExecutionSuccess } from "./screenshot-execution-success.js";
import {
  buildScreenshotArtifactStorageFailure,
  buildScreenshotCaptureExecutionFailure,
  buildScreenshotOutputMetadataFailure,
  buildScreenshotRegionValidationFailure,
} from "./screenshot-execution-failure-builders.js";
import {
  resolveScreenshotCaptureAndImagePhaseFailure,
  resolveScreenshotCaptureRun,
  resolveScreenshotImageRun,
  resolveScreenshotOutputMetadata,
} from "./screenshot-execution-phase-helpers.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";
import type { ScreenshotChildRegistryEntry, ScreenshotExecutionPlan } from "./screenshot-child-contract.js";
import type { ScreenshotExecutionScope } from "./screenshot-execution-failure.js";
import type { ScreenshotClockStart } from "./screenshot-clock.js";

type ScreenshotDecision = ScreenshotRuntimeProof["privacyDecision"];

export type ScreenshotExecutionGateState = {
  failure: ScreenshotFailure | null;
  decision: ScreenshotDecision;
};

export type ScreenshotExecutionSourceGateState = ScreenshotExecutionGateState & {
  sourceProof: ScreenshotSourceProof | null;
};

export type ScreenshotExecutionBrowserSessionGateState = ScreenshotExecutionGateState & {
  browserSessionRef: string | null;
};

export type ScreenshotExecutionPageStateGateState = ScreenshotExecutionGateState & {
  pageStateProofRef: string | null;
};

export type ScreenshotExecutionGates = {
  sourceGate: ScreenshotExecutionSourceGateState;
  browserSessionGate: ScreenshotExecutionBrowserSessionGateState;
  pageStateGate: ScreenshotExecutionPageStateGateState;
  privacyGate: ScreenshotExecutionGateState;
};

async function executeScreenshotRegionGatePhase(input: {
  plan: ScreenshotExecutionPlan;
  gates: ScreenshotExecutionGates;
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
}): Promise<{ regionGate: { failure: ScreenshotFailure | null; decision: ScreenshotDecision } } | ScreenshotAbilityResult> {
  const regionGate = runRegionProofGate({
    sourceProof: input.gates.sourceGate.sourceProof,
    region: input.plan.kind === "image-processing" && "region" in input.plan ? input.plan.region : null,
  });
  if (regionGate.failure || regionGate.decision.status === "failed") {
    return await buildScreenshotRegionValidationFailure({
      request: input.request,
      context: input.context,
      scope: input.scope,
      clockStart: input.clockStart,
      sourceGate: input.gates.sourceGate,
      browserSessionGate: input.gates.browserSessionGate,
      pageStateGate: input.gates.pageStateGate,
      privacyGate: input.gates.privacyGate,
      regionGate,
    });
  }
  return { regionGate };
}

async function executeScreenshotCaptureAndImagePhase(input: {
  plan: ScreenshotExecutionPlan;
  gates: ScreenshotExecutionGates;
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
  registryEntry: ScreenshotChildRegistryEntry;
}): Promise<{ captureRun: Awaited<ReturnType<typeof runCaptureRunner>> | null; imageRun: Awaited<ReturnType<typeof runImageProcessingRunner>> | null; } | ScreenshotAbilityResult> {
  const captureRun = await resolveScreenshotCaptureRun({
    plan: input.plan,
    context: input.context,
    scope: input.scope,
    request: input.request,
    clockStart: input.clockStart,
    registryEntry: input.registryEntry,
  });
  const imageRun = await resolveScreenshotImageRun({
    plan: input.plan,
    context: input.context,
    request: input.request,
    registryEntry: input.registryEntry,
  });
  const failure = await resolveScreenshotCaptureAndImagePhaseFailure({
    request: input.request,
    context: input.context,
    scope: input.scope,
    clockStart: input.clockStart,
    sourceGate: input.gates.sourceGate,
    browserSessionGate: input.gates.browserSessionGate,
    pageStateGate: input.gates.pageStateGate,
    privacyGate: input.gates.privacyGate,
    captureRun,
    imageRun,
    executionFailure: captureRun?.failure ?? imageRun?.failure ?? null,
  });
  if (failure) {
    return failure;
  }

  return { captureRun, imageRun };
}

function validateAndExtractScreenshotMetadata(input: {
  plan: ScreenshotExecutionPlan;
  captureRun: Awaited<ReturnType<typeof runCaptureRunner>> | null;
  imageRun: Awaited<ReturnType<typeof runImageProcessingRunner>> | null;
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
  gates: ScreenshotExecutionGates;
}): Promise<ScreenshotAbilityResult | { outputFilePath: string; outputWidth: number; outputHeight: number; mimeType: string; createdAt: string }> {
  return resolveScreenshotOutputMetadata({
    plan: input.plan,
    captureRun: input.captureRun,
    imageRun: input.imageRun,
    request: input.request,
    context: input.context,
    scope: input.scope,
    clockStart: input.clockStart,
    gates: input.gates,
  }).then((metadataResolution) => (metadataResolution.ok ? metadataResolution.metadata : metadataResolution.failure));
}

function hasArtifactStorageGateRefs(artifactGate: Awaited<ReturnType<typeof runArtifactStorageGate>>) {
  return !artifactGate.artifactRef
    || !artifactGate.artifactLifecycleManifestRef
    || !artifactGate.outputHash
    || !artifactGate.artifactHash
    || !artifactGate.retentionClass
    || !artifactGate.promotionStatus;
}

function hasArtifactStorageGateMetrics(artifactGate: Awaited<ReturnType<typeof runArtifactStorageGate>>) {
  return artifactGate.byteSize === null || artifactGate.cleanupEligible === null;
}

function hasArtifactStorageGateFailure(artifactGate: Awaited<ReturnType<typeof runArtifactStorageGate>>) {
  return artifactGate.failure
    || artifactGate.decision.status !== "passed"
    || hasArtifactStorageGateRefs(artifactGate)
    || hasArtifactStorageGateMetrics(artifactGate);
}

async function buildArtifactStorageFailureResult(
  input: Parameters<typeof executeScreenshotArtifactStoragePhase>[0],
  artifactGate: Awaited<ReturnType<typeof runArtifactStorageGate>>,
) {
  return buildScreenshotArtifactStorageFailure({
    request: input.request,
    context: input.context,
    scope: input.scope,
    clockStart: input.clockStart,
    sourceGate: input.gates.sourceGate,
    browserSessionGate: input.gates.browserSessionGate,
    pageStateGate: input.gates.pageStateGate,
    privacyGate: input.gates.privacyGate,
    captureRun: input.captureRun,
    imageRun: input.imageRun,
    artifactGate,
  });
}

function buildArtifactStorageSuccessResult(
  input: Parameters<typeof executeScreenshotArtifactStoragePhase>[0],
  artifactGate: Awaited<ReturnType<typeof runArtifactStorageGate>>,
) {
  return executeScreenshotExecutionSuccess({
    request: input.request,
    context: input.context,
    registryEntry: input.registryEntry,
    clockStart: input.clockStart,
    scope: input.scope,
    gates: input.gates,
    plan: input.plan,
    regionGate: { failure: null, decision: { status: "passed", reason: null } },
    captureRun: input.captureRun,
    imageRun: input.imageRun,
    artifactGate,
  });
}

async function executeScreenshotArtifactStoragePhase(input: {
  plan: ScreenshotExecutionPlan;
  captureRun: Awaited<ReturnType<typeof runCaptureRunner>> | null;
  imageRun: Awaited<ReturnType<typeof runImageProcessingRunner>> | null;
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
  gates: ScreenshotExecutionGates;
  metadata: { outputFilePath: string; outputWidth: number; outputHeight: number; mimeType: string; createdAt: string };
  registryEntry: ScreenshotChildRegistryEntry;
}) {
  const artifactGate = await runArtifactStorageGate({
    request: input.request,
    context: input.context,
    childCapabilityId: input.request.childCapabilityId,
    evidenceId: input.scope.evidenceId,
    outputFilePath: input.metadata.outputFilePath,
    imageKind: input.registryEntry.outputImageKind,
    width: input.metadata.outputWidth,
    height: input.metadata.outputHeight,
    mimeType: input.metadata.mimeType,
    createdAt: input.metadata.createdAt,
  });
  if (hasArtifactStorageGateFailure(artifactGate)) {
    return await buildArtifactStorageFailureResult(input, artifactGate);
  }

  return buildArtifactStorageSuccessResult(input, artifactGate);
}

export async function executeScreenshotExecutionPhases(input: {
  plan: ScreenshotExecutionPlan;
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  registryEntry: ScreenshotChildRegistryEntry;
  clockStart: ScreenshotClockStart;
  scope: ScreenshotExecutionScope;
  gates: ScreenshotExecutionGates;
}): Promise<ScreenshotAbilityResult> {
  const regionPhase = await executeScreenshotRegionGatePhase(input);
  if ("status" in regionPhase) {
    return regionPhase;
  }
  const capturePhase = await executeScreenshotCaptureAndImagePhase(input);
  if ("status" in capturePhase) {
    return capturePhase;
  }
  const metadataPhase = await validateAndExtractScreenshotMetadata({
    ...input,
    captureRun: capturePhase.captureRun,
    imageRun: capturePhase.imageRun,
  });
  if ("status" in metadataPhase) {
    return metadataPhase;
  }
  return executeScreenshotArtifactStoragePhase({
    ...input,
    captureRun: capturePhase.captureRun,
    imageRun: capturePhase.imageRun,
    metadata: metadataPhase,
  });
}
