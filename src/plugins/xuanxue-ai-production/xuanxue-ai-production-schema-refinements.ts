import { z } from "zod";

import {
  assertXuanxueLocalizationContract,
  isXuanxueLocalizationProduct,
} from "./xuanxue-ai-production-localization-contract.js";
import {
  assertXuanxueProductContractHash,
  xuanxueLocalOrderNode,
} from "./xuanxue-ai-production-product-contracts.js";
import {
  isXuanxueTerminalMetaphysicsProduct,
  isXuanxueTerminalMetaphysicsProfile,
} from "./xuanxue-ai-production-terminal-profile.js";
import type { XuanxueAiStoredOrder } from "./xuanxue-ai-production.schema.js";

const issue = (
  context: z.RefinementCtx,
  message: string,
  path: Array<string | number>,
): void => context.addIssue({ code: z.ZodIssueCode.custom, message, path });

export const inspectXuanxueContinuationPolicy = (
  order: XuanxueAiStoredOrder,
  context: z.RefinementCtx,
): void => {
  try {
    const node = xuanxueLocalOrderNode(
      order.productId,
      order.materials.map((material) => material.stageId),
    );
    const first = node.order_contract.stages
      .slice()
      .sort((left, right) => left.ordinal - right.ordinal)[0]!;
    const relation = first.conversation_mode === "fork"
      ? "forked_from_checkpoint"
      : first.conversation_mode === "continue_exact"
        ? "same_conversation"
        : null;
    if (Boolean(relation) !== Boolean(order.conversationParent)
      || (relation && order.conversationParent?.relation !== relation)) {
      issue(context, "XUANXUE_AI_PRODUCTION_CONTINUATION_PROFILE_INVALID", ["conversationParent"]);
    }
    assertXuanxueProductContractHash(order.productId, order.productContractHash);
  } catch (error) {
    issue(
      context,
      error instanceof Error ? error.message : "XUANXUE_PRODUCT_EXECUTION_LOCAL_ORDER_INVALID",
      ["materials"],
    );
  }
};

const exactTerminalProfile = (
  order: XuanxueAiStoredOrder,
  context: z.RefinementCtx,
): void => {
  const profile = order.providerExecutionProfile as Record<string, unknown> | null;
  if (!profile) {
    issue(context, "XUANXUE_AI_PRODUCTION_GPT_5_6_SOL_PROFILE_REQUIRED", ["providerExecutionProfile"]);
    return;
  }
  if (!isXuanxueTerminalMetaphysicsProfile(profile)) {
    issue(context, "XUANXUE_AI_PRODUCTION_GPT_5_6_SOL_PROFILE_MISMATCH", ["providerExecutionProfile"]);
  }
};

const inspectNonLocalizationPolicy = (
  order: XuanxueAiStoredOrder,
  context: z.RefinementCtx,
): void => {
  if (
    order.contractManifestHash !== null
    || order.localizationRole !== null
  ) {
    issue(context, "XUANXUE_AI_PRODUCTION_LOCALIZATION_IDENTITY_FORBIDDEN", ["localizationRole"]);
  }
  if (isXuanxueTerminalMetaphysicsProduct(order.productId)) {
    exactTerminalProfile(order, context);
  } else if (order.providerExecutionProfile !== null) {
    issue(context, "XUANXUE_AI_PRODUCTION_UNDECLARED_PROVIDER_PROFILE_FORBIDDEN", ["providerExecutionProfile"]);
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
      providerProfile: order.providerExecutionProfile as never,
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
    order.triggerKind !== "localization_static_review"
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
