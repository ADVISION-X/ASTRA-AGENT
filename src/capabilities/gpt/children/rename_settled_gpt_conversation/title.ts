import { executionFailure } from "../../../../lib/execution-failure.js";

const PROJECT_TITLES = Object.freeze({
  bazi_ai_full_analysis: "八字分析",
  bazi_chart_interpretation: "八字解盘",
  bazi_report_followup: "八字追问",
  hehun_ai_analysis: "合婚分析",
  hehun_report_followup: "合婚追问",
  localization_article_translation: "本地化文章",
  localization_report_translation: "本地化报告",
  localization_static_catalog: "本地化文案",
  naming_bazi_analysis_and_naming: "八字取名",
  naming_from_existing_bazi_report: "报告取名",
  payment_screenshot_observation: "支付核验",
  public_knowledge_article_pipeline: "公知文章",
  qimen_professional_answer: "奇门答问",
  qimen_report_followup: "奇门追问",
} as const);

export type RenameProjectId = keyof typeof PROJECT_TITLES;
export const RENAME_PROJECT_TITLES: Readonly<Record<RenameProjectId, string>> = PROJECT_TITLES;

const jobUuid = (jobId: string): string => {
  const match = /^aiprod_([0-9a-f]{8})-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.exec(jobId);
  if (!match) throw executionFailure("failed", "GPT_SETTLED_RENAME_JOB_ID_INVALID");
  return match[1]!.toLocaleLowerCase("en-US");
};

const dubaiMonthDay = (terminalAt: string): string => {
  const date = new Date(terminalAt);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== terminalAt) {
    throw executionFailure("failed", "GPT_SETTLED_RENAME_TERMINAL_AT_INVALID");
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "2-digit", day: "2-digit", timeZone: "Asia/Dubai",
  }).formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!month || !day) throw executionFailure("failed", "GPT_SETTLED_RENAME_TERMINAL_AT_INVALID");
  return `${month}${day}`;
};

export const settledGptConversationTitle = (input: Readonly<{
  jobId: string;
  productId: string;
  terminalAt: string;
}>): string => {
  const project = PROJECT_TITLES[input.productId as RenameProjectId];
  if (!project) throw executionFailure("failed", "GPT_SETTLED_RENAME_PRODUCT_ID_INVALID");
  const title = `${dubaiMonthDay(input.terminalAt)}·${project}·aiprod_${jobUuid(input.jobId)}`.normalize("NFC");
  if ([...title].length > 128 || /[\u0000-\u001f\u007f]/u.test(title)) {
    throw executionFailure("failed", "GPT_SETTLED_RENAME_TITLE_INVALID");
  }
  return title;
};
