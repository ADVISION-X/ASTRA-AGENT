import type {
  XuanxueAiProductId,
  XuanxueAiProductionOrder,
  XuanxueAiStageId,
} from "./xuanxue-ai-production.schema.js";
import {
  assertXuanxueProductContractHash,
  xuanxueLocalOrderNode,
  xuanxueProductExecutionContract,
  type GeneratedProductNode,
} from "./xuanxue-ai-production-product-contracts.js";
import {
  assertXuanxueLocalizationContract,
  isXuanxueLocalizationProduct,
} from "./xuanxue-ai-production-localization-contract.js";

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
  stages: node.order_contract.stages
    .slice()
    .sort((left, right) => left.ordinal - right.ordinal)
    .map((stage) => {
      const localStageIds = new Set(node.order_contract.allowed_stage_ids);
      return {
      stageId: stage.stage_id,
      dependsOn: stage.depends_on_stage_ids.filter((stageId) => localStageIds.has(stageId)),
      continuationFrom: stage.continuation_from_stage_id !== null
        && localStageIds.has(stage.continuation_from_stage_id)
        ? stage.continuation_from_stage_id
        : null,
      generatedInputsFrom: stage.generated_inputs_from_stage_ids.filter(
        (stageId) => localStageIds.has(stageId),
      ),
      };
    }),
  finalStageId: node.order_contract.final_stage_id,
});

export const resolveXuanxueAiProductionProfile = (
  productId: XuanxueAiProductId,
  materialStageIds: readonly XuanxueAiStageId[],
): XuanxueAiProductionProfile => profileFromNode(
  productId,
  xuanxueLocalOrderNode(productId, materialStageIds),
);

const assertGeneratedStageChain = (
  profile: XuanxueAiProductionProfile,
): void => {
  if (profile.stages.length < 1
    || profile.stages.at(-1)?.stageId !== profile.finalStageId) {
    throw new Error("XUANXUE_AI_PRODUCTION_GENERATED_FINAL_STAGE_INVALID");
  }
  const prior = new Set<XuanxueAiStageId>();
  for (const stage of profile.stages) {
    if (stage.dependsOn.some((stageId) => !prior.has(stageId))
      || stage.generatedInputsFrom.some((stageId) => !prior.has(stageId))
      || (stage.continuationFrom !== null && !prior.has(stage.continuationFrom))) {
      throw new Error("XUANXUE_AI_PRODUCTION_GENERATED_STAGE_CHAIN_INVALID");
    }
    prior.add(stage.stageId);
  }
};

const assertConversationBinding = (
  order: XuanxueAiProductionOrder,
  node: GeneratedProductNode,
): void => {
  const first = node.order_contract.stages
    .slice()
    .sort((left, right) => left.ordinal - right.ordinal)[0]!;
  const expectedRelation = first.conversation_mode === "fork"
    ? "forked_from_checkpoint"
    : first.conversation_mode === "continue_exact"
      ? "same_conversation"
      : null;
  if (Boolean(expectedRelation) !== Boolean(order.conversationParent)
    || (expectedRelation && order.conversationParent?.relation !== expectedRelation)) {
    throw new Error("XUANXUE_AI_PRODUCTION_CONVERSATION_BINDING_INVALID");
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

const assertTypedJoinBinding = (
  order: XuanxueAiProductionOrder,
  node: GeneratedProductNode,
): void => {
  const joins = order.joinParents;
  if (node.join_binding === "none" && joins.length !== 0) {
    throw new Error("XUANXUE_AI_PRODUCTION_TYPED_JOIN_NOT_ALLOWED");
  }
  if (node.join_binding === "exact_slots_a_and_b_with_person_identity"
    && joins.length !== 2) {
    throw new Error("XUANXUE_AI_PRODUCTION_HEHUN_THREE_CONTEXTS_REQUIRED");
  }
  const joinSlots = new Set<string>();
  const executions = new Set<string>();
  for (const parent of joins) {
    const participant = order.frozenSubject.participants.find(
      (candidate) => candidate.slotRef === parent.participantSlotRef,
    );
    if (!participant
      || participant.roleCode !== parent.participantRoleCode
      || participant.personRef !== parent.personRef
      || joinSlots.has(parent.participantSlotRef)
      || executions.has(parent.executionId)) {
      throw new Error("XUANXUE_AI_PRODUCTION_TYPED_JOIN_PARENT_MISMATCH");
    }
    joinSlots.add(parent.participantSlotRef);
    executions.add(parent.executionId);
  }
  if (node.join_binding === "exact_slots_a_and_b_with_person_identity") {
    const requiredParents = xuanxueProductExecutionContract(order.productId)
      .product_graph.edges
      .filter((edge) => edge.to === node.node_id && edge.type.startsWith("typed_parent_slot_"))
      .map((edge) => ({
        stageId: edge.from,
        roleCode: `party_${edge.type.slice("typed_parent_slot_".length)}`,
      }));
    const participantRoles = order.frozenSubject.participants.map(
      (participant) => participant.roleCode,
    );
    if (order.frozenSubject.primaryPersonRef !== null
      || requiredParents.length !== joins.length
      || order.frozenSubject.participants.length !== requiredParents.length
      || requiredParents.some((required) =>
        participantRoles.filter((role) => role === required.roleCode).length !== 1
        || !joins.some((parent) =>
          parent.participantRoleCode === required.roleCode
          && parent.stageId === required.stageId))) {
      throw new Error("XUANXUE_AI_PRODUCTION_HEHUN_THREE_CONTEXTS_REQUIRED");
    }
  }
  if (node.join_binding === "optional_typed_person_material_only") {
    const target = order.frozenSubject.participants.filter(
      (participant) => participant.personRef === order.frozenSubject.primaryPersonRef,
    );
    const auxiliarySlots = order.frozenSubject.participants
      .filter((participant) => participant.personRef !== order.frozenSubject.primaryPersonRef)
      .map((participant) => participant.slotRef);
    if (target.length !== 1
      || target[0]?.roleCode !== "naming_target"
      || auxiliarySlots.length !== joins.length
      || auxiliarySlots.some((slot) => !joinSlots.has(slot))) {
      throw new Error("XUANXUE_AI_PRODUCTION_NAMING_TYPED_JOINS_INVALID");
    }
  }
};

const assertLocalizationProfile = (
  order: XuanxueAiProductionOrder,
): void => {
  if (!isXuanxueLocalizationProduct(order.productId)) return;
  const material = order.materials[0];
  assertXuanxueLocalizationContract({
    productId: order.productId,
    stageId: material?.stageId ?? "",
    triggerKind: order.triggerKind,
    contractManifestHash: order.contractManifestHash,
    productContractHash: order.productContractHash,
    role: order.localizationRole,
    providerProfile: order.providerExecutionProfile as never,
    inputKinds: material?.inputRefs.map((item) => item.kind) ?? [],
    hasConversationParent: Boolean(order.conversationParent),
  });
};

export const assertXuanxueAiOrderMatchesProfile = (
  order: XuanxueAiProductionOrder,
): XuanxueAiProductionProfile => {
  assertXuanxueProductContractHash(order.productId, order.productContractHash);
  const materialStageIds = order.materials.map((material) => material.stageId);
  const node = xuanxueLocalOrderNode(order.productId, materialStageIds);
  const profile = profileFromNode(order.productId, node);
  assertGeneratedStageChain(profile);
  assertConversationBinding(order, node);
  assertParticipantManifest(order);
  assertTypedJoinBinding(order, node);
  assertLocalizationProfile(order);
  return profile;
};
