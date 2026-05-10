import type { ScreenshotAbilityInput, ScreenshotAbilityResult, ScreenshotFailure, ScreenshotRuntimeProof, ScreenshotSourceProof } from "../contract.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";
import type { ScreenshotChildRegistryEntry, ScreenshotExecutionPlan } from "./screenshot-child-contract.js";
import type { ScreenshotExecutionScope } from "./screenshot-execution-failure.js";
import { EMPTY_SCREENSHOT_PHASE_TIMINGS, measureScreenshotPhaseMs, type ScreenshotClockStart, type ScreenshotPhaseTimings } from "./screenshot-clock.js";
import { screenshotExecutionRuntimeSupport } from "./screenshot-execution-runtime-support.js";
import { screenshotExecutionPhaseSupport } from "./screenshot-execution-phase-support.js";

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

async function measureOptionalScreenshotPhase<T>(input: {
  enabled: boolean;
  context: ScreenshotRuntimeContext;
  invoke: () => Promise<T>;
}): Promise<{ result: T | null; durationMs: number | null }> {
  if (!input.enabled) {
    return { result: null, durationMs: null };
  }

  const measurement = await measureScreenshotPhaseMs({
    clockPort: input.context.clockPort,
    invoke: input.invoke,
  });

  return {
    result: measurement.result,
    durationMs: measurement.durationMs,
  };
}

async function executeScreenshotRegionGatePhase(input: {
  plan: ScreenshotExecutionPlan;
  gates: ScreenshotExecutionGates;
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
}): Promise<{ regionGate: { failure: ScreenshotFailure | null; decision: ScreenshotDecision } } | ScreenshotAbilityResult> {
  const regionGate = screenshotExecutionRuntimeSupport.runRegionProofGate({
    sourceProof: input.gates.sourceGate.sourceProof,
    region: input.plan.kind === "image-processing" && "region" in input.plan ? input.plan.region : null,
  });
  if (regionGate.failure || regionGate.decision.status === "failed") {
    return await screenshotExecutionPhaseSupport.buildScreenshotRegionValidationFailure({
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
}): Promise<{ captureRun: Awaited<ReturnType<typeof screenshotExecutionRuntimeSupport.runCaptureRunner>> | null; imageRun: Awaited<ReturnType<typeof screenshotExecutionRuntimeSupport.runImageProcessingRunner>> | null; phaseTimings: ScreenshotPhaseTimings; } | ScreenshotAbilityResult> {
  const captureMeasurement = await measureOptionalScreenshotPhase({
    enabled: input.plan.kind === "capture",
    context: input.context,
    invoke: () => screenshotExecutionPhaseSupport.resolveScreenshotCaptureRun({
      plan: input.plan,
      context: input.context,
      scope: input.scope,
      request: input.request,
      clockStart: input.clockStart,
      registryEntry: input.registryEntry,
    }),
  });
  const imageMeasurement = await measureOptionalScreenshotPhase({
    enabled: input.plan.kind === "image-processing",
    context: input.context,
    invoke: () => screenshotExecutionPhaseSupport.resolveScreenshotImageRun({
      plan: input.plan,
      context: input.context,
      request: input.request,
      registryEntry: input.registryEntry,
    }),
  });
  const captureRun = captureMeasurement.result;
  const imageRun = imageMeasurement.result;
  const failure = await screenshotExecutionPhaseSupport.resolveScreenshotCaptureAndImagePhaseFailure({
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

  return {
    captureRun,
    imageRun,
    phaseTimings: {
      ...EMPTY_SCREENSHOT_PHASE_TIMINGS,
      capturePhaseMs: captureMeasurement.durationMs,
      imageProcessingPhaseMs: imageMeasurement.durationMs,
    },
  };
}

function validateAndExtractScreenshotMetadata(input: {
  plan: ScreenshotExecutionPlan;
  captureRun: Awaited<ReturnType<typeof screenshotExecutionRuntimeSupport.runCaptureRunner>> | null;
  imageRun: Awaited<ReturnType<typeof screenshotExecutionRuntimeSupport.runImageProcessingRunner>> | null;
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
  gates: ScreenshotExecutionGates;
}): Promise<ScreenshotAbilityResult | { outputFilePath: string; outputWidth: number; outputHeight: number; mimeType: string; createdAt: string }> {
  return screenshotExecutionPhaseSupport.resolveScreenshotOutputMetadata({
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

function hasArtifactStorageGateRefs(artifactGate: Awaited<ReturnType<typeof screenshotExecutionRuntimeSupport.runArtifactStorageGate>>) {
  return !artifactGate.artifactRef
    || !artifactGate.artifactLifecycleManifestRef
    || !artifactGate.outputHash
    || !artifactGate.artifactHash
    || !artifactGate.retentionClass
    || !artifactGate.promotionStatus;
}

function hasArtifactStorageGateMetrics(artifactGate: Awaited<ReturnType<typeof screenshotExecutionRuntimeSupport.runArtifactStorageGate>>) {
  return artifactGate.byteSize === null || artifactGate.cleanupEligible === null;
}

function hasArtifactStorageGateFailure(artifactGate: Awaited<ReturnType<typeof screenshotExecutionRuntimeSupport.runArtifactStorageGate>>) {
  return artifactGate.failure
    || artifactGate.decision.status !== "passed"
    || hasArtifactStorageGateRefs(artifactGate)
    || hasArtifactStorageGateMetrics(artifactGate);
}

async function buildArtifactStorageFailureResult(
  input: Parameters<typeof executeScreenshotArtifactStoragePhase>[0],
  artifactGate: Awaited<ReturnType<typeof screenshotExecutionRuntimeSupport.runArtifactStorageGate>>,
) {
  return screenshotExecutionPhaseSupport.buildScreenshotArtifactStorageFailure({
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
  artifactGate: Awaited<ReturnType<typeof screenshotExecutionRuntimeSupport.runArtifactStorageGate>>,
) {
  return screenshotExecutionRuntimeSupport.executeScreenshotExecutionSuccess({
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
    phaseTimings: input.phaseTimings,
  });
}

async function executeScreenshotArtifactStoragePhase(input: {
  plan: ScreenshotExecutionPlan;
  captureRun: Awaited<ReturnType<typeof screenshotExecutionRuntimeSupport.runCaptureRunner>> | null;
  imageRun: Awaited<ReturnType<typeof screenshotExecutionRuntimeSupport.runImageProcessingRunner>> | null;
  phaseTimings: ScreenshotPhaseTimings;
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotClockStart;
  gates: ScreenshotExecutionGates;
  metadata: { outputFilePath: string; outputWidth: number; outputHeight: number; mimeType: string; createdAt: string };
  registryEntry: ScreenshotChildRegistryEntry;
}) {
  const artifactStorageMeasurement = await measureScreenshotPhaseMs({
    clockPort: input.context.clockPort,
    invoke: async () => {
      const artifactGate = await screenshotExecutionRuntimeSupport.runArtifactStorageGate({
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
      const ephemeralCleanup = await screenshotExecutionRuntimeSupport.burnEphemeralScreenshotFile({
        outputFilePath: input.metadata.outputFilePath,
        retainedArtifactStorageRef: artifactGate.artifactRef?.storageRef ?? null,
      });
      return { artifactGate, ephemeralCleanup };
    },
  });
  const { artifactGate, ephemeralCleanup } = artifactStorageMeasurement.result;
  const phaseTimings = {
    ...input.phaseTimings,
    artifactStoragePhaseMs: artifactStorageMeasurement.durationMs,
  };
  if (ephemeralCleanup.attempted && !ephemeralCleanup.deleted) {
    return await buildArtifactStorageFailureResult(input, {
      ...artifactGate,
      decision: { status: "failed", reason: "ephemeral_cleanup_failed" },
      failure: screenshotExecutionRuntimeSupport.createScreenshotFailure({
        code: "artifact_lifecycle_invalid",
        message: "Screenshot ephemeral work file cleanup failed after artifact handoff.",
        detail: ephemeralCleanup.reason,
      }),
    });
  }
  if (hasArtifactStorageGateFailure(artifactGate)) {
    return await buildArtifactStorageFailureResult(input, artifactGate);
  }

  return buildArtifactStorageSuccessResult({
    ...input,
    phaseTimings,
  }, artifactGate);
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
    phaseTimings: capturePhase.phaseTimings,
    metadata: metadataPhase,
  });
}
