import type { MissionState } from "../contract.js";
import type { StructuredFailureSnapshot } from "../../../types/structured-log.js";
import type { OperationalStep } from "./step-dispatch-shared.js";
import { resolveJointStage } from "./orchestration-step-trace-fields.js";

const resolvePayloadRefValue = (payloadRefs: MissionState["payloadRefs"], key: string): string | null => {
  const payloadKey = key as keyof MissionState["payloadRefs"];
  const value = payloadRefs[payloadKey];
  return typeof value === "string" && value.length > 0 ? value : null;
};

export const buildFailureSnapshot = (
  input: {
    state: MissionState;
    step: OperationalStep;
    failureReason?: string | null;
  },
): StructuredFailureSnapshot => ({
  failedStepId: input.step.stepId,
  failedJointStage: resolveJointStage(input.step),
  failureReason: input.failureReason ?? null,
  lastSuccessfulStepId: input.state.previousStepId ?? null,
  lastSuccessfulResultRef: input.state.lastResultRef ?? null,
  screenshotEvidenceRef: resolvePayloadRefValue(input.state.payloadRefs, "screenshotEvidenceRef"),
  aiResultRef: resolvePayloadRefValue(input.state.payloadRefs, "aiResultRef"),
  visualTargetResultRef: resolvePayloadRefValue(input.state.payloadRefs, "visualTargetResultRef"),
  geometryGuardResultRef: resolvePayloadRefValue(input.state.payloadRefs, "geometryGuardResultRef"),
  clickResultRef: resolvePayloadRefValue(input.state.payloadRefs, "clickResultRef"),
  postActionVerificationResultRef: resolvePayloadRefValue(input.state.payloadRefs, "postActionVerificationResultRef"),
  commentsEvidenceRef: resolvePayloadRefValue(input.state.payloadRefs, "commentsEvidenceRef"),
});
