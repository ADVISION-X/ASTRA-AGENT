import type {
  XuanxueAiProductId,
  XuanxueAiProductionOrder,
  XuanxueAiStageId,
} from "./xuanxue-ai-production.schema.js";
import {
  assertXuanxueProductContractHash,
  xuanxueLocalOrderNode,
  type GeneratedProductNode,
  type LocalOrderSource,
} from "./xuanxue-ai-production-product-contracts.js";

export interface XuanxueAiStageDefinition {
  readonly stageId: XuanxueAiStageId;
  readonly dependsOn: readonly XuanxueAiStageId[];
  readonly continuationFrom: XuanxueAiStageId | null;
  readonly generatedInputsFrom: readonly XuanxueAiStageId[];
}

export interface XuanxueAiProductionProfile {
  readonly productId: XuanxueAiProductId;
  readonly nodeId: string;
  readonly stages: readonly XuanxueAiStageDefinition[];
  readonly finalStageId: XuanxueAiStageId;
}

const profileFromNode = (
  productId: XuanxueAiProductId,
  node: GeneratedProductNode,
): XuanxueAiProductionProfile => ({
  productId,
  nodeId: node.node_id,
  stages: node.order_contract.stages.map((stage) => ({
    stageId: stage.stage_id,
    dependsOn: stage.depends_on_stage_ids,
    continuationFrom: stage.continuation_from_stage_id,
    generatedInputsFrom: stage.generated_inputs_from_stage_ids,
  })),
  finalStageId: node.order_contract.final_stage_id,
});

export const resolveXuanxueAiProductionProfile = (
  order: LocalOrderSource,
): XuanxueAiProductionProfile => profileFromNode(
  order.productId,
  xuanxueLocalOrderNode(order),
);

const assertStageChain = (profile: XuanxueAiProductionProfile): void => {
  const prior = new Set<XuanxueAiStageId>();
  if (profile.stages.length < 1 || profile.stages.at(-1)?.stageId !== profile.finalStageId) {
    throw new Error("XUANXUE_AI_PRODUCTION_LOCAL_ORDER_FINAL_STAGE_INVALID");
  }
  for (const stage of profile.stages) {
    if (stage.dependsOn.some((stageId) => !prior.has(stageId))
      || stage.generatedInputsFrom.some((stageId) => !prior.has(stageId))
      || (stage.continuationFrom !== null && !prior.has(stage.continuationFrom))) {
      throw new Error("XUANXUE_AI_PRODUCTION_LOCAL_ORDER_STAGE_CHAIN_INVALID");
    }
    prior.add(stage.stageId);
  }
};

const assertParticipantManifest = (order: XuanxueAiProductionOrder): void => {
  const participants = order.frozenSubject.participants;
  const people = new Set(participants.map((participant) => participant.personRef));
  const slots = new Set(participants.map((participant) => participant.slotRef));
  if (people.size !== participants.length || slots.size !== participants.length
    || (order.frozenSubject.primaryPersonRef !== null
      && !people.has(order.frozenSubject.primaryPersonRef))) {
    throw new Error("XUANXUE_AI_PRODUCTION_PARTICIPANT_MANIFEST_INVALID");
  }
};

const assertDeclaredJoinParents = (order: XuanxueAiProductionOrder): void => {
  const slots = new Set<string>();
  const executions = new Set<string>();
  const roles = new Set<string>();
  for (const parent of order.joinParents) {
    const participant = order.frozenSubject.participants.find(
      (candidate) => candidate.slotRef === parent.participantSlotRef,
    );
    if (roles.has(parent.participantRoleCode)) {
      throw new Error(parent.participantRoleCode.startsWith("party_")
        ? "XUANXUE_AI_PRODUCTION_HEHUN_THREE_CONTEXTS_REQUIRED"
        : "XUANXUE_AI_PRODUCTION_TYPED_JOIN_PARENT_MISMATCH");
    }
    if (!participant
      || participant.roleCode !== parent.participantRoleCode
      || participant.personRef !== parent.personRef
      || slots.has(parent.participantSlotRef)
      || executions.has(parent.executionId)) {
      throw new Error("XUANXUE_AI_PRODUCTION_TYPED_JOIN_PARENT_MISMATCH");
    }
    slots.add(parent.participantSlotRef);
    roles.add(parent.participantRoleCode);
    executions.add(parent.executionId);
  }
  if (order.joinParents.length > 0) {
    const expectedSlots = order.frozenSubject.participants
      .filter((participant) => participant.personRef !== order.frozenSubject.primaryPersonRef)
      .map((participant) => participant.slotRef);
    if (expectedSlots.length !== slots.size
      || expectedSlots.some((slot) => !slots.has(slot))) {
      throw new Error("XUANXUE_AI_PRODUCTION_NAMING_TYPED_JOINS_INVALID");
    }
  }
};

export const assertXuanxueAiOrderMatchesProfile = (
  order: XuanxueAiProductionOrder,
): XuanxueAiProductionProfile => {
  assertXuanxueProductContractHash(order, order.productContractHash);
  const profile = resolveXuanxueAiProductionProfile(order);
  assertStageChain(profile);
  assertParticipantManifest(order);
  assertDeclaredJoinParents(order);
  return profile;
};
