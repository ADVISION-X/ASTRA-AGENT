import { createHash } from "node:crypto";

import type {
  ScreenshotAbilityInput,
  ScreenshotArtifactRef,
  ScreenshotFailure,
  ScreenshotRuntimeProof,
  ScreenshotSourceProof,
  ScreenshotStatus,
} from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import { dispatchScreenshotFailure } from "./screenshot-dispatch-failure.js";
import { finishScreenshotClock, startScreenshotClock } from "./screenshot-clock.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";
import type { ScreenshotExecutionPlan } from "./screenshot-child-contract.js";
import { buildScreenshotEvidenceId, buildScreenshotIdempotencyKey } from "./screenshot-idempotency.js";
import type { ScreenshotChildRegistryEntry } from "./screenshot-child-contract.js";

export type ScreenshotExecutionScope = {
  missionId: string;
  runId: string;
  inputRef: string;
  outputRef: string;
  idempotencyKey: string;
  evidenceId: string;
  fallbackSourceArtifactRef: ScreenshotArtifactRef | null;
  proofId: string;
};

export function buildScreenshotExecutionScope(input: {
  request: ScreenshotAbilityInput;
  registryEntry: ScreenshotChildRegistryEntry;
}): ScreenshotExecutionScope {
  const missionId = input.request.missionId ?? input.request.sessionId;
  const runId = input.request.runId ?? `${input.request.sessionId}:${input.request.childCapabilityId}`;
  const inputRef = buildRef("screenshot-input", JSON.stringify(input.request));
  const outputRef = buildRef("screenshot-output", `${input.request.childCapabilityId}:${input.request.sessionId}:${input.request.purpose}`);
  const idempotencyKey = buildScreenshotIdempotencyKey({ request: input.request, registryEntry: input.registryEntry });
  const evidenceId = buildScreenshotEvidenceId({ childCapabilityId: input.request.childCapabilityId, idempotencyKey });
  const fallbackSourceArtifactRef = input.request.source.kind === "stored_image" ? input.request.source.sourceArtifactRef : null;
  return {
    missionId,
    runId,
    inputRef,
    outputRef,
    idempotencyKey,
    evidenceId,
    fallbackSourceArtifactRef,
    proofId: buildRef("screenshot-proof", inputRef),
  };
}

export async function dispatchScreenshotExecutionFailure(input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  status: Exclude<ScreenshotStatus, "success">;
  message: string;
  failureReason: ScreenshotFailure | null;
  reviewRequiredReason: string | null;
  startedAt: ReturnType<typeof startScreenshotClock>["startedAt"];
  startedMonotonicMs: number;
  sourceProof: ScreenshotSourceProof | null;
  decisions: {
    privacyDecision: ScreenshotRuntimeProof["privacyDecision"];
    sourceDecision: ScreenshotRuntimeProof["sourceDecision"];
    browserSessionDecision: ScreenshotRuntimeProof["browserSessionDecision"];
    pageStateDecision: ScreenshotRuntimeProof["pageStateDecision"];
    captureDecision: ScreenshotRuntimeProof["captureDecision"];
    imageProcessingDecision: ScreenshotRuntimeProof["imageProcessingDecision"];
    artifactDecision: ScreenshotRuntimeProof["artifactDecision"];
    outputBoundaryDecision: ScreenshotRuntimeProof["outputBoundaryDecision"];
  };
  browserSessionRef: string | null;
  pageStateProofRef: string | null;
  dataQualityFlags: ScreenshotRuntimeProof["dataQualityFlags"];
}) {
  const finished = finishScreenshotClock({
    clockPort: input.context.clockPort,
    startedAt: input.startedAt,
    startedMonotonicMs: input.startedMonotonicMs,
  });
  return dispatchScreenshotFailure({
    request: input.request,
    status: input.status,
    message: input.message,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    proofId: input.scope.proofId,
    runId: input.scope.runId,
    missionId: input.scope.missionId,
    inputRef: input.scope.inputRef,
    outputRef: input.scope.outputRef,
    idempotencyKey: input.scope.idempotencyKey,
    startedAt: input.startedAt,
    endedAt: finished.endedAt,
    durationMs: finished.durationMs,
    startedMonotonicMs: input.startedMonotonicMs,
    endedMonotonicMs: finished.endedMonotonicMs,
    sourceProof: input.sourceProof,
    sourceArtifactRef: input.scope.fallbackSourceArtifactRef,
    decisions: input.decisions,
    browserSessionRef: input.browserSessionRef,
    pageStateProofRef: input.pageStateProofRef,
    dataQualityFlags: input.dataQualityFlags,
  });
}

function buildRef(prefix: string, input: string): string {
  return `${prefix}:${createHash("sha256").update(input).digest("hex").slice(0, 24)}`;
}
