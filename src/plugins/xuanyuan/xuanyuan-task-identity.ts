import type { AiTaskLabelKey } from "../../capabilities/ai-input-gateway/index.js";

const TASK_LABELS: Record<AiTaskLabelKey, string> = {
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

const SCENARIO_LABEL_RULES: ReadonlyArray<{
  fragments: readonly string[];
  labelKey: AiTaskLabelKey;
}> = [
  { fragments: ["public_knowledge", "research"], labelKey: "seo_research" },
  { fragments: ["public_knowledge"], labelKey: "seo_article" },
  { fragments: ["hehun"], labelKey: "hehun_analysis" },
  { fragments: ["bazi"], labelKey: "bazi_analysis" },
  { fragments: ["qimen"], labelKey: "qimen_analysis" },
  { fragments: ["naming"], labelKey: "naming_analysis" },
  { fragments: ["deep_research"], labelKey: "deep_research" },
  { fragments: ["full_corpus"], labelKey: "full_corpus_analysis" },
  { fragments: ["acceptance"], labelKey: "system_acceptance" },
];

export const resolveXuanyuanTaskLabelKey = (scenario: string): AiTaskLabelKey => {
  const normalized = scenario.toLowerCase().replaceAll("-", "_");
  return SCENARIO_LABEL_RULES.find(({ fragments }) =>
    fragments.every((fragment) => normalized.includes(fragment)))?.labelKey
    ?? "generic_ai";
};

export const buildXuanyuanTaskName = (
  labelKey: AiTaskLabelKey,
  taskId: string,
): string => `${TASK_LABELS[labelKey]}｜${taskId.slice(-8).toUpperCase()}`;
