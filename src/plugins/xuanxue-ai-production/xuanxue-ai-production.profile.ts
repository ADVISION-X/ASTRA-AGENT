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
  readonly stages: readonly XuanxueAiStageDefinition[];
  readonly finalStageId: XuanxueAiStageId;
}

const singleStage = (
  productId: XuanxueAiProductId,
  stageId: XuanxueAiStageId,
): XuanxueAiProductionProfile => ({
  productId,
  stages: [{
    stageId,
    dependsOn: [],
    continuationFrom: null,
    generatedInputsFrom: [],
  }],
  finalStageId: stageId,
});

const profiles: Readonly<Record<
  XuanxueAiProductId,
  XuanxueAiProductionProfile
>> = {
  bazi_chart_interpretation: singleStage("bazi_chart_interpretation", "chart_interpretation"),
  bazi_ai_full_analysis: singleStage("bazi_ai_full_analysis", "question_analysis"),
  bazi_report_followup: singleStage("bazi_report_followup", "question_analysis"),
  qimen_professional_answer: singleStage("qimen_professional_answer", "analysis"),
  qimen_report_followup: singleStage("qimen_report_followup", "followup"),
  hehun_ai_analysis: singleStage("hehun_ai_analysis", "final_compatibility"),
  hehun_report_followup: singleStage("hehun_report_followup", "followup"),
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
  naming_from_existing_bazi_report: singleStage("naming_from_existing_bazi_report", "naming_author"),
  bazi_canonical_base_interpretation: singleStage("bazi_canonical_base_interpretation", "base_interpretation"),
  hehun_canonical_party_a_interpretation: singleStage("hehun_canonical_party_a_interpretation", "party_a_interpretation"),
  hehun_canonical_party_b_interpretation: singleStage("hehun_canonical_party_b_interpretation", "party_b_interpretation"),
  manual_accuracy_challenge: singleStage("manual_accuracy_challenge", "manual_accuracy_challenge"),
  payment_screenshot_observation: singleStage("payment_screenshot_observation", "payment_screenshot_observation"),
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
  localization_report_translation: singleStage(
    "localization_report_translation",
    "report_translation",
  ),
  localization_article_translation: singleStage(
    "localization_article_translation",
    "article_translation",
  ),
  localization_static_review_candidate: singleStage(
    "localization_static_review_candidate",
    "localization_candidate",
  ),
  localization_static_review_selector: singleStage(
    "localization_static_review_selector",
    "localization_selector",
  ),
  scheduled_quality_reflection: singleStage(
    "scheduled_quality_reflection",
    "scheduled_quality_reflection",
  ),
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
    if (index === 0 && stage.continuationFrom !== null) {
      throw new Error(
        `${CONVERSATION_CHAIN_INVALID}:`
        + `${profile.productId}:${stage.stageId}`,
      );
    }
    if (index > 0 && stage.continuationFrom !== null
      && stage.continuationFrom !== previous?.stageId) {
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
  const selectorSwap = order.localizationRole === "selector_swap";
  const continuationRequired =
    order.productId === "manual_accuracy_challenge"
    || isXuanxueAiRequiredContinuationProduct(order.productId)
    || selectorSwap;
  if (continuationRequired !== Boolean(order.conversationParent)) {
    throw new Error(
      "XUANXUE_AI_PRODUCTION_CONTINUATION_PROFILE_INVALID",
    );
  }
  assertContinuationStage(order, selectorSwap);
  assertContinuationRelation(order);
};

const assertContinuationStage = (
  order: XuanxueAiProductionOrder,
  selectorSwap: boolean,
): void => {
  if (
    selectorSwap
    && (
      order.productId !== "localization_static_review_selector"
      || order.conversationParent?.relation !== "same_conversation"
      || order.conversationParent?.stageId !== "localization_selector"
    )
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_LOCALIZATION_SELECTOR_PARENT_INVALID");
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
};

const assertContinuationRelation = (
  order: XuanxueAiProductionOrder,
): void => {
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
  const participantRoles = order.frozenSubject.participants.map(
    (participant) => participant.roleCode,
  );
  if (
    order.frozenSubject.participants.length !== 2
    || order.joinParents.length !== 2
    || order.conversationParent !== null
    || participantRoles.filter((role) => role === "party_a").length !== 1
    || participantRoles.filter((role) => role === "party_b").length !== 1
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
  if (
    order.productId === "naming_bazi_analysis_and_naming"
    || order.productId === "naming_from_existing_bazi_report"
  ) {
    assertNamingJoins(order, joinSlots);
    return;
  }
  if (order.joinParents.length > 0) {
    throw new Error("XUANXUE_AI_PRODUCTION_TYPED_JOIN_NOT_ALLOWED");
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
  const profile = resolveXuanxueAiProductionProfile(order.productId);
  assertSingleConversationStageChain(profile);
  assertMaterialProfile(order, profile);
  assertSeededStages(
    order,
    profile.stages.map((stage) => stage.stageId),
  );
  assertContinuationProfile(order);
  assertFrozenSubjectAndTypedJoin(order);
  assertLocalizationProfile(order);
  return profile;
};
