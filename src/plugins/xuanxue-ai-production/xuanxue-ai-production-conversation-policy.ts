import type {
  XuanxueAiProductId,
  XuanxueAiStageId,
} from "./xuanxue-ai-production.schema.js";

export const xuanxueAiPaidFollowupProfiles = {
  bazi_report_followup: {
    productId: "bazi_ai_full_analysis",
    stageId: "question_analysis",
  },
  qimen_report_followup: {
    productId: "qimen_professional_answer",
    stageId: "analysis",
  },
  hehun_report_followup: {
    productId: "hehun_ai_analysis",
    stageId: "final_compatibility",
  },
} as const;

export const xuanxueAiReusableBaseConsumerProfiles = {
  bazi_chart_interpretation: {
    productId: "bazi_canonical_base_interpretation",
    stageId: "base_interpretation",
  },
  bazi_ai_full_analysis: {
    productId: "bazi_canonical_base_interpretation",
    stageId: "base_interpretation",
  },
  naming_bazi_analysis_and_naming: {
    productId: "bazi_canonical_base_interpretation",
    stageId: "base_interpretation",
  },
} as const;

export const xuanxueAiRequiredContinuationProfiles = {
  ...xuanxueAiPaidFollowupProfiles,
  ...xuanxueAiReusableBaseConsumerProfiles,
} as const;

export type XuanxueAiPaidFollowupProductId = keyof typeof xuanxueAiPaidFollowupProfiles;
export type XuanxueAiRequiredContinuationProductId = keyof typeof xuanxueAiRequiredContinuationProfiles;
export type XuanxueAiReusableBaseConsumerProductId = keyof typeof xuanxueAiReusableBaseConsumerProfiles;

export const isXuanxueAiPaidFollowupProduct = (
  productId: XuanxueAiProductId,
): productId is XuanxueAiPaidFollowupProductId => Object.hasOwn(xuanxueAiPaidFollowupProfiles, productId);

export const isXuanxueAiRequiredContinuationProduct = (
  productId: XuanxueAiProductId,
): productId is XuanxueAiRequiredContinuationProductId => Object.hasOwn(xuanxueAiRequiredContinuationProfiles, productId);

export const isXuanxueAiReusableBaseConsumerProduct = (
  productId: XuanxueAiProductId,
): productId is XuanxueAiReusableBaseConsumerProductId => Object.hasOwn(xuanxueAiReusableBaseConsumerProfiles, productId);

type ConversationParentInput = {
  childProductId: XuanxueAiProductId;
  parentProductId: XuanxueAiProductId;
  parentStageId: XuanxueAiStageId;
};

const isAllowedBaziConversationParent = (
  input: ConversationParentInput,
): boolean =>
  (input.parentProductId === "bazi_chart_interpretation" &&
    input.parentStageId === "chart_interpretation") ||
  (input.parentProductId === "bazi_ai_full_analysis" &&
    input.parentStageId === "question_analysis") ||
  (input.parentProductId === "bazi_report_followup" &&
    input.parentStageId === "question_analysis");

const isAllowedQimenConversationParent = (
  input: ConversationParentInput,
): boolean =>
  (input.parentProductId === "qimen_professional_answer" &&
    input.parentStageId === "analysis") ||
  (input.parentProductId === "qimen_report_followup" &&
    input.parentStageId === "followup");

const isAllowedHehunConversationParent = (
  input: ConversationParentInput,
): boolean =>
  (input.parentProductId === "hehun_ai_analysis" &&
    input.parentStageId === "final_compatibility") ||
  (input.parentProductId === "hehun_report_followup" &&
    input.parentStageId === "followup");

export const isAllowedXuanxueConversationParent = (
  input: ConversationParentInput,
): boolean => {
  if (input.childProductId === "bazi_report_followup")
    return isAllowedBaziConversationParent(input);
  if (input.childProductId === "qimen_report_followup")
    return isAllowedQimenConversationParent(input);
  if (input.childProductId === "hehun_report_followup")
    return isAllowedHehunConversationParent(input);
  const expected = xuanxueAiRequiredContinuationProfiles[
    input.childProductId as XuanxueAiRequiredContinuationProductId
  ];
  return Boolean(
    expected
    && expected.productId === input.parentProductId
    && expected.stageId === input.parentStageId,
  );
};
