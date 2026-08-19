import { z } from "zod";

import {
  isXuanxueAiPaidFollowupProduct,
  isXuanxueAiRequiredContinuationProduct,
  isXuanxueAiReusableBaseConsumerProduct,
  xuanxueAiRequiredContinuationProfiles,
} from "./xuanxue-ai-production-conversation-policy.js";
import {
  assertXuanxueLocalizationContract,
  isXuanxueLocalizationProduct,
} from "./xuanxue-ai-production-localization-contract.js";
import type { XuanxueAiStoredOrder } from "./xuanxue-ai-production.schema.js";

const issue = (
  context: z.RefinementCtx,
  message: string,
  path: Array<string | number>,
): void => context.addIssue({ code: z.ZodIssueCode.custom, message, path });

const inspectContinuationStage = (
  order: XuanxueAiStoredOrder,
  context: z.RefinementCtx,
  selectorSwap: boolean,
): void => {
  if (selectorSwap && (
    order.productId !== "localization_static_review_selector"
    || order.conversationParent?.relation !== "same_conversation"
    || order.conversationParent?.stageId !== "localization_selector"
  )) {
    issue(context, "XUANXUE_AI_PRODUCTION_LOCALIZATION_SELECTOR_PARENT_INVALID", ["conversationParent"]);
  }
  if (
    isXuanxueAiRequiredContinuationProduct(order.productId)
    && order.productId !== "bazi_report_followup"
    && order.conversationParent?.stageId
      !== xuanxueAiRequiredContinuationProfiles[order.productId].stageId
  ) {
    issue(context, "XUANXUE_AI_PRODUCTION_CONTINUATION_STAGE_INVALID", ["conversationParent", "stageId"]);
  }
  if (
    order.productId === "bazi_report_followup"
    && order.conversationParent
    && !["chart_interpretation", "question_analysis"].includes(order.conversationParent.stageId)
  ) {
    issue(context, "XUANXUE_AI_PRODUCTION_CONTINUATION_STAGE_INVALID", ["conversationParent", "stageId"]);
  }
};

const inspectContinuationRelation = (
  order: XuanxueAiStoredOrder,
  context: z.RefinementCtx,
): void => {
  if (
    isXuanxueAiReusableBaseConsumerProduct(order.productId)
    && order.conversationParent?.relation !== "forked_from_checkpoint"
  ) {
    issue(context, "XUANXUE_AI_PRODUCTION_FORK_PARENT_REQUIRED", ["conversationParent", "relation"]);
  }
  if (
    isXuanxueAiPaidFollowupProduct(order.productId)
    && order.conversationParent?.relation !== "same_conversation"
  ) {
    issue(context, "XUANXUE_AI_PRODUCTION_SAME_CONVERSATION_PARENT_REQUIRED", ["conversationParent", "relation"]);
  }
};

export const inspectXuanxueContinuationPolicy = (
  order: XuanxueAiStoredOrder,
  context: z.RefinementCtx,
): void => {
  const selectorSwap = order.localizationRole === "selector_swap";
  const continuationRequired = order.productId === "manual_accuracy_challenge"
    || isXuanxueAiRequiredContinuationProduct(order.productId)
    || selectorSwap;
  if (continuationRequired !== Boolean(order.conversationParent)) {
    issue(context, "XUANXUE_AI_PRODUCTION_CONTINUATION_PROFILE_INVALID", ["conversationParent"]);
  }
  inspectContinuationStage(order, context, selectorSwap);
  inspectContinuationRelation(order, context);
};

const inspectNonLocalizationPolicy = (
  order: XuanxueAiStoredOrder,
  context: z.RefinementCtx,
): void => {
  if (
    order.contractManifestHash !== null
    || order.productContractHash !== null
    || order.localizationRole !== null
    || order.providerExecutionProfile !== null
  ) {
    issue(context, "XUANXUE_AI_PRODUCTION_LOCALIZATION_IDENTITY_FORBIDDEN", ["localizationRole"]);
  }
  if (order.frozenSubject.participants.length === 0) {
    issue(context, "XUANXUE_AI_PRODUCTION_FROZEN_SUBJECT_PARTICIPANT_REQUIRED", ["frozenSubject", "participants"]);
  }
};

const inspectLocalizationContract = (
  order: XuanxueAiStoredOrder,
  context: z.RefinementCtx,
): void => {
  try {
    assertXuanxueLocalizationContract({
      productId: order.productId,
      stageId: order.materials[0]?.stageId ?? "",
      triggerKind: order.triggerKind,
      contractManifestHash: order.contractManifestHash,
      productContractHash: order.productContractHash,
      role: order.localizationRole,
      providerProfile: order.providerExecutionProfile,
      inputKinds: order.materials[0]?.inputRefs.map((item) => item.kind) ?? [],
      hasConversationParent: Boolean(order.conversationParent),
    });
  } catch (error) {
    issue(
      context,
      error instanceof Error ? error.message : "XUANXUE_AI_PRODUCTION_LOCALIZATION_CONTRACT_INVALID",
      ["localizationRole"],
    );
  }
};

const inspectLocalizationTopology = (
  order: XuanxueAiStoredOrder,
  context: z.RefinementCtx,
): void => {
  if (
    order.serviceClass !== "localization"
    || order.materials.length !== 1
    || order.joinParents.length !== 0
  ) {
    issue(context, "XUANXUE_AI_PRODUCTION_LOCALIZATION_SINGLE_STAGE_INVALID", ["materials"]);
  }
  const staticReview = order.productId === "localization_static_review_candidate"
    || order.productId === "localization_static_review_selector";
  const staticSubjectInvalid = staticReview && (
    order.triggerKind !== "terminal_localization"
    || order.frozenSubject.privacyOwnerRef !== "localization-catalog"
    || order.frozenSubject.primaryPersonRef !== null
    || order.frozenSubject.participants.length !== 0
  );
  if (staticSubjectInvalid) {
    issue(context, "XUANXUE_AI_PRODUCTION_LOCALIZATION_STATIC_SUBJECT_INVALID", ["frozenSubject"]);
  }
};

const inspectTranslationSubject = (
  order: XuanxueAiStoredOrder,
  context: z.RefinementCtx,
): void => {
  const translation = order.productId === "localization_report_translation"
    || order.productId === "localization_article_translation";
  if (translation && order.triggerKind !== "terminal_localization") {
    issue(context, "XUANXUE_AI_PRODUCTION_TERMINAL_LOCALIZATION_TRIGGER_INVALID", ["triggerKind"]);
  }
  const articleSubjectInvalid = order.productId === "localization_article_translation" && (
    order.frozenSubject.privacyOwnerRef !== "public-knowledge-content"
    || order.frozenSubject.primaryPersonRef !== null
    || order.frozenSubject.participants.length !== 0
  );
  if (articleSubjectInvalid) {
    issue(context, "XUANXUE_AI_PRODUCTION_ARTICLE_LOCALIZATION_SUBJECT_INVALID", ["frozenSubject"]);
  }
};

export const inspectXuanxueLocalizationPolicy = (
  order: XuanxueAiStoredOrder,
  context: z.RefinementCtx,
): void => {
  if (!isXuanxueLocalizationProduct(order.productId)) {
    inspectNonLocalizationPolicy(order, context);
    return;
  }
  inspectLocalizationContract(order, context);
  inspectLocalizationTopology(order, context);
  inspectTranslationSubject(order, context);
};
