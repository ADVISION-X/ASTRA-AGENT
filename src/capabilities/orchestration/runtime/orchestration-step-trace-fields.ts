import type { MissionState } from "../contract.js";
import type { StructuredJointCheckpoint, StructuredJointStage } from "../../../types/structured-log.js";
import type { StepResultRecord } from "./orchestration-step-trace-payloads.js";
import type { OperationalStep } from "./step-dispatch-shared.js";

const COMMENT_JOINT_STAGE_BY_STEP_ID: Record<string, StructuredJointStage> = {
  "analyze-comments-entry-target-candidate": "ai_candidate",
  "observe-comments-button": "visual_target",
  "normalize-comments-target": "geometry_guard",
  "click-comments-button": "mouse_click",
  "verify-comments-open": "post_verify",
  "capture-comments-panel": "comments_capture",
};

const resolvePayloadRefValue = (payloadRefs: MissionState["payloadRefs"], key: string): string | null => {
  const payloadKey = key as keyof MissionState["payloadRefs"];
  const value = payloadRefs[payloadKey];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const checkpointStatus = (payloadRefs: MissionState["payloadRefs"], key: string): StructuredJointCheckpoint["aiCandidateResult"] =>
  resolvePayloadRefValue(payloadRefs, key) ? "exists" : "missing";

export const resolveJointStage = (step: OperationalStep): StructuredJointStage =>
  COMMENT_JOINT_STAGE_BY_STEP_ID[step.stepId] ?? "none";

export const resolveStepInputTrace = (step: OperationalStep, state: MissionState) => {
  const expectedInputRefKeys = [...step.inputRefs];
  const resolvedPairs = expectedInputRefKeys
    .map((key) => ({ key, value: resolvePayloadRefValue(state.payloadRefs, key) }))
    .flatMap((pair) => pair.value === null ? [] : [{ key: pair.key, value: pair.value }]);

  return {
    expectedInputRefKeys,
    resolvedInputRefKeys: resolvedPairs.map((pair) => pair.key),
    missingInputRefKeys: expectedInputRefKeys.filter((key) => !resolvedPairs.some((pair) => pair.key === key)),
    resolvedInputRefs: [...new Set(resolvedPairs.map((pair) => pair.value))],
  };
};

export const resolveStepOutputTrace = (step: OperationalStep, stepResult?: StepResultRecord | null) => {
  const producedOutputRefs = [
    stepResult?.resultRef ?? null,
    stepResult?.outputRef ?? null,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  return {
    outputRefAliases: [...step.outputRefPolicy.storeAs],
    producedOutputRefs: [...new Set(producedOutputRefs)],
  };
};

export const buildJointCheckpoint = (state: MissionState): StructuredJointCheckpoint => ({
  aiCandidateResult: checkpointStatus(state.payloadRefs, "aiResultRef"),
  visualTargetResult: checkpointStatus(state.payloadRefs, "visualTargetResultRef"),
  geometryGuardResult: checkpointStatus(state.payloadRefs, "geometryGuardResultRef"),
  mouseClickResult: checkpointStatus(state.payloadRefs, "clickResultRef"),
  postVerifyResult: checkpointStatus(state.payloadRefs, "postActionVerificationResultRef"),
  commentsPanelCapture: checkpointStatus(state.payloadRefs, "commentsEvidenceRef"),
});
