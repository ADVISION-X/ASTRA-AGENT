import type { VisualTargetAbilityResult } from "../contract.js";
import * as executionGates from "./visual-target-execution-gates.js";
import * as selectionGates from "./visual-target-selection-gates.js";
import {
  addDataQualityFlags,
  addRejectedCandidateRefs,
  finalizeVisualTargetExecution,
  type VisualTargetExecutionState,
} from "./visual-target-execution-state.js";

export type VisualTargetStageRunner = (state: VisualTargetExecutionState) => VisualTargetAbilityResult | null;

function runPayloadBudgetStage(state: VisualTargetExecutionState): VisualTargetAbilityResult | null {
  const payloadGate = executionGates.validateVisualTargetPayloadBudget({ request: state.input.request });
  state.decisions.payloadBudgetDecision = payloadGate.decision;
  state.telemetry.candidateSetHash = payloadGate.candidateSetHash;
  addDataQualityFlags(state.dataQualityFlags, payloadGate.dataQualityFlags);
  return payloadGate.ok
    ? null
    : finalizeVisualTargetExecution({
      state,
      output: null,
      status: payloadGate.status,
      failureReason: payloadGate.failureReason,
      reviewRequiredReason: payloadGate.reviewRequiredReason,
      statusMessage: payloadGate.statusMessage,
    });
}

function runScreenshotStage(state: VisualTargetExecutionState): VisualTargetAbilityResult | null {
  const screenshotGate = executionGates.validateScreenshotProof({
    request: state.input.request,
  });
  state.decisions.screenshotDecision = screenshotGate.decision;
  state.telemetry.screenshotHash = screenshotGate.screenshotHash;
  addDataQualityFlags(state.dataQualityFlags, screenshotGate.dataQualityFlags);
  return screenshotGate.ok
    ? null
    : finalizeVisualTargetExecution({
      state,
      output: null,
      status: screenshotGate.status,
      failureReason: screenshotGate.failureReason,
      reviewRequiredReason: screenshotGate.reviewRequiredReason,
      statusMessage: screenshotGate.statusMessage,
    });
}

function runAiStage(state: VisualTargetExecutionState): VisualTargetAbilityResult | null {
  const aiGate = executionGates.validateAiResultProof({
    request: state.input.request,
  });
  state.decisions.aiDecision = aiGate.decision;
  state.telemetry.aiInputHash = aiGate.aiInputHash;
  state.telemetry.aiOutputPayloadHash = aiGate.aiOutputPayloadHash;
  addDataQualityFlags(state.dataQualityFlags, aiGate.dataQualityFlags);
  return aiGate.ok
    ? null
    : finalizeVisualTargetExecution({
      state,
      output: null,
      status: aiGate.status,
      failureReason: aiGate.failureReason,
      reviewRequiredReason: aiGate.reviewRequiredReason,
      statusMessage: aiGate.statusMessage,
    });
}

function runPageStateStage(state: VisualTargetExecutionState): VisualTargetAbilityResult | null {
  const pageStateGate = executionGates.validatePageStateConsistency({
    request: state.input.request,
    allowedPageStateTypes: state.profile.allowedPageStateTypes,
  });
  state.decisions.pageStateDecision = pageStateGate.decision;
  addDataQualityFlags(state.dataQualityFlags, pageStateGate.dataQualityFlags);
  return pageStateGate.ok
    ? null
    : finalizeVisualTargetExecution({
      state,
      output: null,
      status: pageStateGate.status,
      failureReason: pageStateGate.failureReason,
      reviewRequiredReason: pageStateGate.reviewRequiredReason,
      statusMessage: pageStateGate.statusMessage,
    });
}

function runCandidateSourceStage(state: VisualTargetExecutionState): VisualTargetAbilityResult | null {
  const candidateSourceGate = executionGates.validateCandidateSources({
    request: state.input.request,
    profile: state.profile,
  });
  state.decisions.candidateSourceDecision = candidateSourceGate.decision;
  state.decisions.candidateSourceBindingDecision = candidateSourceGate.bindingDecision;
  addDataQualityFlags(state.dataQualityFlags, candidateSourceGate.dataQualityFlags);
  addRejectedCandidateRefs(state.rejectedCandidateRefs, candidateSourceGate.rejectedCandidateRefs);
  if (!candidateSourceGate.ok) {
    return finalizeVisualTargetExecution({
      state,
      output: null,
      status: candidateSourceGate.status,
      failureReason: candidateSourceGate.failureReason,
      reviewRequiredReason: candidateSourceGate.reviewRequiredReason,
      statusMessage: candidateSourceGate.statusMessage,
    });
  }
  state.candidateSourceCandidates = candidateSourceGate.candidates;
  return null;
}

function runCoordinateSpaceStage(state: VisualTargetExecutionState): VisualTargetAbilityResult | null {
  const coordinateGate = executionGates.validateCoordinateSpace({
    request: state.input.request,
    candidates: state.candidateSourceCandidates,
  });
  state.decisions.coordinateSpaceDecision = coordinateGate.decision;
  state.telemetry.coordinateTransformTrace = coordinateGate.coordinateTransformTrace;
  addDataQualityFlags(state.dataQualityFlags, coordinateGate.dataQualityFlags);
  addRejectedCandidateRefs(state.rejectedCandidateRefs, coordinateGate.rejectedCandidateRefs);
  if (!coordinateGate.ok) {
    return finalizeVisualTargetExecution({
      state,
      output: null,
      status: coordinateGate.status,
      failureReason: coordinateGate.failureReason,
      reviewRequiredReason: coordinateGate.reviewRequiredReason,
      statusMessage: coordinateGate.statusMessage,
    });
  }
  state.coordinateCandidates = coordinateGate.candidates;
  return null;
}

function runTargetTypeStage(state: VisualTargetExecutionState): VisualTargetAbilityResult | null {
  const targetTypeGate = selectionGates.validateTargetTypePolicy({
    request: state.input.request,
    candidates: state.coordinateCandidates,
    profile: state.profile,
  });
  state.decisions.targetTypeDecision = targetTypeGate.decision;
  addDataQualityFlags(state.dataQualityFlags, targetTypeGate.dataQualityFlags);
  addRejectedCandidateRefs(state.rejectedCandidateRefs, targetTypeGate.rejectedCandidateRefs);
  if (!targetTypeGate.ok) {
    return finalizeVisualTargetExecution({
      state,
      output: null,
      status: targetTypeGate.status,
      failureReason: targetTypeGate.failureReason,
      reviewRequiredReason: targetTypeGate.reviewRequiredReason,
      statusMessage: targetTypeGate.statusMessage,
    });
  }
  state.targetTypeCandidates = targetTypeGate.candidates;
  return null;
}

function runSelectionStage(state: VisualTargetExecutionState): VisualTargetAbilityResult | null {
  const selectionGate = selectionGates.selectTargetCandidate({
    candidates: state.targetTypeCandidates,
  });
  state.decisions.selectionDecision = selectionGate.decision;
  state.telemetry.candidateScoreTrace = selectionGate.candidateScoreTrace;
  state.telemetry.selectionTrace = selectionGate.selectionTrace;
  addDataQualityFlags(state.dataQualityFlags, selectionGate.dataQualityFlags);
  if (!selectionGate.ok) {
    return finalizeVisualTargetExecution({
      state,
      output: null,
      status: selectionGate.status,
      failureReason: selectionGate.failureReason,
      reviewRequiredReason: selectionGate.reviewRequiredReason,
      statusMessage: selectionGate.statusMessage,
    });
  }
  state.selectedCandidates = selectionGate.candidates;
  state.selectedCandidate = selectionGate.selectedCandidate;
  return null;
}

function runAmbiguityStage(state: VisualTargetExecutionState): VisualTargetAbilityResult | null {
  const ambiguityGate = selectionGates.validateAmbiguity({
    candidates: state.selectedCandidates,
  });
  state.decisions.ambiguityDecision = ambiguityGate.decision;
  state.telemetry.ambiguityTrace = ambiguityGate.ambiguityTrace;
  addDataQualityFlags(state.dataQualityFlags, ambiguityGate.dataQualityFlags);
  return ambiguityGate.ok
    ? null
    : finalizeVisualTargetExecution({
      state,
      output: null,
      status: ambiguityGate.status,
      failureReason: ambiguityGate.failureReason,
      reviewRequiredReason: ambiguityGate.reviewRequiredReason,
      statusMessage: ambiguityGate.statusMessage,
    });
}

function runOutputBoundaryStage(state: VisualTargetExecutionState): VisualTargetAbilityResult | null {
  const outputBoundaryGate = selectionGates.validateVisualTargetOutputBoundary({
    request: state.input.request,
    profile: state.profile,
    selectedCandidate: state.selectedCandidate!,
    accumulatedDataQualityFlags: [...state.dataQualityFlags],
  });
  state.decisions.outputBoundaryDecision = outputBoundaryGate.decision;
  state.decisions.criticalDataQualityDecision = outputBoundaryGate.criticalDataQualityDecision;
  addDataQualityFlags(state.dataQualityFlags, outputBoundaryGate.dataQualityFlags);
  if (!outputBoundaryGate.ok) {
    return finalizeVisualTargetExecution({
      state,
      output: null,
      status: outputBoundaryGate.status,
      failureReason: outputBoundaryGate.failureReason,
      reviewRequiredReason: outputBoundaryGate.reviewRequiredReason,
      statusMessage: outputBoundaryGate.statusMessage,
    });
  }
  state.output = outputBoundaryGate.output;
  return null;
}

export const VISUAL_TARGET_STAGE_RUNNERS: VisualTargetStageRunner[] = [
  runPayloadBudgetStage,
  runScreenshotStage,
  runAiStage,
  runPageStateStage,
  runCandidateSourceStage,
  runCoordinateSpaceStage,
  runTargetTypeStage,
  runSelectionStage,
  runAmbiguityStage,
  runOutputBoundaryStage,
];