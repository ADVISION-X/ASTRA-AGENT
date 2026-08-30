import { createHash } from "node:crypto";

import {
  gptAttachmentProviderDisplayName,
  type GptProviderContinuation,
} from "../../capabilities/gpt/index.js";
import {
  hashCanonical,
  type ProductionHash,
  type WebsiteAgentTask,
} from "../../lib/local-runtime/production/contracts.js";
import {
  readProductSkill,
  type ProductGptTools,
  type SharedExecutionContext,
} from "../../lib/local-runtime/production/plugin.js";
import {
  executionFailure,
  failureCode,
  postCheckpointReceiverFault,
} from "../../lib/typed-failure.js";
import {
  parsePublicKnowledgeArticle,
  parsePublicKnowledgeResearch,
  publicKnowledgeReceptionOf,
  publicKnowledgeTurnContract,
  type PublicKnowledgeReceptionReceipt,
} from "./result-contract.js";

const skill = readProductSkill(import.meta.url);

export const PLUGIN_ID = "public-knowledge-article-pipeline";
export const productSkillHash = skill.hash;

export type SeoChild = ProductGptTools["execute"];
export type SeoCall = Parameters<SeoChild>[0];
export type SeoTurnCheckpoint = Readonly<{
  assistantTurnId: string;
  rawDomHtml: string;
  rawDomHash: ProductionHash;
  semanticText: string;
  semanticTextHash: ProductionHash;
  artifactRef: string;
  canonicalConversationUrl: string;
  promptHash: ProductionHash;
  turnMarker: string;
}>;
export type SeoUploadedAttachment = Readonly<Record<string, unknown>> & Readonly<{
  providerDisplayName: string;
}>;

export function fail(code: string): never { throw executionFailure("failed", code); }

export const objectValue = (value: unknown, code: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value as Record<string, unknown>;
};

export const textValue = (value: unknown, code: string): string => {
  if (typeof value !== "string" || !value.trim()) fail(code);
  return value;
};

export const hashValue = (value: unknown, code: string): ProductionHash => {
  if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(value)) fail(code);
  return value as ProductionHash;
};

const receptionReceipt = (
  task: WebsiteAgentTask,
  attemptId: string,
  checkpoint: SeoTurnCheckpoint,
): PublicKnowledgeReceptionReceipt => Object.freeze({
  jobId: task.job_id,
  attemptId,
  turnMarker: checkpoint.turnMarker,
  assistantTurnId: checkpoint.assistantTurnId,
  artifactRef: checkpoint.artifactRef,
  rawDomHash: checkpoint.rawDomHash,
  semanticTextHash: checkpoint.semanticTextHash,
});

export const receiveResearch = (
  task: WebsiteAgentTask,
  attemptId: string,
  checkpoint: SeoTurnCheckpoint,
): Readonly<Record<string, unknown>> => {
  try {
    return parsePublicKnowledgeResearch(
      checkpoint.semanticText, receptionReceipt(task, attemptId, checkpoint),
    );
  } catch (error) {
    throw postCheckpointReceiverFault(failureCode(error, "PUBLIC_KNOWLEDGE_RESEARCH_RECEIVER_FAILED"), {
      artifactRef: checkpoint.artifactRef,
      rawDomHash: checkpoint.rawDomHash,
      semanticTextHash: checkpoint.semanticTextHash,
    });
  }
};

export const receiveArticle = (
  task: WebsiteAgentTask,
  attemptId: string,
  checkpoint: SeoTurnCheckpoint,
): Readonly<Record<string, unknown>> => {
  try {
    return parsePublicKnowledgeArticle(
      checkpoint.semanticText, receptionReceipt(task, attemptId, checkpoint),
    );
  } catch (error) {
    throw postCheckpointReceiverFault(failureCode(error, "PUBLIC_KNOWLEDGE_ARTICLE_RECEIVER_FAILED"), {
      artifactRef: checkpoint.artifactRef,
      rawDomHash: checkpoint.rawDomHash,
      semanticTextHash: checkpoint.semanticTextHash,
    });
  }
};

export const receptionSidecar = (
  research: Readonly<Record<string, unknown>>,
  article: Readonly<Record<string, unknown>> | null,
) => Object.freeze({
  schema_version: "agent-public-knowledge-reception.v1",
  research: publicKnowledgeReceptionOf(research),
  article: article ? publicKnowledgeReceptionOf(article) : null,
});

export const textHash = (value: string): ProductionHash =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const turnMarker = (task: WebsiteAgentTask, attemptId: string, stepId: string): string =>
  `[GRASSEYE:${hashCanonical({ job_id: task.job_id, attempt_id: attemptId, product_step_id: stepId }).slice(7, 31)}]`;

const promptEnvelope = (task: WebsiteAgentTask, marker: string, instruction: string): string => [
  skill.text,
  "",
  `当前授权动作：${task.action_id}`,
  `当前业务事实：${JSON.stringify(task.action_id === "produce_article"
    ? { domain_id: task.parameters.domain_id, locale: task.parameters.locale }
    : { review_action: task.action_id })}`,
  instruction,
  `把此不可变标记原样保留在本次用户消息中，不要写入 JSON 结果：${marker}`,
].join("\n");

export const researchPrompt = (
  task: WebsiteAgentTask,
  marker: string,
  providerDisplayNames: readonly string[],
): string => promptEnvelope(task, marker, [
  `读取且只读取本轮两个附件：${providerDisplayNames.join(" 与 ")}。`,
  "从冻结 READY 语料与现役文章目录中研究一个可公开、可引用、可核验、且不存在实质重复的问题。",
  "材料不足或没有实质新意时必须 decision=decline；否则 decision=proceed。",
  `当前回合唯一输出子合同：${JSON.stringify(publicKnowledgeTurnContract("research"))}`,
  "严格返回当前 research 子合同的全部且仅有字段；本回合不得返回 article package。",
  "只返回严格 JSON 对象，不要代码围栏，不要解释性前后缀。",
].join("\n"));

export const articlePrompt = (task: WebsiteAgentTask, marker: string): string =>
  promptEnvelope(task, marker, [
    "仅依据本 conversation 已 checkpoint 的 public-knowledge-research-output.v3 研究结论写成文章。",
    "不得重新选题、不得引入未在研究中出现的来源或主张；引用 identity 与顺序必须保持一致。",
    `当前回合唯一输出子合同：${JSON.stringify(publicKnowledgeTurnContract("article"))}`,
    "严格返回当前 article 子合同的全部且仅有字段。",
    "只返回严格 JSON 对象，不要代码围栏，不要解释性前后缀。",
  ].join("\n"));

export const imagePrompt = (task: WebsiteAgentTask, marker: string): string =>
  promptEnvelope(task, marker, [
    "仅依据本 conversation 已完成的研究和文章，生成一张横向文章主图。",
    "本轮唯一业务输出是一张可下载的生成图片。",
  ].join("\n"));

export const reviewPrompt = (
  task: WebsiteAgentTask,
  marker: string,
  providerDisplayNames: readonly string[],
): string => promptEnvelope(task, marker, [
  `读取且只读取本轮两个附件：${providerDisplayNames.join(" 与 ")}。`,
  task.action_id === "accuracy_challenge"
    ? "只检查公开性、来源、主张、引文与事实准确性；不得改写文章或替 Website 裁决。"
    : "只检查独立性、表达、读者价值、合同摩擦与质量风险；不得改写文章或替 Website 裁决。",
  "严格返回 website-agent-review-output.v1：仅含 decision 与 issues；decision 只能是 no_issue 或 issues。",
  "只返回严格 JSON 对象，不要代码围栏，不要解释性前后缀。",
].join("\n"));

export const attachmentFiles = (context: SharedExecutionContext) => context.materials
  .slice().sort((left, right) => left.ordinal - right.ordinal).map((material) => Object.freeze({
    artifactRef: material.material_id,
    filePath: material.local_path,
    displayName: material.display_name,
    sha256: material.sha256,
    bytes: material.bytes,
  }));

export const providerDisplayNames = (
  files: readonly Readonly<Record<string, unknown>>[],
  attemptId: string,
): readonly string[] => files.map((file) => gptAttachmentProviderDisplayName(
  textValue(file.displayName, "SEO_ATTACHMENT_DISPLAY_NAME_INVALID"),
  attemptId,
  textValue(file.artifactRef, "SEO_ATTACHMENT_ARTIFACT_REF_INVALID"),
));

export const expectedUploadedFiles = (
  files: readonly Readonly<Record<string, unknown>>[],
  attemptId: string,
): readonly SeoUploadedAttachment[] => files.map((file) => Object.freeze({
  artifactRef: textValue(file.artifactRef, "SEO_ATTACHMENT_ARTIFACT_REF_INVALID"),
  displayName: textValue(file.displayName, "SEO_ATTACHMENT_DISPLAY_NAME_INVALID"),
  providerDisplayName: gptAttachmentProviderDisplayName(
    textValue(file.displayName, "SEO_ATTACHMENT_DISPLAY_NAME_INVALID"),
    attemptId,
    textValue(file.artifactRef, "SEO_ATTACHMENT_ARTIFACT_REF_INVALID"),
  ),
  sha256: hashValue(file.sha256, "SEO_ATTACHMENT_HASH_INVALID"),
  bytes: file.bytes,
}));

export const continuationProvider = (
  task: WebsiteAgentTask,
  checkpoint: SeoTurnCheckpoint,
): GptProviderContinuation => Object.freeze({
  provider_page_url: checkpoint.canonicalConversationUrl,
  prior_task_id: task.job_id,
  prior_prompt_hash: checkpoint.promptHash,
  prior_raw_output_hash: checkpoint.semanticTextHash,
  prior_turn_marker: checkpoint.turnMarker,
});
