import { createHash } from "node:crypto";

import {
  type GptApprovedFile,
  type GptProviderContinuation,
} from "../../capabilities/gpt/index.js";
import {
  hashCanonical,
  type ProductionHash,
  type WebsiteAgentTask,
} from "../../lib/local-runtime/production/contracts.js";
import {
  gptTextContinuationCheckpointInput,
  type ProductGptAnyCallInput,
  type ProductGptTools,
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
  type PublicKnowledgeReceptionReceipt,
} from "./result-contract.js";

export const PLUGIN_ID = "public-knowledge-article-pipeline";

export type SeoChild = ProductGptTools["execute"];
export type SeoCall = ProductGptAnyCallInput;
export type SeoTurnCheckpoint = Readonly<{
  assistantTurnId: string;
  rawDomHtml: string;
  rawDomHash: ProductionHash;
  semanticText: string;
  semanticTextHash: ProductionHash;
  artifactRef: string;
  evidenceRef: string;
  evidenceHash: ProductionHash;
  canonicalConversationUrl: string;
  promptHash: ProductionHash;
  turnMarker: string;
}>;
export type SeoUploadedAttachment = GptApprovedFile;

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

export const researchFrontierRef = (task: WebsiteAgentTask): ProductionHash => hashCanonical({
  identity_type: "gpt-continuation-frontier.v1",
  job_id: task.job_id,
  plugin_id: PLUGIN_ID,
  owner_ref: task.business_identity.owner_ref,
  subject_ref: task.business_identity.subject_ref,
  authorization_ref: task.business_identity.authorization_ref,
  product_step_id: "corpus_research",
});

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

export const continuationTextCheckpoint = (
  sourceAttemptId: string,
  checkpoint: SeoTurnCheckpoint,
) => gptTextContinuationCheckpointInput(sourceAttemptId, checkpoint);
