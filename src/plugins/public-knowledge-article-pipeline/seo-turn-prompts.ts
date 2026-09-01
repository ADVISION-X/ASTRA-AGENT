import { gptAttachmentProviderDisplayName } from "../../capabilities/gpt/index.js";
import type { WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import {
  readProductSkill,
  type SharedExecutionContext,
} from "../../lib/local-runtime/production/plugin.js";
import { publicKnowledgeTurnContract } from "./result-contract.js";
import { fail, hashValue, textValue, type SeoUploadedAttachment } from "./seo-turn-contract.js";

const skill = readProductSkill(import.meta.url);
export const productSkillHash = skill.hash;

const promptEnvelope = (
  task: WebsiteAgentTask,
  marker: string,
  instruction: string,
  includeCommonKernel: boolean,
): string => [
  ...(includeCommonKernel ? [skill.text, ""] : []),
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
  providerNames: readonly string[],
): string => {
  if (providerNames.length !== 1 || !providerNames[0]) fail("SEO_READY_CORPUS_ARCHIVE_SET_INVALID");
  return promptEnvelope(task, marker, [
    `解压并读取本轮唯一 ZIP 附件：${providerNames[0]}。`,
    "读取 ZIP 内全部资料文件：每本古籍独立目录中的原文.md 与索引.json 必须按同一书籍目录配对，现役文章目录与主题聚类 JSON 也必须读取；不得遗漏任何文件。",
    "ZIP 只包含资料；当前回合的唯一输出要求以本 Prompt 中的 research 子合同为准。",
    "从冻结 READY 语料与现役文章目录中研究一个可公开、可引用、可核验、且不存在实质重复的问题。",
    "材料不足或没有实质新意时必须 decision=decline；否则 decision=proceed。",
    `当前回合唯一输出子合同：${JSON.stringify(publicKnowledgeTurnContract("research"))}`,
    "严格返回当前 research 子合同的全部且仅有字段；本回合不得返回 article package。",
    "只返回严格 JSON 对象，不要代码围栏，不要解释性前后缀。",
  ].join("\n"), true);
};

export const articlePrompt = (task: WebsiteAgentTask, marker: string): string =>
  promptEnvelope(task, marker, [
    "仅依据本 conversation 已 checkpoint 的 public-knowledge-research-output.v3 研究结论写成文章。",
    "不得重新选题、不得引入未在研究中出现的来源或主张；引用 identity 与顺序必须保持一致。",
    `当前回合唯一输出子合同：${JSON.stringify(publicKnowledgeTurnContract("article"))}`,
    "严格返回当前 article 子合同的全部且仅有字段。",
    "只返回严格 JSON 对象，不要代码围栏，不要解释性前后缀。",
  ].join("\n"), false);

export const imagePrompt = (task: WebsiteAgentTask, marker: string): string =>
  promptEnvelope(task, marker, [
    "仅依据本 conversation 已完成的研究和文章，生成一张横向文章主图。",
    "本轮唯一业务输出是一张可下载的生成图片。",
  ].join("\n"), false);

export const reviewPrompt = (
  task: WebsiteAgentTask,
  marker: string,
  providerNames: readonly string[],
): string => promptEnvelope(task, marker, [
  `读取且只读取本轮两个附件：${providerNames.join(" 与 ")}。`,
  task.action_id === "accuracy_challenge"
    ? "只检查公开性、来源、主张、引文与事实准确性；不得改写文章或替 Website 裁决。"
    : "只检查独立性、表达、读者价值、合同摩擦与质量风险；不得改写文章或替 Website 裁决。",
  "严格返回 website-agent-review-output.v1：仅含 decision 与 issues；decision 只能是 no_issue 或 issues。",
  "只返回严格 JSON 对象，不要代码围栏，不要解释性前后缀。",
].join("\n"), true);

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
