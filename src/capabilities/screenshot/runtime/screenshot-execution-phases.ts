import type { ScreenshotAbilityInput } from "../contract.js";
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
import type { ScreenshotExecutionPlan } from "./screenshot-child-contract.js";
import type { ScreenshotExecutionScope } from "./screenshot-execution-failure.js";
import type { ScreenshotClockStart } from "./screenshot-clock.js";
import type { ScreenshotAbilityResult, ScreenshotRuntimeProof } from "../contract.js";

export type ScreenshotExecutionGateState = {
  failure: { message: string } | null;
  decision: ScreenshotRuntimeProof["privacyDecision"];
};

export type ScreenshotExecutionSourceGateState = ScreenshotExecutionGateState & {
  sourceProof: ScreenshotRuntimeProof["sourceProof"];
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
}): Promise<{ regionGate: { failure: { message: string } | null; decision: ScreenshotRuntimeProof["privacyDecision"] } } | ScreenshotRuntimeProof["decisions"]> {
  const regionGate = runRegionProofGate({
    sourceProof: input.gates.sourceGate.sourceProof,
    region: input.plan.kind === "image-processing" && "region" in input.plan ? input.plan.region : null,
  });
  if (regionGate.failure || regionGate.decision.status === "failed") {
    return buildScreenshotRegionValidationFailure({
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
  registryEntry: { maxDurationMs: number };
}): Promise<{ captureRun: Awaited<ReturnType<typeof runCaptureRunner>> | null; imageRun: Awaited<ReturnType<typeof runImageProcessingRunner>> | null; } | ScreenshotAbilityResult> {
  const captureRun = await resolveScreenshotCaptureRun({
    plan: input.plan,
    context: input.context,
    scope: input.scope,
    clockStart: input.clockStart,
    registryEntry: input.registryEntry,
  });
  const imageRun = await resolveScreenshotImageRun({
    plan: input.plan,
    context: input.context,
    registryEntry: input.registryEntry,
  });
  const failure = resolveScreenshotCaptureAndImagePhaseFailure({
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
}) {
  const metadataResolution = resolveScreenshotOutputMetadata({
    plan: input.plan,
    captureRun: input.captureRun,
    imageRun: input.imageRun,
    request: input.request,
    context: input.context,
    scope: input.scope,
    clockStart: input.clockStart,
    gates: input.gates,
  });

  if (!metadataResolution.ok) {
    return metadataResolution.failure;
  }

  return metadataResolution.metadata;
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
  registryEntry: { maxDurationMs: number; outputImageKind: string; coordinateSpacePolicy: string };
}) {
  const artifactGate = await runArtifactStorageGate({
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
  if (artifactGate.failure || artifactGate.decision.status !== "passed" || !artifactGate.artifactRef || !artifactGate.outputHash) {
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

export async function executeScreenshotExecutionPhases(input: {
  plan: ScreenshotExecutionPlan;
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  registryEntry: { maxDurationMs: number; outputImageKind: string; coordinateSpacePolicy: string };
  clockStart: ScreenshotClockStart;
  scope: ScreenshotExecutionScope;
  gates: ScreenshotExecutionGates;
}): Promise<Awaited<ReturnType<typeof executeScreenshotExecutionSuccess>> | ScreenshotRuntimeProof> {
  const regionPhase = await executeScreenshotRegionGatePhase(input);
  if ("status" in regionPhase) {
    return regionPhase;
  }
  const capturePhase = await executeScreenshotCaptureAndImagePhase(input);
  if ("status" in capturePhase) {
    return capturePhase;
  }
  const metadataPhase = validateAndExtractScreenshotMetadata({
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
