import { createHash } from "node:crypto";

import type {
  ScreenshotAbilityInput,
  ScreenshotAbilityResult,
  ScreenshotRuntimeProof,
  ScreenshotSourceProof,
} from "../contract.js";
import { buildDerivedScaleMapping, buildIdentityScaleMapping } from "../shared/screenshot-scale-mapping.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import { runScreenshotOutputBoundaryGate } from "./screenshot-output-boundary-gate.js";
import { buildScreenshotRuntimeProof } from "./screenshot-proof-builder.js";
import { buildScreenshotResult, buildScreenshotSuccessOutput } from "./screenshot-result-builder.js";
import { dispatchScreenshotExecutionFailure, type ScreenshotExecutionScope } from "./screenshot-execution-failure.js";
import { finishScreenshotClock } from "./screenshot-clock.js";
import type { ScreenshotClockStart } from "./screenshot-clock.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";
import type { ScreenshotExecutionPlan, ScreenshotChildRegistryEntry } from "./screenshot-child-contract.js";

function buildRef(prefix: string, input: string): string {
  return `${prefix}:${createHash("sha256").update(input).digest("hex").slice(0, 24)}`;
}

type ScreenshotDecision = ScreenshotRuntimeProof["privacyDecision"];

type ScreenshotGateFailure = {
  message: string;
};

type ScreenshotExecutionGates = {
  sourceGate: {
    failure: ScreenshotGateFailure | null;
    decision: ScreenshotDecision;
    sourceProof: ScreenshotSourceProof | null;
  };
  browserSessionGate: {
    decision: ScreenshotDecision;
    browserSessionRef: string | null;
  };
  pageStateGate: {
    decision: ScreenshotDecision;
    pageStateProofRef: string | null;
  };
  privacyGate: {
    decision: ScreenshotDecision;
  };
};

type ScreenshotRegionGate = {
  failure: ScreenshotGateFailure | null;
  decision: ScreenshotDecision;
};

type ScreenshotCaptureRun = {
  failure: ScreenshotGateFailure | null;
  decision: ScreenshotDecision;
  captureResult?: {
    kind: string;
    capture: {
      sourceFilePath?: string | null;
      width?: number | null;
      height?: number | null;
      createdAt?: string | null;
      pageUrl?: string | null;
      pageTitle?: string | null;
      screenId?: string | null;
    };
  } | null;
};

type ScreenshotImageRun = {
  failure: ScreenshotGateFailure | null;
  decision: ScreenshotDecision;
  output?: {
    outputFilePath?: string | null;
    width?: number | null;
    height?: number | null;
    mimeType?: string | null;
    sourceWidth?: number | null;
    sourceHeight?: number | null;
    cropOffsetX?: number | null;
    cropOffsetY?: number | null;
  };
};

type ScreenshotArtifactGate = {
  failure: ScreenshotGateFailure | null;
  decision: ScreenshotDecision;
  artifactRef: { storageRef: string } | null;
  outputHash: string | null;
};

async function executeScreenshotSuccessPath(input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  registryEntry: ScreenshotChildRegistryEntry;
  clockStart: ScreenshotClockStart;
  scope: ScreenshotExecutionScope;
  gates: ScreenshotExecutionGates;
  plan: ScreenshotExecutionPlan;
  regionGate: ScreenshotRegionGate;
  captureRun: ScreenshotCaptureRun | null;
  imageRun: ScreenshotImageRun | null;
  artifactGate: ScreenshotArtifactGate;
}): Promise<ScreenshotAbilityResult> {
  const sourceHash = input.plan.kind === "capture"
    ? input.artifactGate.outputHash
    : input.gates.sourceGate.sourceProof?.sourceHash ?? await input.context.imageProcessingPort.hashFile(input.plan.sourceFilePath);
  const scaleMapping = input.plan.kind === "capture"
    ? buildIdentityScaleMapping({
        sourceScreenshotEvidenceId: null,
        sourceStorageRef: input.artifactGate.artifactRef?.storageRef ?? input.scope.fallbackSourceArtifactRef ?? "",
        sourceCoordinateSpace: input.registryEntry.coordinateSpacePolicy === "desktop_screen_pixels" ? "desktop_screen_pixels" : "browser_viewport_pixels",
        sourceWidth: input.captureRun?.captureResult?.capture.width ?? input.imageRun?.output?.sourceWidth ?? 0,
        sourceHeight: input.captureRun?.captureResult?.capture.height ?? input.imageRun?.output?.sourceHeight ?? 0,
      })
    : input.plan.operation === "prepare-ai-input"
      ? buildDerivedScaleMapping({
          sourceScreenshotEvidenceId: input.plan.sourceProof.sourceScreenshotEvidenceId,
          sourceStorageRef: input.plan.sourceProof.sourceStorageRef,
          sourceCoordinateSpace: input.plan.sourceProof.coordinateSpace ?? "source_image_pixels",
          targetCoordinateSpace: "ai_input_pixels",
          sourceWidth: input.imageRun?.output?.sourceWidth ?? input.captureRun?.captureResult?.capture.width ?? 0,
          sourceHeight: input.imageRun?.output?.sourceHeight ?? input.captureRun?.captureResult?.capture.height ?? 0,
          targetWidth: input.imageRun?.output?.width ?? input.captureRun?.captureResult?.capture.width ?? 0,
          targetHeight: input.imageRun?.output?.height ?? input.captureRun?.captureResult?.capture.height ?? 0,
          cropOffsetX: input.imageRun?.output?.cropOffsetX ?? 0,
          cropOffsetY: input.imageRun?.output?.cropOffsetY ?? 0,
        })
      : buildIdentityScaleMapping({
          sourceScreenshotEvidenceId: input.plan.sourceProof.sourceScreenshotEvidenceId,
          sourceStorageRef: input.plan.sourceProof.sourceStorageRef,
          sourceCoordinateSpace: input.plan.sourceProof.coordinateSpace ?? "source_image_pixels",
          sourceWidth: input.imageRun?.output?.sourceWidth ?? input.captureRun?.captureResult?.capture.width ?? 0,
          sourceHeight: input.imageRun?.output?.sourceHeight ?? input.captureRun?.captureResult?.capture.height ?? 0,
        });

  const coordinateSpace = input.plan.kind === "capture"
    ? (input.registryEntry.coordinateSpacePolicy as "browser_viewport_pixels" | "desktop_screen_pixels")
    : input.plan.operation === "prepare-ai-input"
      ? "ai_input_pixels"
      : "source_image_pixels";

  const outputWidth = input.captureRun?.captureResult?.capture.width ?? input.imageRun?.output?.width ?? null;
  const outputHeight = input.captureRun?.captureResult?.capture.height ?? input.imageRun?.output?.height ?? null;
  const successOutput = buildScreenshotSuccessOutput({
    request: input.request,
    artifactRef: input.artifactGate.artifactRef!,
    evidenceId: input.scope.evidenceId,
    pageUrl: input.captureRun?.captureResult?.kind === "browser" ? input.captureRun.captureResult.capture.pageUrl : null,
    pageTitle: input.captureRun?.captureResult?.kind === "browser" ? input.captureRun.captureResult.capture.pageTitle : null,
    width: outputWidth,
    height: outputHeight,
    originalWidth: input.plan.kind === "capture"
      ? outputWidth
      : input.imageRun?.output?.sourceWidth ?? input.gates.sourceGate.sourceProof?.sourceWidth ?? outputWidth,
    originalHeight: input.plan.kind === "capture"
      ? outputHeight
      : input.imageRun?.output?.sourceHeight ?? input.gates.sourceGate.sourceProof?.sourceHeight ?? outputHeight,
    imageKind: input.registryEntry.outputImageKind,
    coordinateSpace,
    scaleMapping,
    sourceScreenshotEvidenceId: input.plan.kind === "capture" ? null : input.plan.sourceProof.sourceScreenshotEvidenceId,
    screenId: input.captureRun?.captureResult?.kind === "desktop" ? input.captureRun.captureResult.capture.screenId : (input.request.source.kind === "desktop_screen" ? input.request.source.screenId : null),
    sourceHash,
    outputHash: input.artifactGate.outputHash,
    regionLabel: input.plan.kind === "capture"
      ? (input.plan.operation === "browser-viewport" ? input.plan.regionLabel : input.request.purpose)
      : input.request.purpose,
    regionType: input.plan.kind === "capture"
      ? (input.plan.operation === "browser-viewport" ? "viewport" : "desktop-screen")
      : input.request.childCapabilityId,
  });

  const outputBoundaryGate = await runScreenshotOutputBoundaryGate({
    context: input.context,
    registryEntry: input.registryEntry,
    output: successOutput,
  });
  if (outputBoundaryGate.failure || outputBoundaryGate.decision.status !== "passed") {
    return dispatchScreenshotExecutionFailure({
      request: input.request,
      context: input.context,
      scope: input.scope,
      status: "failed",
      message: outputBoundaryGate.failure?.message ?? "Screenshot output boundary validation failed.",
      failureReason: outputBoundaryGate.failure ?? createScreenshotFailure({
        code: "output_schema_invalid",
        message: "Screenshot output boundary validation failed.",
      }),
      reviewRequiredReason: null,
      startedAt: input.clockStart.startedAt,
      startedMonotonicMs: input.clockStart.startedMonotonicMs,
      sourceProof: input.gates.sourceGate.sourceProof,
      browserSessionRef: input.gates.browserSessionGate.browserSessionRef,
      pageStateProofRef: input.gates.pageStateGate.pageStateProofRef,
      dataQualityFlags: [],
      decisions: {
        privacyDecision: input.gates.privacyGate.decision,
        sourceDecision: input.gates.sourceGate.decision,
        browserSessionDecision: input.gates.browserSessionGate.decision,
        pageStateDecision: input.gates.pageStateGate.decision,
        captureDecision: input.captureRun?.decision ?? { status: "not_applicable", reason: null },
        imageProcessingDecision: input.imageRun?.decision ?? { status: "not_applicable", reason: null },
        artifactDecision: input.artifactGate.decision,
        outputBoundaryDecision: outputBoundaryGate.decision,
      },
    });
  }

  const finished = finishScreenshotClock({
    clockPort: input.context.clockPort,
    startedAt: input.clockStart.startedAt,
    startedMonotonicMs: input.clockStart.startedMonotonicMs,
  });
  const dataQualityFlags: ScreenshotRuntimeProof["dataQualityFlags"] = [
    "artifact_persisted",
    input.plan.kind === "capture" ? "capture_fresh" : "scale_mapping_verified",
    input.gates.browserSessionGate.decision.status === "passed" ? "browser_session_verified" : null,
    input.gates.pageStateGate.pageStateProofRef ? "page_state_verified" : "page_state_unverified",
    input.regionGate.decision.status === "passed" ? "region_proof_verified" : null,
    input.plan.kind === "image-processing" && input.plan.operation === "optimize-lossless" ? "lossless_equivalence_verified" : null,
    input.request.childCapabilityId === "capture-desktop-screen" ? "desktop_capture_requested" : null,
  ].filter((value): value is ScreenshotRuntimeProof["dataQualityFlags"][number] => value !== null);

  const runtimeProof = buildScreenshotRuntimeProof({
    request: input.request,
    proofId: buildRef("screenshot-proof", `${input.scope.inputRef}:${input.scope.idempotencyKey}:success`),
    runId: input.scope.runId,
    missionId: input.scope.missionId,
    inputRef: input.scope.inputRef,
    outputRef: input.scope.outputRef,
    idempotencyKey: input.scope.idempotencyKey,
    startedAt: input.clockStart.startedAt,
    endedAt: finished.endedAt,
    durationMs: finished.durationMs,
    startedMonotonicMs: input.clockStart.startedMonotonicMs,
    endedMonotonicMs: finished.endedMonotonicMs,
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    sourceProof: input.gates.sourceGate.sourceProof,
    artifactRef: input.artifactGate.artifactRef,
    sourceArtifactRef: input.scope.fallbackSourceArtifactRef,
    sourceHash,
    outputHash: input.artifactGate.outputHash,
    sourceWidth: input.plan.kind === "capture" ? outputWidth : (input.imageRun?.output?.sourceWidth ?? input.gates.sourceGate.sourceProof?.sourceWidth ?? null),
    sourceHeight: input.plan.kind === "capture" ? outputHeight : (input.imageRun?.output?.sourceHeight ?? input.gates.sourceGate.sourceProof?.sourceHeight ?? null),
    outputWidth,
    outputHeight,
    coordinateSpace,
    scaleMapping,
    browserSessionRef: input.gates.browserSessionGate.browserSessionRef,
    pageStateProofRef: input.gates.pageStateGate.pageStateProofRef,
    screenshotEvidenceId: input.scope.evidenceId,
    decisions: {
      privacyDecision: input.gates.privacyGate.decision,
      sourceDecision: input.gates.sourceGate.decision,
      browserSessionDecision: input.gates.browserSessionGate.decision,
      pageStateDecision: input.gates.pageStateGate.decision,
      captureDecision: input.captureRun?.decision ?? { status: "not_applicable", reason: null },
      imageProcessingDecision: input.imageRun?.decision ?? { status: "not_applicable", reason: null },
      artifactDecision: input.artifactGate.decision,
      outputBoundaryDecision: outputBoundaryGate.decision,
    },
    dataQualityFlags,
  });

  return buildScreenshotResult({
    request: input.request,
    status: "success",
    message: "Screenshot execution succeeded.",
    output: successOutput,
    failureReason: null,
    reviewRequiredReason: null,
    runtimeProof,
  });
}

export async function executeScreenshotExecutionSuccess(input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  registryEntry: ScreenshotChildRegistryEntry;
  clockStart: ScreenshotClockStart;
  scope: ScreenshotExecutionScope;
  gates: ScreenshotExecutionGates;
  plan: ScreenshotExecutionPlan;
  regionGate: ScreenshotRegionGate;
  captureRun: ScreenshotCaptureRun | null;
  imageRun: ScreenshotImageRun | null;
  artifactGate: ScreenshotArtifactGate;
}): Promise<ScreenshotAbilityResult> {
  return executeScreenshotSuccessPath(input);
}
