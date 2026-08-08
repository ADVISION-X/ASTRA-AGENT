import type { XuanxueAiProductionRuntime } from "./xuanxue-ai-production.runtime.js";
import type {
  XuanxueAiOrderRecord,
  XuanxueAiProductionOrder,
  XuanxueAiStageId,
  XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";

export const requireXuanxueStage = (
  record: XuanxueAiOrderRecord,
  stageId: XuanxueAiStageId,
): XuanxueAiStageRecord => {
  const stage = record.stages.find((candidate) => candidate.stageId === stageId);
  if (!stage) {
    throw new Error(`XUANXUE_AI_PRODUCTION_STAGE_MISSING:${stageId}`);
  }
  return stage;
};

type FrozenParticipant = XuanxueAiProductionOrder[
  "frozenSubject"
]["participants"][number];

const sameParticipantIdentity = (
  left: FrozenParticipant,
  right: FrozenParticipant,
): boolean => left.personRef === right.personRef
  && left.profileVersionRef === right.profileVersionRef
  && left.chartStateRef === right.chartStateRef
  && left.chartStateVersion === right.chartStateVersion
  && left.chartStateHash === right.chartStateHash
  && left.purposeCode === right.purposeCode
  && left.authorizationReceiptRef === right.authorizationReceiptRef;

const assertFrozenTaskEnvelopeMatches = (
  child: XuanxueAiOrderRecord,
  parent: XuanxueAiOrderRecord,
): void => {
  const childSubject = child.order.frozenSubject;
  const parentSubject = parent.order.frozenSubject;
  if (
    childSubject.privacyOwnerRef !== parentSubject.privacyOwnerRef
    || childSubject.snapshotRef !== parentSubject.snapshotRef
    || childSubject.snapshotHash !== parentSubject.snapshotHash
    || childSubject.caseRevisionRef !== parentSubject.caseRevisionRef
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_PARENT_FROZEN_SUBJECT_MISMATCH");
  }
};

export const assertExactFrozenSubjectMatches = (
  child: XuanxueAiOrderRecord,
  parent: XuanxueAiOrderRecord,
): void => {
  assertFrozenTaskEnvelopeMatches(child, parent);
  const childSubject = child.order.frozenSubject;
  const parentSubject = parent.order.frozenSubject;
  const participantMismatch = childSubject.participants.some((participant) => {
    const exact = parentSubject.participants.find(
      (candidate) => candidate.slotRef === participant.slotRef
        && candidate.roleCode === participant.roleCode,
    );
    return !exact || !sameParticipantIdentity(participant, exact);
  });
  if (
    childSubject.primaryPersonRef !== parentSubject.primaryPersonRef
    || childSubject.participantManifestHash
      !== parentSubject.participantManifestHash
    || childSubject.participants.length !== parentSubject.participants.length
    || participantMismatch
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_PARENT_FROZEN_SUBJECT_MISMATCH");
  }
};

export const assertPersonParentMatches = (input: {
  child: XuanxueAiOrderRecord;
  parent: XuanxueAiOrderRecord;
  personRef: string;
}): void => {
  assertFrozenTaskEnvelopeMatches(input.child, input.parent);
  const childParticipant = input.child.order.frozenSubject.participants.find(
    (candidate) => candidate.personRef === input.personRef,
  );
  const parentParticipant = input.parent.order.frozenSubject.participants.find(
    (candidate) => candidate.personRef === input.personRef,
  );
  if (
    !childParticipant
    || !parentParticipant
    || input.parent.order.frozenSubject.primaryPersonRef !== input.personRef
    || !sameParticipantIdentity(childParticipant, parentParticipant)
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_PARENT_FROZEN_SUBJECT_MISMATCH");
  }
};

type ParentConversationRebuild = ReturnType<
  XuanxueAiProductionRuntime["store"]["readParentConversationRebuild"]
>;

const assertOriginalParent = (input: {
  order: XuanxueAiOrderRecord;
  stage: XuanxueAiStageRecord;
  parentRef: NonNullable<XuanxueAiOrderRecord["order"]["conversationParent"]>;
}): void => {
  if (
    input.stage.status !== "completed"
    || input.stage.executionId !== input.parentRef.executionId
    || input.stage.rawOutputHash !== input.parentRef.rawOutputHash
    || input.order.order.inputBundleHash !== input.parentRef.inputBundleHash
    || input.order.order.conversationScopeRef
      !== input.parentRef.conversationScopeRef
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_PARENT_LOCAL_PROOF_MISMATCH");
  }
};

const requireRebuiltParent = (input: {
  runtime: XuanxueAiProductionRuntime;
  parentRef: NonNullable<XuanxueAiOrderRecord["order"]["conversationParent"]>;
  rebuild: NonNullable<ParentConversationRebuild>;
}): { order: XuanxueAiOrderRecord; stage: XuanxueAiStageRecord } => {
  if (
    !input.rebuild.rebuiltJobId
    || !input.rebuild.rebuiltExecutionId
    || input.rebuild.rebuiltRawOutputHash !== input.parentRef.rawOutputHash
    || input.rebuild.rebuiltInputBundleHash !== input.parentRef.inputBundleHash
    || input.rebuild.rebuiltConversationScopeRef
      !== input.parentRef.conversationScopeRef
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_PARENT_LOCAL_PROOF_MISMATCH");
  }
  const order = input.runtime.store.readOrder(input.rebuild.rebuiltJobId);
  if (!order || order.status !== "completed") {
    throw new Error("XUANXUE_AI_PRODUCTION_PARENT_LOCAL_PROOF_MISMATCH");
  }
  const stage = requireXuanxueStage(order, input.parentRef.stageId);
  if (
    stage.status !== "completed"
    || stage.executionId !== input.rebuild.rebuiltExecutionId
    || stage.rawOutputHash !== input.rebuild.rebuiltRawOutputHash
    || order.order.inputBundleHash !== input.rebuild.rebuiltInputBundleHash
    || order.order.conversationScopeRef
      !== input.rebuild.rebuiltConversationScopeRef
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_PARENT_LOCAL_PROOF_MISMATCH");
  }
  return { order, stage };
};

export const physicalParentRecord = (input: {
  runtime: XuanxueAiProductionRuntime;
  originalParent: XuanxueAiOrderRecord;
  parentRef: NonNullable<XuanxueAiOrderRecord["order"]["conversationParent"]>;
  rebuild: ParentConversationRebuild;
}): { order: XuanxueAiOrderRecord; stage: XuanxueAiStageRecord } => {
  const stage = requireXuanxueStage(
    input.originalParent,
    input.parentRef.stageId,
  );
  assertOriginalParent({
    order: input.originalParent,
    stage,
    parentRef: input.parentRef,
  });
  return input.rebuild
    ? requireRebuiltParent({
        runtime: input.runtime,
        parentRef: input.parentRef,
        rebuild: input.rebuild,
      })
    : { order: input.originalParent, stage };
};
