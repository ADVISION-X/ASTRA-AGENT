import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { resolveAbilityResultProofSummary, type AbilityResultProofSummary } from "../../capabilities/orchestration/index.js";
import { payloadDocumentToObject, payloadValueToString } from "./workbench-payload.js";
import { resolveMouseClickPostVerificationHandoff } from "./workbench-muscle-joint-contract-resolvers.js";
import {
  buildExpectedOutcome,
  buildPostActionChainFields,
  buildVerificationPolicy,
  normalizePageStateLogin,
  resolvePostActionInputPolicy,
  type PostActionInputPolicy,
} from "./workbench-post-action-dispatch-policy.js";

type PostActionDispatchRuntime = Pick<WorkbenchRuntime, "browserController">;

const resolveSourceProofRef = (
  envelope: AbilityCommandEnvelope,
  payload: Record<string, string | number | boolean | null>,
) => {
  return payloadValueToString(payload.abilityResultRef)
    ?? payloadValueToString(payload.sourceEvidenceRef)
    ?? envelope.inputRef;
};

const resolveMouseClickResultRef = (
  payload: Record<string, string | number | boolean | null>,
) => payloadValueToString(payload.clickResultRef);

const readSummaryString = (summary: AbilityResultProofSummary | null, key: string): string | null => {
  const value = summary?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const resolveActionStatus = (sourceSummary: AbilityResultProofSummary | null) => {
  const status = readSummaryString(sourceSummary, "actionStatus") ?? readSummaryString(sourceSummary, "status");
  if (status === "dispatched" || status === "failed" || status === "review_required") {
    return status;
  }
  return "completed" as const;
};

const buildPageStateObservation = (
  runtime: PostActionDispatchRuntime,
  envelope: AbilityCommandEnvelope,
  sourceProofRef: string,
  summary: string,
) => {
  const session = runtime.browserController.getSessionState();
  return {
    ref: `${envelope.inputRef}:page-state`,
    kind: "page_state" as const,
    source: {
      sourceAbilityGroupId: "page-state" as const,
      sourceChildCapabilityId: "observe-platform-surface",
      sourceProofRef,
    },
    capturedAt: new Date().toISOString(),
    sessionId: envelope.sessionId,
    roundId: envelope.roundId,
    videoVisitId: envelope.videoVisitId,
    payload: {
      kind: "page_state" as const,
      currentUrl: session.currentUrl || null,
      loginState: normalizePageStateLogin(session.loginState),
      commentsPanelOpen: null,
      modalOverlayPresent: null,
      recommendationChanged: null,
      changeSummary: summary,
      targetStateChanged: null,
      targetType: null,
      wrongDomain: null,
    },
  };
};

const buildActionProof = (input: {
  envelope: AbilityCommandEnvelope;
  sourceProofRef: string;
  policy: PostActionInputPolicy;
  sourceSummary?: AbilityResultProofSummary | null;
  mouseClickHandoff?: ReturnType<typeof resolveMouseClickPostVerificationHandoff>;
}) => ({
  actionProofRef: input.mouseClickHandoff?.postActionVerificationHandoffRef ?? input.sourceProofRef,
  actionLogRef: input.mouseClickHandoff?.postActionVerificationHandoffRef ?? input.sourceProofRef,
  actionRecordRef: null,
  sourceRuntimeProofRef: input.mouseClickHandoff?.sourceActionRuntimeProofRef ?? input.sourceProofRef,
  sourceActionResultRef: input.mouseClickHandoff?.clickResultRef ?? input.sourceProofRef,
  sourceActionOutputRef: input.mouseClickHandoff?.clickResultRef ?? input.sourceProofRef,
  sourceAbilityGroupId: input.mouseClickHandoff?.sourceActionAbilityGroupId ?? input.policy.sourceAbilityGroupId,
  sourceChildCapabilityId: input.mouseClickHandoff?.sourceActionChildCapabilityId ?? input.policy.sourceChildCapabilityId,
  actionType: input.policy.sourceActionType,
  actionStatus: input.mouseClickHandoff ? "completed" : resolveActionStatus(input.sourceSummary ?? null),
  primitiveExecutionRef: input.policy.executionRefField === "primitiveExecutionRef"
    ? input.mouseClickHandoff?.primitiveExecutionRef ?? input.sourceProofRef
    : null,
  navigationAttemptRef: null,
  scrollExecutionRef: input.policy.executionRefField === "scrollExecutionRef"
    ? readSummaryString(input.sourceSummary ?? null, "scrollExecutionRef") ?? input.sourceProofRef
    : null,
  sessionId: input.envelope.sessionId,
  roundId: input.envelope.roundId,
  videoVisitId: input.envelope.videoVisitId,
  startedAt: input.mouseClickHandoff?.actionStartedAt
    ?? readSummaryString(input.sourceSummary ?? null, "primitiveStartedAt")
    ?? readSummaryString(input.sourceSummary ?? null, "startedAt")
    ?? input.envelope.createdAt,
  endedAt: input.mouseClickHandoff?.actionEndedAt
    ?? readSummaryString(input.sourceSummary ?? null, "primitiveEndedAt")
    ?? readSummaryString(input.sourceSummary ?? null, "endedAt")
    ?? input.envelope.createdAt,
  selfReportedOnly: false,
});

export const buildPostActionVerificationInput = async (
  runtime: PostActionDispatchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = payloadDocumentToObject(inputPayload);
  const policy = resolvePostActionInputPolicy(envelope);
  const mouseClickResultRef = policy.sourceAbilityGroupId === "mouse-click"
    ? resolveMouseClickResultRef(payload)
    : null;

  if (policy.sourceAbilityGroupId === "mouse-click" && !mouseClickResultRef) {
    throw new Error(`Post Action Verification dispatch for ${envelope.stepId} requires clickResultRef from MouseClickResult.`);
  }

  const sourceProofRef = mouseClickResultRef ?? resolveSourceProofRef(envelope, payload);
  const mouseClickHandoff = mouseClickResultRef
    ? resolveMouseClickPostVerificationHandoff(mouseClickResultRef)
    : null;

  if (mouseClickResultRef && !mouseClickHandoff) {
    throw new Error(`Post Action Verification dispatch for ${envelope.stepId} requires canonical MouseClickResult handoff.`);
  }

  const sourceSummary = mouseClickHandoff ? null : resolveAbilityResultProofSummary(sourceProofRef);
  const actionProofRef = mouseClickHandoff?.postActionVerificationHandoffRef ?? sourceProofRef;
  return JSON.parse(JSON.stringify({
    abilityGroupId: "post-action-verification",
    childCapabilityId: policy.childCapabilityId,
    requestedBy: "orchestration",
    ...buildPostActionChainFields(envelope),
    sourceAbilityGroupId: policy.sourceAbilityGroupId,
    sourceChildCapabilityId: policy.sourceChildCapabilityId,
    sourceActionType: policy.sourceActionType,
    expectedOutcome: buildExpectedOutcome(envelope, inputPayload, policy),
    actionProof: {
      ...buildActionProof({ envelope, sourceProofRef, policy, sourceSummary, mouseClickHandoff }),
    },
    beforeAfterEvidence: { beforeEvidence: null, afterEvidence: null },
    observationSet: {
      observations: [buildPageStateObservation(runtime, envelope, actionProofRef, inputPayload.summary)],
    },
    verificationPolicy: buildVerificationPolicy(policy),
    inputRef: envelope.inputRef,
    idempotencyKey: envelope.idempotencyKey,
  }));
};
