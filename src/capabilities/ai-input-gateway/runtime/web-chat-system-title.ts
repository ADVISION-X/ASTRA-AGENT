import { createHash } from "node:crypto";

const SYSTEM_CHAT_TITLE_LABELS = [
  { includes: "public-knowledge", label: "SEO文章" },
  { includes: "hehun", label: "合婚分析" },
  { includes: "bazi", label: "八字分析" },
  { includes: "qimen", label: "奇门分析" },
  { includes: "naming", label: "起名分析" },
  { includes: "deep-research", label: "深度研究" },
  { includes: "amazon-product-mining", label: "亚马逊选品" },
  { includes: "facebook-product-video-mining", label: "视频选品" },
  { includes: "pick3", label: "Pick3分析" },
  { includes: "full-corpus", label: "全书分析" },
  { includes: "acceptance", label: "系统验收" },
] as const;

const resolveSystemChatTitleLabel = (promptContractId: string): string => {
  const normalizedContractId = promptContractId.toLowerCase();
  return SYSTEM_CHAT_TITLE_LABELS.find(({ includes }) =>
    normalizedContractId.includes(includes)
  )?.label ?? "AI任务";
};

const compactUtcTime = (createdAt: string): string => {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("review_required: system chat title requires a valid creation time.");
  }
  return `${parsed.toISOString().slice(5, 10)} ${parsed.toISOString().slice(11, 16)}Z`;
};

export const buildHumanReadableSystemChatTitle = (input: {
  promptContractId: string;
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
    resolveSystemChatTitleLabel(input.promptContractId),
    compactUtcTime(input.createdAt),
    `${executionTrace}-${markerTrace}`,
  ].join("｜");
};
