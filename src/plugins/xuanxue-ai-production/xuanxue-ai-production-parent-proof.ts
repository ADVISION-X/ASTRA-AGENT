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

const sameReusableBaseIdentity = (
  left: FrozenParticipant,
  right: FrozenParticipant,
): boolean => left.personRef === right.personRef
  && left.profileVersionRef === right.profileVersionRef
  && left.chartStateRef === right.chartStateRef
  && left.chartStateVersion === right.chartStateVersion
  && left.chartStateHash === right.chartStateHash;

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
  if (
    input.child.order.frozenSubject.privacyOwnerRef
      !== input.parent.order.frozenSubject.privacyOwnerRef
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_PARENT_FROZEN_SUBJECT_MISMATCH");
  }
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
    || !sameReusableBaseIdentity(childParticipant, parentParticipant)
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_PARENT_FROZEN_SUBJECT_MISMATCH");
  }
};

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

export const physicalParentRecord = (input: {
  originalParent: XuanxueAiOrderRecord;
  parentRef: NonNullable<XuanxueAiOrderRecord["order"]["conversationParent"]>;
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
  return { order: input.originalParent, stage };
};
