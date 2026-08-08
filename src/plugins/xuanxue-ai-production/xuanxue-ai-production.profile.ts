import type {
  XuanxueAiProductId,
  XuanxueAiProductionOrder,
  XuanxueAiStageId,
} from "./xuanxue-ai-production.schema.js";
import {
  isXuanxueAiRequiredContinuationProduct,
  isXuanxueAiPaidFollowupProduct,
  isXuanxueAiReusableBaseConsumerProduct,
  xuanxueAiRequiredContinuationProfiles,
} from "./xuanxue-ai-production-conversation-policy.js";
import {
  assertSeededStages,
} from "./xuanxue-ai-production-seeded-proof.js";

export interface XuanxueAiStageDefinition {
  readonly stageId: XuanxueAiStageId;
  readonly dependsOn: readonly XuanxueAiStageId[];
  readonly continuationFrom: XuanxueAiStageId | null;
  readonly generatedInputsFrom: readonly XuanxueAiStageId[];
}

export interface XuanxueAiProductionProfile {
  readonly productId: XuanxueAiProductId;
  readonly stages: readonly XuanxueAiStageDefinition[];
  readonly finalStageId: XuanxueAiStageId;
}

const profiles: Readonly<Record<
  XuanxueAiProductId,
  XuanxueAiProductionProfile
>> = {
  bazi_chart_interpretation: {
    productId: "bazi_chart_interpretation",
    stages: [{
      stageId: "chart_interpretation",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "chart_interpretation",
  },
  bazi_ai_full_analysis: {
    productId: "bazi_ai_full_analysis",
    stages: [{
      stageId: "question_analysis",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "question_analysis",
  },
  bazi_report_followup: {
    productId: "bazi_report_followup",
    stages: [{
      stageId: "question_analysis",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "question_analysis",
  },
  qimen_professional_answer: {
    productId: "qimen_professional_answer",
    stages: [{
      stageId: "analysis",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "analysis",
  },
  qimen_report_followup: {
    productId: "qimen_report_followup",
    stages: [{
      stageId: "followup",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "followup",
  },
  hehun_ai_analysis: {
    productId: "hehun_ai_analysis",
    stages: [{
      stageId: "final_compatibility",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "final_compatibility",
  },
  hehun_report_followup: {
    productId: "hehun_report_followup",
    stages: [{
      stageId: "followup",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "followup",
  },
  naming_bazi_analysis_and_naming: {
    productId: "naming_bazi_analysis_and_naming",
    stages: [
      {
        stageId: "question_analysis",
        dependsOn: [],
        continuationFrom: null,
        generatedInputsFrom: [],
      },
      {
        stageId: "naming_author",
        dependsOn: ["question_analysis"],
        continuationFrom: "question_analysis",
        generatedInputsFrom: ["question_analysis"],
      },
    ],
    finalStageId: "naming_author",
  },
  naming_from_existing_bazi_report: {
    productId: "naming_from_existing_bazi_report",
    stages: [{
      stageId: "naming_author",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "naming_author",
  },
  bazi_canonical_base_interpretation: {
    productId: "bazi_canonical_base_interpretation",
    stages: [{
      stageId: "base_interpretation",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "base_interpretation",
  },
  hehun_canonical_party_a_interpretation: {
    productId: "hehun_canonical_party_a_interpretation",
    stages: [{
      stageId: "party_a_interpretation",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "party_a_interpretation",
  },
  hehun_canonical_party_b_interpretation: {
    productId: "hehun_canonical_party_b_interpretation",
    stages: [{
      stageId: "party_b_interpretation",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "party_b_interpretation",
  },
  manual_accuracy_challenge: {
    productId: "manual_accuracy_challenge",
    stages: [{
      stageId: "manual_accuracy_challenge",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "manual_accuracy_challenge",
  },
  payment_screenshot_observation: {
    productId: "payment_screenshot_observation",
    stages: [{
      stageId: "payment_screenshot_observation",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "payment_screenshot_observation",
  },
  public_knowledge_article_pipeline: {
    productId: "public_knowledge_article_pipeline",
    stages: [
      {
        stageId: "corpus_research",
        dependsOn: [],
        continuationFrom: null,
        generatedInputsFrom: [],
      },
      {
        stageId: "article_synthesis",
        dependsOn: ["corpus_research"],
        continuationFrom: "corpus_research",
        generatedInputsFrom: ["corpus_research"],
      },
      {
        stageId: "article_image_generation",
        dependsOn: ["article_synthesis"],
        continuationFrom: "article_synthesis",
        generatedInputsFrom: ["article_synthesis"],
      },
    ],
    finalStageId: "article_image_generation",
  },
  scheduled_quality_reflection: {
    productId: "scheduled_quality_reflection",
    stages: [{
      stageId: "scheduled_quality_reflection",
      dependsOn: [],
      continuationFrom: null,
      generatedInputsFrom: [],
    }],
    finalStageId: "scheduled_quality_reflection",
  },
};

const CONVERSATION_CHAIN_INVALID =
  "XUANXUE_AI_PRODUCTION_CONVERSATION_CHAIN_INVALID";

export const resolveXuanxueAiProductionProfile = (
  productId: XuanxueAiProductId,
): XuanxueAiProductionProfile => profiles[productId];

const assertSingleConversationStageChain = (
  profile: XuanxueAiProductionProfile,
): void => {
  for (const [index, stage] of profile.stages.entries()) {
    const previous = profile.stages[index - 1];
    if (
      index === 0
        ? stage.continuationFrom !== null
        : stage.continuationFrom !== previous?.stageId
    ) {
      throw new Error(
        `${CONVERSATION_CHAIN_INVALID}:`
        + `${profile.productId}:${stage.stageId}`,
      );
    }
  }
};

const assertMaterialProfile = (
  order: XuanxueAiProductionOrder,
  profile: XuanxueAiProductionProfile,
): void => {
  const received = order.materials.map((material) => material.stageId);
  const expected = profile.stages.map((stage) => stage.stageId);
  if (
    received.length !== expected.length
    || received.some((stageId, index) => stageId !== expected[index])
    || new Set(received).size !== received.length
  ) {
    throw new Error(
      `XUANXUE_AI_PRODUCTION_PROFILE_MISMATCH:${order.productId}:`
      + `${expected.join(",")}:${received.join(",")}`,
    );
  }
};

const assertContinuationProfile = (
  order: XuanxueAiProductionOrder,
): void => {
  const continuationRequired =
    order.productId === "manual_accuracy_challenge"
    || isXuanxueAiRequiredContinuationProduct(order.productId);
  if (continuationRequired !== Boolean(order.conversationParent)) {
    throw new Error(
      "XUANXUE_AI_PRODUCTION_CONTINUATION_PROFILE_INVALID",
    );
  }
  if (
    isXuanxueAiRequiredContinuationProduct(order.productId)
    && order.productId !== "bazi_report_followup"
    && order.conversationParent?.stageId
      !== xuanxueAiRequiredContinuationProfiles[order.productId].stageId
  ) {
    throw new Error(
      "XUANXUE_AI_PRODUCTION_CONTINUATION_STAGE_INVALID",
    );
  }
  if (
    order.productId === "bazi_report_followup"
    && order.conversationParent
    && !["chart_interpretation", "question_analysis"].includes(
      order.conversationParent.stageId,
    )
  ) {
    throw new Error(
      "XUANXUE_AI_PRODUCTION_CONTINUATION_STAGE_INVALID",
    );
  }
  if (
    isXuanxueAiReusableBaseConsumerProduct(order.productId)
    && order.conversationParent?.relation !== "forked_from_checkpoint"
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_FORK_PARENT_REQUIRED");
  }
  if (
    isXuanxueAiPaidFollowupProduct(order.productId)
    && order.conversationParent?.relation !== "same_conversation"
  ) {
    throw new Error(
      "XUANXUE_AI_PRODUCTION_SAME_CONVERSATION_PARENT_REQUIRED",
    );
  }
};

const assertParticipantManifest = (
  order: XuanxueAiProductionOrder,
): void => {
  const participants = order.frozenSubject.participants;
  const people = new Set(participants.map((participant) => participant.personRef));
  if (people.size !== participants.length) {
    throw new Error("XUANXUE_AI_PRODUCTION_PARTICIPANT_PERSON_DUPLICATE");
  }
  if (
    order.frozenSubject.primaryPersonRef
    && !people.has(order.frozenSubject.primaryPersonRef)
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_PRIMARY_PERSON_NOT_FROZEN");
  }
};

const assertJoinBindings = (
  order: XuanxueAiProductionOrder,
): Set<string> => {
  const participants = order.frozenSubject.participants;
  const joinSlots = new Set<string>();
  const joinExecutions = new Set<string>();
  for (const parent of order.joinParents) {
    const participant = participants.find(
      (candidate) => candidate.slotRef === parent.participantSlotRef,
    );
    if (
      !participant
      || participant.roleCode !== parent.participantRoleCode
      || participant.personRef !== parent.personRef
      || joinSlots.has(parent.participantSlotRef)
      || joinExecutions.has(parent.executionId)
    ) {
      throw new Error("XUANXUE_AI_PRODUCTION_TYPED_JOIN_PARENT_MISMATCH");
    }
    joinSlots.add(parent.participantSlotRef);
    joinExecutions.add(parent.executionId);
  }
  return joinSlots;
};

const assertHehunJoins = (order: XuanxueAiProductionOrder): void => {
  const stageByRole = new Map([
    ["party_a", "party_a_interpretation"],
    ["party_b", "party_b_interpretation"],
  ] as const);
  if (
    order.frozenSubject.participants.length !== 2
    || order.joinParents.length !== 2
    || order.conversationParent !== null
    || order.frozenSubject.participants.some((participant) => !stageByRole.has(
      participant.roleCode as "party_a" | "party_b",
    ))
    || order.joinParents.some((parent) =>
      parent.stageId !== stageByRole.get(
        parent.participantRoleCode as "party_a" | "party_b",
      ))
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_HEHUN_THREE_CONTEXTS_REQUIRED");
  }
};

const assertNamingJoins = (
  order: XuanxueAiProductionOrder,
  joinSlots: Set<string>,
): void => {
  const target = order.frozenSubject.participants.filter(
    (participant) => participant.personRef === order.frozenSubject.primaryPersonRef,
  );
  const auxiliaries = order.frozenSubject.participants.filter(
    (participant) => participant.personRef !== order.frozenSubject.primaryPersonRef,
  );
  if (
    target.length !== 1
    || target[0]?.roleCode !== "naming_target"
    || auxiliaries.length !== order.joinParents.length
    || auxiliaries.some((participant) => !joinSlots.has(participant.slotRef))
    || order.joinParents.some((parent) => parent.stageId !== "base_interpretation")
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_NAMING_TYPED_JOINS_INVALID");
  }
};

const assertFrozenSubjectAndTypedJoin = (
  order: XuanxueAiProductionOrder,
): void => {
  assertParticipantManifest(order);
  const joinSlots = assertJoinBindings(order);
  if (order.productId === "hehun_ai_analysis") {
    assertHehunJoins(order);
    return;
  }
  if (order.productId === "naming_bazi_analysis_and_naming") {
    assertNamingJoins(order, joinSlots);
    return;
  }
  if (order.joinParents.length > 0) {
    throw new Error("XUANXUE_AI_PRODUCTION_TYPED_JOIN_NOT_ALLOWED");
  }
};

export const assertXuanxueAiOrderMatchesProfile = (
  order: XuanxueAiProductionOrder,
): XuanxueAiProductionProfile => {
  const profile = resolveXuanxueAiProductionProfile(order.productId);
  assertSingleConversationStageChain(profile);
  assertMaterialProfile(order, profile);
  assertSeededStages(
    order,
    profile.stages.map((stage) => stage.stageId),
  );
  assertContinuationProfile(order);
  assertFrozenSubjectAndTypedJoin(order);
  return profile;
};
