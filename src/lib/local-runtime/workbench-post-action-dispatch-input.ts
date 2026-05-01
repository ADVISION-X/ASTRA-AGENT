import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";

export const buildPostActionVerificationInput = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => JSON.parse(JSON.stringify({
  abilityGroupId: "post-action-verification",
  childCapabilityId: envelope.commandName === "verify-comments-open" ? "verify-comments-panel-opened" : "verify-action-result",
  requestedBy: "orchestration",
  sessionId: envelope.missionId,
  roundId: envelope.stepId,
  videoVisitId: null,
  expectedOutcome: { outcomeKind: "state_change", summary: inputPayload.summary },
  actionProof: {
    actionProofRef: envelope.inputRef,
    sourceAbilityGroupId: "mouse-click",
    sourceChildCapabilityId: "click-browser-coordinate",
    sourceRuntimeProofRef: envelope.inputRef,
    sourceActionResultRef: envelope.inputRef,
    sourceActionOutputRef: envelope.inputRef,
    actionLogRef: envelope.inputRef,
    actionRecordRef: envelope.inputRef,
  },
  beforeAfterEvidence: { beforeEvidence: null, afterEvidence: null },
  observationSet: {
    observations: [{
      ref: `${envelope.inputRef}:observation`,
      kind: "runtime_signal",
      observedAt: new Date().toISOString(),
      confidence: 0.5,
      source: { sourceAbilityGroupId: "post-action-verification", sourceChildCapabilityId: envelope.commandName, sourceProofRef: envelope.inputRef },
      payload: { signalType: "action_completed", value: true, detail: inputPayload.summary },
    }],
  },
  verificationPolicy: { requireBeforeAfterEvidence: false, requireObservationSupport: false, allowReviewRequired: true },
  confidencePolicy: { minimumConfidence: 0.5, allowReviewRequired: true },
  inputRef: envelope.inputRef,
}));