import { createHash } from "node:crypto";

import type { AiTaskLabelKey } from "../schema.js";

const SYSTEM_CHAT_TITLE_LABELS: Record<AiTaskLabelKey, string> = {
  seo_research: "SEO资料研究",
  seo_article: "SEO文章生成",
  hehun_analysis: "合婚分析",
  bazi_analysis: "八字分析",
  qimen_analysis: "奇门分析",
  naming_analysis: "起名分析",
  deep_research: "深度研究",
  amazon_product_mining: "亚马逊选品",
  facebook_video_mining: "视频选品",
  pick3_analysis: "Pick3分析",
  full_corpus_analysis: "全书分析",
  system_acceptance: "系统验收",
  generic_ai: "AI任务",
};

export const resolveAiTaskLabel = (labelKey: AiTaskLabelKey): string =>
  SYSTEM_CHAT_TITLE_LABELS[labelKey];

const compactUtcTime = (createdAt: string): string => {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("review_required: system chat title requires a valid creation time.");
  }
  return `${parsed.toISOString().slice(5, 10)} ${parsed.toISOString().slice(11, 16)}Z`;
};

export const buildHumanReadableSystemChatTitle = (input: {
  labelKey: AiTaskLabelKey;
  executionId: string;
  turnMarker: string;
  createdAt: string;
}): string => {
  const executionTrace = createHash("sha256")
    .update(input.executionId)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
  const markerTrace = input.turnMarker.slice(-4).toUpperCase();
  return [
    resolveAiTaskLabel(input.labelKey),
    compactUtcTime(input.createdAt),
    `${executionTrace}-${markerTrace}`,
  ].join("｜");
};
