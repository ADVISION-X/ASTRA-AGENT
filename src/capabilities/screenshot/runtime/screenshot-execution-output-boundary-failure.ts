import type { ScreenshotAbilityInput, ScreenshotAbilityResult, ScreenshotRuntimeProof } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import { dispatchScreenshotExecutionFailure, type ScreenshotExecutionScope } from "./screenshot-execution-failure.js";
import type { ScreenshotSuccessPathInput } from "./screenshot-execution-success-helpers.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

type ScreenshotOutputBoundaryGate = {
  decision: ScreenshotRuntimeProof["outputBoundaryDecision"];
  failure: ReturnType<typeof createScreenshotFailure> | null;
};

export const buildScreenshotOutputBoundaryFailureResult = (input: {
  request: ScreenshotAbilityInput;
  context: ScreenshotRuntimeContext;
  scope: ScreenshotExecutionScope;
  clockStart: ScreenshotSuccessPathInput["clockStart"];
  gates: ScreenshotSuccessPathInput["gates"];
  captureRun: ScreenshotSuccessPathInput["captureRun"];
  imageRun: ScreenshotSuccessPathInput["imageRun"];
  outputBoundaryGate: ScreenshotOutputBoundaryGate;
}): Promise<ScreenshotAbilityResult> =>
  dispatchScreenshotExecutionFailure({
    request: input.request,
    context: input.context,
    scope: input.scope,
    status: "failed",
    message: input.outputBoundaryGate.failure?.message ?? "Screenshot output boundary validation failed.",
    failureReason: input.outputBoundaryGate.failure ?? createScreenshotFailure({
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
      artifactDecision: input.outputBoundaryGate.decision,
      outputBoundaryDecision: input.outputBoundaryGate.decision,
    },
  });