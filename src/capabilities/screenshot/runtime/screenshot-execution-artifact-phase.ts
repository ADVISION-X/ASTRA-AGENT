import type { ScreenshotAbilityInput, ScreenshotAbilityResult } from "../contract.js";
import { measureScreenshotPhaseMs, type ScreenshotClockStart, type ScreenshotPhaseTimings } from "./screenshot-clock.js";
import type { ScreenshotChildRegistryEntry, ScreenshotExecutionPlan } from "./screenshot-child-contract.js";
import type { ScreenshotExecutionScope } from "./screenshot-execution-failure.js";
import { screenshotExecutionPhaseSupport } from "./screenshot-execution-phase-support.js";
import { screenshotExecutionRuntimeSupport } from "./screenshot-execution-runtime-support.js";
import type { ScreenshotExecutionGates } from "./screenshot-execution-phases.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

type ScreenshotArtifactGate = Awaited<ReturnType<typeof screenshotExecutionRuntimeSupport.runArtifactStorageGate>>;

function hasArtifactStorageGateRefs(artifactGate: ScreenshotArtifactGate) {
  return !artifactGate.artifactRef
    || !artifactGate.artifactLifecycleManifestRef
    || !artifactGate.outputHash
    || !artifactGate.artifactHash
    || !artifactGate.retentionClass
    || !artifactGate.promotionStatus;
}

function hasArtifactStorageGateMetrics(artifactGate: ScreenshotArtifactGate) {
  return artifactGate.byteSize === null || artifactGate.cleanupEligible === null;
}

function hasArtifactStorageGateFailure(artifactGate: ScreenshotArtifactGate) {
  return artifactGate.failure
    || artifactGate.decision.status !== "passed"
    || hasArtifactStorageGateRefs(artifactGate)
    || hasArtifactStorageGateMetrics(artifactGate);
}

async function buildArtifactStorageFailureResult(input: {
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
  artifactGate: ScreenshotArtifactGate;
}) {
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
    artifactGate: input.artifactGate,
  });
}

function buildArtifactStorageSuccessResult(input: {
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
  artifactGate: ScreenshotArtifactGate;
}) {
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
    artifactGate: input.artifactGate,
    phaseTimings: input.phaseTimings,
  });
}

async function runArtifactStorageAndCleanup(input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  metadata: { outputFilePath: string; outputWidth: number; outputHeight: number; mimeType: string; createdAt: string };
  registryEntry: ScreenshotChildRegistryEntry;
}) {
  return measureScreenshotPhaseMs({
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
}

export async function executeScreenshotArtifactStoragePhase(input: {
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
}): Promise<ScreenshotAbilityResult> {
  const artifactStorageMeasurement = await runArtifactStorageAndCleanup(input);
  const { artifactGate, ephemeralCleanup } = artifactStorageMeasurement.result;
  const phaseTimings = {
    ...input.phaseTimings,
    artifactStoragePhaseMs: artifactStorageMeasurement.durationMs,
  };

  if (ephemeralCleanup.attempted && !ephemeralCleanup.deleted) {
    return buildArtifactStorageFailureResult({
      ...input,
      phaseTimings,
      artifactGate: {
        ...artifactGate,
        decision: { status: "failed", reason: "ephemeral_cleanup_failed" },
        failure: screenshotExecutionRuntimeSupport.createScreenshotFailure({
          code: "artifact_lifecycle_invalid",
          message: "Screenshot ephemeral work file cleanup failed after artifact handoff.",
          detail: ephemeralCleanup.reason,
        }),
      },
    });
  }

  if (hasArtifactStorageGateFailure(artifactGate)) {
    return buildArtifactStorageFailureResult({ ...input, phaseTimings, artifactGate });
  }

  return buildArtifactStorageSuccessResult({ ...input, phaseTimings, artifactGate });
}