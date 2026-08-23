import { createHash } from "node:crypto";

import type {
  WebChatConversationTitleProof,
  WebChatConversationTitleState,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

export const GPT_WEB_TITLE_POLICY_VERSION = "gpt-web-title-policy.v1" as const;
export const GPT_WEB_TITLE_MAPPING_VERSION = "gpt-web-title-mapping.v1" as const;
export const GPT_WEB_OPERATOR_TIME_ZONE = "Asia/Dubai" as const;

const titleHash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const domainLabel: Readonly<Record<AiFeedInput["taskIdentity"]["labelKey"], string>> = {
  seo_research: "内容研究",
  seo_article: "知识文章",
  hehun_analysis: "合婚",
  bazi_analysis: "八字",
  qimen_analysis: "奇门",
  naming_analysis: "起名",
  full_corpus_analysis: "全书",
  system_acceptance: "系统",
  generic_ai: "AI",
};

const roleMappings = [
  [/bazi.*(?:chart|base|interpretation)/iu, "命盘解读"],
  [/bazi.*followup/iu, "命盘追问"],
  [/qimen.*followup/iu, "问事追问"],
  [/qimen/iu, "问事分析"],
  [/hehun.*followup/iu, "合婚追问"],
  [/hehun/iu, "终局合盘"],
  [/naming/iu, "起名终稿"],
  [/localization.*(?:review|selector|candidate)/iu, "静态复核"],
  [/localization/iu, "本地化"],
  [/deep.*research/iu, "研究任务"],
  [/public.*knowledge|seo/iu, "知识生产"],
  [/acceptance|system/iu, "验收审计"],
] as const;

const roleLabel = (taskKind: string): string =>
  roleMappings.find(([pattern]) => pattern.test(taskKind))?.[1] ?? "AI任务";

const compactDubaiTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("AI_INPUT_GATEWAY_TITLE_CREATION_TIME_INVALID");
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: GPT_WEB_OPERATOR_TIME_ZONE,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("month")}${get("day")}-${get("hour")}${get("minute")}`;
};

const TRACE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const shortTrace = (executionId: string): string => {
  const hex = createHash("sha256").update(executionId).digest("hex");
  return Array.from({ length: 6 }, (_, index) => {
    const value = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    return TRACE_ALPHABET[value % TRACE_ALPHABET.length]!;
  }).join("");
};

export const buildExpectedConversationTitle = (input: {
  request: AiFeedInput;
  executionId: string;
  createdAt: string;
}): { title: string; shortTrace: string } => {
  const trace = shortTrace(input.executionId);
  const title = [
    `玄学·${domainLabel[input.request.taskIdentity.labelKey]}`,
    roleLabel(input.request.taskIdentity.taskKind),
    compactDubaiTime(input.createdAt),
    trace,
  ].join("｜");
  if (title.length > 80) {
    throw new Error("AI_INPUT_GATEWAY_TITLE_POLICY_OUTPUT_TOO_LONG");
  }
  return { title, shortTrace: trace };
};

export const buildConversationTitleState = (input: {
  request: AiFeedInput;
  executionId: string;
  createdAt: string;
}): WebChatConversationTitleState | null => {
  if (input.request.providerKind !== "gpt-web-chat"
    || !input.request.providerExecutionProfile) return null;
  const inherited = input.request.providerContinuationRef?.priorConversationTitleProof;
  if (input.request.providerContinuationRef && !inherited) return null;
  const expected = inherited?.expectedTitle
    ? { title: inherited.expectedTitle, shortTrace: inherited.shortTrace }
    : buildExpectedConversationTitle(input);
  const expectedTitleHash = titleHash(expected.title);
  if (inherited && inherited.expectedTitleHash !== expectedTitleHash) {
    throw new Error("AI_INPUT_GATEWAY_CONTINUATION_TITLE_HASH_MISMATCH");
  }
  return {
    owner: "agent_authoritative",
    policyVersion: GPT_WEB_TITLE_POLICY_VERSION,
    sourceMappingVersion: GPT_WEB_TITLE_MAPPING_VERSION,
    operatorTimeZone: GPT_WEB_OPERATOR_TIME_ZONE,
    expectedTitle: expected.title,
    expectedTitleHash,
    shortTrace: expected.shortTrace,
    status: "pending",
    previousObservedTitle: null,
    observedTitle: null,
    canonicalConversationUrl: inherited?.canonicalConversationUrl ?? null,
    attemptCount: 0,
    verifiedAt: null,
    evidenceRef: null,
    evidenceHash: null,
  };
};

export const titleProofFromState = (
  state: WebChatConversationTitleState | null,
): WebChatConversationTitleProof | null => {
  if (!state || state.status !== "verified" || !state.verifiedAt
    || !state.evidenceRef || !state.evidenceHash || !state.canonicalConversationUrl
    || !state.observedTitle) return null;
  return {
    proofStatus: "verified",
    owner: state.owner,
    policyVersion: state.policyVersion,
    sourceMappingVersion: state.sourceMappingVersion,
    operatorTimeZone: state.operatorTimeZone,
    expectedTitle: state.expectedTitle,
    expectedTitleHash: state.expectedTitleHash,
    shortTrace: state.shortTrace,
    previousObservedTitle: state.previousObservedTitle,
    observedTitle: state.observedTitle,
    canonicalConversationUrl: state.canonicalConversationUrl,
    verifiedAt: state.verifiedAt,
    evidenceRef: state.evidenceRef,
    evidenceHash: state.evidenceHash,
  };
};
