import type {
  ParsedVisualTargetAbilityInput,
  VisualTargetAbilityResult,
} from "../contract.js";
import type { VisualTargetRuntimeContext } from "./visual-target-runtime-context.js";
import { hashVisualTargetPayload } from "../shared/visual-target-types.js";
import {
  createVisualTargetExecutionState,
  finalizeVisualTargetExecution,
} from "./visual-target-execution-state.js";
import { VISUAL_TARGET_STAGE_RUNNERS } from "./visual-target-execution-stage-runners.js";

export async function executeVisualTarget(input: {
  request: ParsedVisualTargetAbilityInput;
  context: VisualTargetRuntimeContext;
}): Promise<VisualTargetAbilityResult> {
  const state = createVisualTargetExecutionState(input);
  for (const runStage of VISUAL_TARGET_STAGE_RUNNERS) {
    const finalResult = runStage(state);
    if (finalResult) {
      return finalResult;
    }
  }

  state.telemetry.selectedCandidateHash = hashVisualTargetPayload({
    candidateRef: state.selectedCandidate!.candidateRef,
    coordinateSpace: state.selectedCandidate!.executableCoordinateSpace,
    boundingBox: state.selectedCandidate!.executableBoundingBox,
    clickPoint: state.selectedCandidate!.executableClickPoint,
  });
  return finalizeVisualTargetExecution({
    state,
    output: state.output,
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    statusMessage: `${state.input.request.childCapabilityId} selected governed visual target candidate ${state.selectedCandidate!.candidateRef}.`,
  });
}