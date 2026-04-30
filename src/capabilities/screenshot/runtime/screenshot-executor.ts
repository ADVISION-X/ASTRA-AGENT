import { createHash } from "node:crypto";

import type {
  ScreenshotAbilityInput,
  ScreenshotAbilityResult,
  ScreenshotRuntimeProof,
} from "../contract.js";
import { getScreenshotChildRegistryEntry } from "../registry.js";
import { buildDerivedScaleMapping, buildIdentityScaleMapping } from "../shared/screenshot-scale-mapping.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import { runScreenshotInputGate } from "./screenshot-input-gate.js";
import { runScreenshotPayloadBudgetGate } from "./screenshot-payload-budget-gate.js";
import { runScreenshotSourceGate } from "./screenshot-source-gate.js";
import { runBrowserSessionGate } from "./browser-session-gate.js";
import { runPageStateHandoffGate } from "./page-state-handoff-gate.js";
import { runPrivacyPolicyGate } from "./privacy-policy-gate.js";
import { runRegionProofGate } from "./region-proof-gate.js";
import { buildScreenshotEvidenceId, buildScreenshotIdempotencyKey } from "./screenshot-idempotency.js";
import { startScreenshotClock, finishScreenshotClock } from "./screenshot-clock.js";
import { runCaptureRunner } from "./capture-runner.js";
import { runImageProcessingRunner } from "./image-processing-runner.js";
import { runArtifactStorageGate } from "./artifact-storage-gate.js";
import { runScreenshotOutputBoundaryGate } from "./screenshot-output-boundary-gate.js";
import { buildScreenshotRuntimeProof } from "./screenshot-proof-builder.js";
import { buildScreenshotResult, buildScreenshotSuccessOutput } from "./screenshot-result-builder.js";
import { dispatchScreenshotFailure } from "./screenshot-dispatch-failure.js";
import { captureBrowserViewportChildCapability } from "../children/capture-browser-viewport/implementation.js";
import { captureDesktopScreenChildCapability } from "../children/capture-desktop-screen/implementation.js";
import { captureRegionChildCapability } from "../children/capture-region/implementation.js";
import { optimizeLosslessChildCapability } from "../children/optimize-lossless/implementation.js";
import { prepareAiInputChildCapability } from "../children/prepare-ai-input/implementation.js";
import type { ScreenshotExecutionPlan } from "./screenshot-child-contract.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

function buildRef(prefix: string, input: string): string {
  return `${prefix}:${createHash("sha256").update(input).digest("hex").slice(0, 24)}`;
}

async function executeScreenshotChildPlan(input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  resolvedMaxAiWidth: number | null;
}): Promise<ScreenshotExecutionPlan | null> {
  switch (input.request.childCapabilityId) {
    case "capture-browser-viewport":
      return captureBrowserViewportChildCapability.execute({
        request: input.request,
        context: input.context,
      });
    case "capture-desktop-screen":
      return captureDesktopScreenChildCapability.execute({
        request: input.request,
        context: input.context,
      });
    case "capture-region":
      return captureRegionChildCapability.execute({
        request: input.request,
        context: input.context,
      });
    case "optimize-lossless":
      return optimizeLosslessChildCapability.execute({
        request: input.request,
        context: input.context,
      });
    case "prepare-ai-input":
      return prepareAiInputChildCapability.execute({
        request: {
          ...input.request,
          maxAiWidth: input.resolvedMaxAiWidth,
        },
        context: input.context,
      });
    default:
      return null;
  }
}

export async function executeScreenshotRequest(input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
}): Promise<ScreenshotAbilityResult> {
  const registryEntry = getScreenshotChildRegistryEntry(input.request.childCapabilityId);
  const clockStart = startScreenshotClock(input.context.clockPort);
  const missionId = input.request.missionId ?? input.request.sessionId;
  const runId = input.request.runId ?? `${input.request.sessionId}:${input.request.childCapabilityId}`;
  const inputRef = buildRef("screenshot-input", JSON.stringify(input.request));
  const outputRef = buildRef("screenshot-output", `${input.request.childCapabilityId}:${input.request.sessionId}:${input.request.purpose}`);
  const fallbackSourceArtifactRef = input.request.source.kind === "stored_image" ? input.request.source.sourceArtifactRef : null;

  if (!registryEntry) {
    const finished = finishScreenshotClock({
      clockPort: input.context.clockPort,
      startedAt: clockStart.startedAt,
      startedMonotonicMs: clockStart.startedMonotonicMs,
    });
    return dispatchScreenshotFailure({
      request: input.request,
      status: "failed",
      message: "Screenshot child capability is not registered.",
      failureReason: createScreenshotFailure({
        code: "unknown_child",
        message: `Unknown screenshot child capability ${input.request.childCapabilityId}.`,
      }),
      reviewRequiredReason: null,
      proofId: buildRef("screenshot-proof", inputRef),
      runId,
      missionId,
      inputRef,
      outputRef,
      idempotencyKey: `${input.request.childCapabilityId}:unknown`,
      startedAt: clockStart.startedAt,
      endedAt: finished.endedAt,
      durationMs: finished.durationMs,
      startedMonotonicMs: clockStart.startedMonotonicMs,
      endedMonotonicMs: finished.endedMonotonicMs,
      sourceProof: null,
      sourceArtifactRef: fallbackSourceArtifactRef,
      decisions: {
        privacyDecision: { status: "not_applicable", reason: null },
        sourceDecision: { status: "failed", reason: "unknown_child" },
        browserSessionDecision: { status: "not_applicable", reason: null },
        pageStateDecision: { status: "not_applicable", reason: null },
        captureDecision: { status: "not_applicable", reason: null },
        imageProcessingDecision: { status: "not_applicable", reason: null },
        artifactDecision: { status: "not_applicable", reason: null },
        outputBoundaryDecision: { status: "not_applicable", reason: null },
      },
      browserSessionRef: null,
      pageStateProofRef: null,
      dataQualityFlags: [],
    });
  }

  const inputGate = runScreenshotInputGate({
    request: input.request,
    registryEntry,
    defaultAiMaxWidth: input.context.defaultAiMaxWidth,
  });
  const payloadBudgetGate = runScreenshotPayloadBudgetGate({
    request: input.request,
  });
  const sourceGate = await runScreenshotSourceGate({
    request: input.request,
    registryEntry,
    context: input.context,
  });
  const browserSessionGate = await runBrowserSessionGate({
    request: input.request,
    registryEntry,
    context: input.context,
  });
  const pageStateGate = runPageStateHandoffGate({
    request: input.request,
    registryEntry,
  });
  const privacyGate = runPrivacyPolicyGate({
    request: input.request,
    registryEntry,
  });

  const idempotencyKey = buildScreenshotIdempotencyKey({
    request: input.request,
    registryEntry,
  });
  const evidenceId = buildScreenshotEvidenceId({
    childCapabilityId: input.request.childCapabilityId,
    idempotencyKey,
  });

  const failEarly = inputGate.failure ?? payloadBudgetGate.failure ?? sourceGate.failure ?? browserSessionGate.failure ?? pageStateGate.failure ?? privacyGate.failure;
  const earlyStatus = browserSessionGate.decision.status === "review_required" || pageStateGate.decision.status === "review_required" || privacyGate.decision.status === "review_required"
      ? "review_required"
      : "failed";

  if (failEarly || inputGate.decision.status === "failed" || payloadBudgetGate.decision.status === "failed" || sourceGate.decision.status === "failed" || browserSessionGate.decision.status === "failed" || pageStateGate.decision.status === "failed" || privacyGate.decision.status === "blocked" || privacyGate.decision.status === "review_required") {
    const finished = finishScreenshotClock({
      clockPort: input.context.clockPort,
      startedAt: clockStart.startedAt,
      startedMonotonicMs: clockStart.startedMonotonicMs,
    });
    return dispatchScreenshotFailure({
      request: input.request,
      status: earlyStatus,
      message: failEarly?.message ?? "Screenshot governance gate blocked execution.",
      failureReason: failEarly ?? createScreenshotFailure({
        code: "dispatch_failure",
        message: "Screenshot governance gate blocked execution.",
      }),
      reviewRequiredReason: earlyStatus === "review_required" ? (failEarly?.message ?? "review required") : null,
      proofId: buildRef("screenshot-proof", `${inputRef}:${idempotencyKey}`),
      runId,
      missionId,
      inputRef,
      outputRef,
      idempotencyKey,
      startedAt: clockStart.startedAt,
      endedAt: finished.endedAt,
      durationMs: finished.durationMs,
      startedMonotonicMs: clockStart.startedMonotonicMs,
      endedMonotonicMs: finished.endedMonotonicMs,
      sourceProof: sourceGate.sourceProof,
      sourceArtifactRef: fallbackSourceArtifactRef,
      decisions: {
        privacyDecision: privacyGate.decision,
        sourceDecision: sourceGate.decision,
        browserSessionDecision: browserSessionGate.decision,
        pageStateDecision: pageStateGate.decision,
        captureDecision: { status: "not_applicable", reason: null },
        imageProcessingDecision: { status: "not_applicable", reason: null },
        artifactDecision: { status: "not_applicable", reason: null },
        outputBoundaryDecision: { status: "not_applicable", reason: null },
      },
      browserSessionRef: browserSessionGate.browserSessionRef,
      pageStateProofRef: pageStateGate.pageStateProofRef,
      dataQualityFlags: [],
    });
  }

  const plan = await executeScreenshotChildPlan({
    request: input.request,
    context: input.context,
    resolvedMaxAiWidth: inputGate.resolvedMaxAiWidth,
  });
  if (!plan) {
    const finished = finishScreenshotClock({
      clockPort: input.context.clockPort,
      startedAt: clockStart.startedAt,
      startedMonotonicMs: clockStart.startedMonotonicMs,
    });
    return dispatchScreenshotFailure({
      request: input.request,
      status: "failed",
      message: "Screenshot child implementation is missing.",
      failureReason: createScreenshotFailure({
        code: "dispatch_failure",
        message: `Missing screenshot child implementation for ${input.request.childCapabilityId}.`,
      }),
      reviewRequiredReason: null,
      proofId: buildRef("screenshot-proof", `${inputRef}:missing-child`),
      runId,
      missionId,
      inputRef,
      outputRef,
      idempotencyKey,
      startedAt: clockStart.startedAt,
      endedAt: finished.endedAt,
      durationMs: finished.durationMs,
      startedMonotonicMs: clockStart.startedMonotonicMs,
      endedMonotonicMs: finished.endedMonotonicMs,
      sourceProof: sourceGate.sourceProof,
      sourceArtifactRef: fallbackSourceArtifactRef,
      decisions: {
        privacyDecision: privacyGate.decision,
        sourceDecision: sourceGate.decision,
        browserSessionDecision: browserSessionGate.decision,
        pageStateDecision: pageStateGate.decision,
        captureDecision: { status: "failed", reason: "missing_child_implementation" },
        imageProcessingDecision: { status: "not_applicable", reason: null },
        artifactDecision: { status: "not_applicable", reason: null },
        outputBoundaryDecision: { status: "not_applicable", reason: null },
      },
      browserSessionRef: browserSessionGate.browserSessionRef,
      pageStateProofRef: pageStateGate.pageStateProofRef,
      dataQualityFlags: [],
    });
  }

  const regionGate = runRegionProofGate({
    sourceProof: sourceGate.sourceProof,
    region: plan.kind === "image-processing" && "region" in plan ? plan.region : null,
  });
  if (regionGate.failure || regionGate.decision.status === "failed") {
    const finished = finishScreenshotClock({
      clockPort: input.context.clockPort,
      startedAt: clockStart.startedAt,
      startedMonotonicMs: clockStart.startedMonotonicMs,
    });
    return dispatchScreenshotFailure({
      request: input.request,
      status: "failed",
      message: regionGate.failure?.message ?? "Screenshot region proof gate failed.",
      failureReason: regionGate.failure ?? createScreenshotFailure({
        code: "region_proof_invalid",
        message: "Screenshot region proof gate failed.",
      }),
      reviewRequiredReason: null,
      proofId: buildRef("screenshot-proof", `${inputRef}:${idempotencyKey}:region`),
      runId,
      missionId,
      inputRef,
      outputRef,
      idempotencyKey,
      startedAt: clockStart.startedAt,
      endedAt: finished.endedAt,
      durationMs: finished.durationMs,
      startedMonotonicMs: clockStart.startedMonotonicMs,
      endedMonotonicMs: finished.endedMonotonicMs,
      sourceProof: sourceGate.sourceProof,
      sourceArtifactRef: fallbackSourceArtifactRef,
      decisions: {
        privacyDecision: privacyGate.decision,
        sourceDecision: sourceGate.decision,
        browserSessionDecision: browserSessionGate.decision,
        pageStateDecision: pageStateGate.decision,
        captureDecision: { status: "not_applicable", reason: null },
        imageProcessingDecision: regionGate.decision,
        artifactDecision: { status: "not_applicable", reason: null },
        outputBoundaryDecision: { status: "not_applicable", reason: null },
      },
      browserSessionRef: browserSessionGate.browserSessionRef,
      pageStateProofRef: pageStateGate.pageStateProofRef,
      dataQualityFlags: [],
    });
  }

  const captureRun = plan.kind === "capture"
    ? await runCaptureRunner({
        plan,
        context: input.context,
        timeoutMs: registryEntry.maxDurationMs,
        evidenceId,
        createdAt: input.context.clockPort.nowIso(),
      })
    : null;
  const imageRun = plan.kind === "image-processing"
    ? await runImageProcessingRunner({
        plan,
        context: input.context,
        timeoutMs: registryEntry.maxDurationMs,
      })
    : null;

  const executionFailure = captureRun?.failure ?? imageRun?.failure;
  if (executionFailure || (captureRun && captureRun.decision.status !== "passed") || (imageRun && imageRun.decision.status !== "passed") || (!captureRun && !imageRun)) {
    const finished = finishScreenshotClock({
      clockPort: input.context.clockPort,
      startedAt: clockStart.startedAt,
      startedMonotonicMs: clockStart.startedMonotonicMs,
    });
    const status = captureRun?.decision.status === "review_required" || imageRun?.decision.status === "review_required"
      ? "review_required"
      : "failed";
    return dispatchScreenshotFailure({
      request: input.request,
      status,
      message: executionFailure?.message ?? "Screenshot execution failed.",
      failureReason: executionFailure ?? createScreenshotFailure({
        code: "dispatch_failure",
        message: "Screenshot execution failed before artifact persistence.",
      }),
      reviewRequiredReason: status === "review_required" ? (executionFailure?.message ?? "review required") : null,
      proofId: buildRef("screenshot-proof", `${inputRef}:${idempotencyKey}:execution`),
      runId,
      missionId,
      inputRef,
      outputRef,
      idempotencyKey,
      startedAt: clockStart.startedAt,
      endedAt: finished.endedAt,
      durationMs: finished.durationMs,
      startedMonotonicMs: clockStart.startedMonotonicMs,
      endedMonotonicMs: finished.endedMonotonicMs,
      sourceProof: sourceGate.sourceProof,
      sourceArtifactRef: fallbackSourceArtifactRef,
      decisions: {
        privacyDecision: privacyGate.decision,
        sourceDecision: sourceGate.decision,
        browserSessionDecision: browserSessionGate.decision,
        pageStateDecision: pageStateGate.decision,
        captureDecision: captureRun?.decision ?? { status: "not_applicable", reason: null },
        imageProcessingDecision: imageRun?.decision ?? { status: "not_applicable", reason: null },
        artifactDecision: { status: "not_applicable", reason: null },
        outputBoundaryDecision: { status: "not_applicable", reason: null },
      },
      browserSessionRef: browserSessionGate.browserSessionRef,
      pageStateProofRef: pageStateGate.pageStateProofRef,
      dataQualityFlags: [],
    });
  }

  const outputFilePath = captureRun
    ? captureRun.captureResult?.capture.sourceFilePath ?? null
    : imageRun?.output?.outputFilePath ?? null;
  const outputWidth = captureRun
    ? captureRun.captureResult?.capture.width ?? null
    : imageRun?.output?.width ?? null;
  const outputHeight = captureRun
    ? captureRun.captureResult?.capture.height ?? null
    : imageRun?.output?.height ?? null;
  const mimeType = captureRun
    ? "image/png"
    : imageRun?.output?.mimeType ?? null;
  const createdAt = captureRun
    ? captureRun.captureResult?.capture.createdAt ?? clockStart.startedAt
    : clockStart.startedAt;

  if (!outputFilePath || !outputWidth || !outputHeight || !mimeType) {
    const finished = finishScreenshotClock({
      clockPort: input.context.clockPort,
      startedAt: clockStart.startedAt,
      startedMonotonicMs: clockStart.startedMonotonicMs,
    });
    return dispatchScreenshotFailure({
      request: input.request,
      status: "failed",
      message: "Screenshot execution produced incomplete output metadata.",
      failureReason: createScreenshotFailure({
        code: "dispatch_failure",
        message: "Screenshot execution produced incomplete output metadata.",
      }),
      reviewRequiredReason: null,
      proofId: buildRef("screenshot-proof", `${inputRef}:${idempotencyKey}:metadata`),
      runId,
      missionId,
      inputRef,
      outputRef,
      idempotencyKey,
      startedAt: clockStart.startedAt,
      endedAt: finished.endedAt,
      durationMs: finished.durationMs,
      startedMonotonicMs: clockStart.startedMonotonicMs,
      endedMonotonicMs: finished.endedMonotonicMs,
      sourceProof: sourceGate.sourceProof,
      sourceArtifactRef: fallbackSourceArtifactRef,
      decisions: {
        privacyDecision: privacyGate.decision,
        sourceDecision: sourceGate.decision,
        browserSessionDecision: browserSessionGate.decision,
        pageStateDecision: pageStateGate.decision,
        captureDecision: captureRun?.decision ?? { status: "not_applicable", reason: null },
        imageProcessingDecision: imageRun?.decision ?? { status: "not_applicable", reason: null },
        artifactDecision: { status: "failed", reason: "missing_output_metadata" },
        outputBoundaryDecision: { status: "not_applicable", reason: null },
      },
      browserSessionRef: browserSessionGate.browserSessionRef,
      pageStateProofRef: pageStateGate.pageStateProofRef,
      dataQualityFlags: [],
    });
  }

  const artifactGate = await runArtifactStorageGate({
    context: input.context,
    childCapabilityId: input.request.childCapabilityId,
    evidenceId,
    outputFilePath,
    imageKind: registryEntry.outputImageKind,
    width: outputWidth,
    height: outputHeight,
    mimeType,
    createdAt,
  });
  if (artifactGate.failure || artifactGate.decision.status !== "passed" || !artifactGate.artifactRef || !artifactGate.outputHash) {
    const finished = finishScreenshotClock({
      clockPort: input.context.clockPort,
      startedAt: clockStart.startedAt,
      startedMonotonicMs: clockStart.startedMonotonicMs,
    });
    return dispatchScreenshotFailure({
      request: input.request,
      status: "failed",
      message: artifactGate.failure?.message ?? "Screenshot artifact storage failed.",
      failureReason: artifactGate.failure ?? createScreenshotFailure({
        code: "artifact_write_failed",
        message: "Screenshot artifact storage failed.",
      }),
      reviewRequiredReason: null,
      proofId: buildRef("screenshot-proof", `${inputRef}:${idempotencyKey}:artifact`),
      runId,
      missionId,
      inputRef,
      outputRef,
      idempotencyKey,
      startedAt: clockStart.startedAt,
      endedAt: finished.endedAt,
      durationMs: finished.durationMs,
      startedMonotonicMs: clockStart.startedMonotonicMs,
      endedMonotonicMs: finished.endedMonotonicMs,
      sourceProof: sourceGate.sourceProof,
      sourceArtifactRef: fallbackSourceArtifactRef,
      decisions: {
        privacyDecision: privacyGate.decision,
        sourceDecision: sourceGate.decision,
        browserSessionDecision: browserSessionGate.decision,
        pageStateDecision: pageStateGate.decision,
        captureDecision: captureRun?.decision ?? { status: "not_applicable", reason: null },
        imageProcessingDecision: imageRun?.decision ?? { status: "not_applicable", reason: null },
        artifactDecision: artifactGate.decision,
        outputBoundaryDecision: { status: "not_applicable", reason: null },
      },
      browserSessionRef: browserSessionGate.browserSessionRef,
      pageStateProofRef: pageStateGate.pageStateProofRef,
      dataQualityFlags: [],
    });
  }

  const sourceHash = plan.kind === "capture"
    ? artifactGate.outputHash
    : sourceGate.sourceProof?.sourceHash ?? await input.context.imageProcessingPort.hashFile(plan.sourceFilePath);
  const scaleMapping = plan.kind === "capture"
    ? buildIdentityScaleMapping({
        sourceScreenshotEvidenceId: null,
        sourceStorageRef: artifactGate.artifactRef.storageRef,
        sourceCoordinateSpace: registryEntry.coordinateSpacePolicy === "desktop_screen_pixels" ? "desktop_screen_pixels" : "browser_viewport_pixels",
        sourceWidth: outputWidth,
        sourceHeight: outputHeight,
      })
    : plan.operation === "prepare-ai-input"
      ? buildDerivedScaleMapping({
          sourceScreenshotEvidenceId: plan.sourceProof.sourceScreenshotEvidenceId,
          sourceStorageRef: plan.sourceProof.sourceStorageRef,
          sourceCoordinateSpace: plan.sourceProof.coordinateSpace ?? "source_image_pixels",
          targetCoordinateSpace: "ai_input_pixels",
          sourceWidth: imageRun?.output?.sourceWidth ?? outputWidth,
          sourceHeight: imageRun?.output?.sourceHeight ?? outputHeight,
          targetWidth: outputWidth,
          targetHeight: outputHeight,
          cropOffsetX: imageRun?.output?.cropOffsetX ?? 0,
          cropOffsetY: imageRun?.output?.cropOffsetY ?? 0,
        })
      : buildIdentityScaleMapping({
          sourceScreenshotEvidenceId: plan.sourceProof.sourceScreenshotEvidenceId,
          sourceStorageRef: plan.sourceProof.sourceStorageRef,
          sourceCoordinateSpace: plan.sourceProof.coordinateSpace ?? "source_image_pixels",
          sourceWidth: outputWidth,
          sourceHeight: outputHeight,
        });

  const coordinateSpace = plan.kind === "capture"
    ? (registryEntry.coordinateSpacePolicy as "browser_viewport_pixels" | "desktop_screen_pixels")
    : plan.operation === "prepare-ai-input"
      ? "ai_input_pixels"
      : "source_image_pixels";

  const successOutput = buildScreenshotSuccessOutput({
    request: input.request,
    artifactRef: artifactGate.artifactRef,
    evidenceId,
    pageUrl: captureRun?.captureResult?.kind === "browser" ? captureRun.captureResult.capture.pageUrl : null,
    pageTitle: captureRun?.captureResult?.kind === "browser" ? captureRun.captureResult.capture.pageTitle : null,
    width: outputWidth,
    height: outputHeight,
    originalWidth: plan.kind === "capture"
      ? outputWidth
      : imageRun?.output?.sourceWidth ?? sourceGate.sourceProof?.sourceWidth ?? outputWidth,
    originalHeight: plan.kind === "capture"
      ? outputHeight
      : imageRun?.output?.sourceHeight ?? sourceGate.sourceProof?.sourceHeight ?? outputHeight,
    imageKind: registryEntry.outputImageKind,
    coordinateSpace,
    scaleMapping,
    sourceScreenshotEvidenceId: plan.kind === "capture" ? null : plan.sourceProof.sourceScreenshotEvidenceId,
    screenId: captureRun?.captureResult?.kind === "desktop" ? captureRun.captureResult.capture.screenId : (input.request.source.kind === "desktop_screen" ? input.request.source.screenId : null),
    sourceHash,
    outputHash: artifactGate.outputHash,
    regionLabel: plan.kind === "capture"
      ? (plan.operation === "browser-viewport" ? plan.regionLabel : input.request.purpose)
      : input.request.purpose,
    regionType: plan.kind === "capture"
      ? (plan.operation === "browser-viewport" ? "viewport" : "desktop-screen")
      : input.request.childCapabilityId,
  });

  const outputBoundaryGate = await runScreenshotOutputBoundaryGate({
    context: input.context,
    registryEntry,
    output: successOutput,
  });
  if (outputBoundaryGate.failure || outputBoundaryGate.decision.status !== "passed") {
    const finished = finishScreenshotClock({
      clockPort: input.context.clockPort,
      startedAt: clockStart.startedAt,
      startedMonotonicMs: clockStart.startedMonotonicMs,
    });
    return dispatchScreenshotFailure({
      request: input.request,
      status: "failed",
      message: outputBoundaryGate.failure?.message ?? "Screenshot output boundary validation failed.",
      failureReason: outputBoundaryGate.failure ?? createScreenshotFailure({
        code: "output_schema_invalid",
        message: "Screenshot output boundary validation failed.",
      }),
      reviewRequiredReason: null,
      proofId: buildRef("screenshot-proof", `${inputRef}:${idempotencyKey}:output-boundary`),
      runId,
      missionId,
      inputRef,
      outputRef,
      idempotencyKey,
      startedAt: clockStart.startedAt,
      endedAt: finished.endedAt,
      durationMs: finished.durationMs,
      startedMonotonicMs: clockStart.startedMonotonicMs,
      endedMonotonicMs: finished.endedMonotonicMs,
      sourceProof: sourceGate.sourceProof,
      sourceArtifactRef: fallbackSourceArtifactRef,
      decisions: {
        privacyDecision: privacyGate.decision,
        sourceDecision: sourceGate.decision,
        browserSessionDecision: browserSessionGate.decision,
        pageStateDecision: pageStateGate.decision,
        captureDecision: captureRun?.decision ?? { status: "not_applicable", reason: null },
        imageProcessingDecision: imageRun?.decision ?? { status: "not_applicable", reason: null },
        artifactDecision: artifactGate.decision,
        outputBoundaryDecision: outputBoundaryGate.decision,
      },
      browserSessionRef: browserSessionGate.browserSessionRef,
      pageStateProofRef: pageStateGate.pageStateProofRef,
      dataQualityFlags: [],
    });
  }

  const finished = finishScreenshotClock({
    clockPort: input.context.clockPort,
    startedAt: clockStart.startedAt,
    startedMonotonicMs: clockStart.startedMonotonicMs,
  });
  const dataQualityFlags: ScreenshotRuntimeProof["dataQualityFlags"] = [
    "artifact_persisted",
    plan.kind === "capture" ? "capture_fresh" : "scale_mapping_verified",
    browserSessionGate.decision.status === "passed" ? "browser_session_verified" : null,
    pageStateGate.pageStateProofRef ? "page_state_verified" : "page_state_unverified",
    regionGate.decision.status === "passed" ? "region_proof_verified" : null,
    plan.kind === "image-processing" && plan.operation === "optimize-lossless" ? "lossless_equivalence_verified" : null,
    input.request.childCapabilityId === "capture-desktop-screen" ? "desktop_capture_requested" : null,
  ].filter((value): value is ScreenshotRuntimeProof["dataQualityFlags"][number] => value !== null);

  const runtimeProof = buildScreenshotRuntimeProof({
    request: input.request,
    proofId: buildRef("screenshot-proof", `${inputRef}:${idempotencyKey}:success`),
    runId,
    missionId,
    inputRef,
    outputRef,
    idempotencyKey,
    startedAt: clockStart.startedAt,
    endedAt: finished.endedAt,
    durationMs: finished.durationMs,
    startedMonotonicMs: clockStart.startedMonotonicMs,
    endedMonotonicMs: finished.endedMonotonicMs,
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    sourceProof: sourceGate.sourceProof,
    artifactRef: artifactGate.artifactRef,
    sourceArtifactRef: fallbackSourceArtifactRef,
    sourceHash,
    outputHash: artifactGate.outputHash,
    sourceWidth: plan.kind === "capture" ? outputWidth : (imageRun?.output?.sourceWidth ?? sourceGate.sourceProof?.sourceWidth ?? null),
    sourceHeight: plan.kind === "capture" ? outputHeight : (imageRun?.output?.sourceHeight ?? sourceGate.sourceProof?.sourceHeight ?? null),
    outputWidth,
    outputHeight,
    coordinateSpace,
    scaleMapping,
    browserSessionRef: browserSessionGate.browserSessionRef,
    pageStateProofRef: pageStateGate.pageStateProofRef,
    screenshotEvidenceId: evidenceId,
    decisions: {
      privacyDecision: privacyGate.decision,
      sourceDecision: sourceGate.decision,
      browserSessionDecision: browserSessionGate.decision,
      pageStateDecision: pageStateGate.decision,
      captureDecision: captureRun?.decision ?? { status: "not_applicable", reason: null },
      imageProcessingDecision: imageRun?.decision ?? { status: "not_applicable", reason: null },
      artifactDecision: artifactGate.decision,
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
