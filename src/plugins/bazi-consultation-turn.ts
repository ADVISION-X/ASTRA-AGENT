import type {
  ProductGptAnyCallInput,
  ProductGptChildResult,
  ProductGptTools,
} from "../capabilities/gpt/index.js";
import { executionFailure } from "../lib/execution-failure.js";
import {
  hashCanonical,
  type ProductionHash,
  type SharedExecutionContext,
  type WebsiteAgentTask,
} from "../mediator/product-plugin-contract.js";

type ConsultationFlow = Readonly<{
  sessionKey: string;
  execute(call: ProductGptAnyCallInput): Promise<ProductGptChildResult<ProductGptAnyCallInput["child"]>>;
}>;

export type ConsultationBinding = Omit<
  Parameters<ProductGptTools["recordContinuation"]>[0],
  "submitEvidenceRef" | "checkpoint"
>;

const fail = (code: string): never => { throw executionFailure("failed", code); };
const text = (value: unknown, code: string): string => {
  if (typeof value !== "string" || !value.trim()) fail(code);
  return value as string;
};
const hash = (value: unknown, code: string): ProductionHash => {
  if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(value)) fail(code);
  return value as ProductionHash;
};
const precedingUserTurnId = (assistantTurnId: string): string => {
  const ordinal = Number(/^conversation-turn-([1-9][0-9]*)$/u.exec(assistantTurnId)?.[1]);
  if (!Number.isSafeInteger(ordinal) || ordinal < 2 || ordinal % 2 !== 0) {
    fail("PRODUCT_CONTINUATION_PREDECESSOR_INVALID");
  }
  return `conversation-turn-${ordinal - 1}`;
};

const identity = (task: WebsiteAgentTask): Readonly<{ root: string; hash: ProductionHash }> => {
  const root = text(task.parameters.consultation_root_ref, "PRODUCT_CONSULTATION_ROOT_INVALID");
  return Object.freeze({
    root,
    hash: hashCanonical([
      task.business_identity.owner_ref,
      task.business_identity.subject_ref,
      text(task.parameters.chart_version, "PRODUCT_CONSULTATION_IDENTITY_INVALID"),
      hash(task.parameters.chart_hash, "PRODUCT_CONSULTATION_IDENTITY_INVALID"),
      root,
    ]),
  });
};

const verifyPredecessor = async (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
  flow: ConsultationFlow,
  consultationIdentityHash: ProductionHash,
  predecessorSourceTaskRef: string,
): Promise<void> => {
  const predecessor = await context.gpt.acquireContinuation({
    sessionKey: flow.sessionKey,
    productStepId: task.action_id,
    callId: "consultation-resume",
    consultationIdentityHash,
    predecessorSourceTaskRef,
  });
  const result = await flow.execute({
    productStepId: task.action_id,
    callId: "continuation-predecessor-checkpoint",
    child: "checkpoint_gpt_text_response",
    actionOrdinal: 1,
    input: {
      probeBudgetMs: 3_600_000,
      canonicalConversationUrl: predecessor.canonicalConversationUrl,
      expectedPromptHash: predecessor.promptHash,
      userTurnId: precedingUserTurnId(predecessor.assistantTurnId),
      turnMarker: predecessor.turnMarker,
    },
  });
  const value = result.value as Readonly<Record<string, unknown>>;
  if (value.assistantTurnId !== predecessor.assistantTurnId
    || value.semanticTextHash !== predecessor.semanticTextHash) {
    fail("PRODUCT_CONTINUATION_PREDECESSOR_INVALID");
  }
};

export const prepareBaziConsultation = async (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
  flow: ConsultationFlow,
  kind: "root" | "followup",
): Promise<ConsultationBinding> => {
  const current = identity(task);
  if (kind === "root") {
    if (task.source_task_id !== current.root) fail("PRODUCT_CONSULTATION_ROOT_INVALID");
    if (context.resultRevision.revision === 0) {
      await flow.execute({
        productStepId: task.action_id,
        callId: "fresh-chat",
        child: "prepare_clean_gpt_chat",
        actionOrdinal: 1,
        input: { timeoutMs: 60_000 },
      });
    } else {
      await verifyPredecessor(task, context, flow, current.hash, task.job_id);
    }
  } else {
    const predecessor = context.resultRevision.revision > 0
      ? task.job_id : task.parent_task_ref;
    if (!predecessor || (predecessor === task.job_id && context.resultRevision.revision === 0)) {
      fail("PRODUCT_CONSULTATION_PREDECESSOR_INVALID");
    }
    await verifyPredecessor(task, context, flow, current.hash,
      text(predecessor, "PRODUCT_CONSULTATION_PREDECESSOR_INVALID"));
  }
  return Object.freeze({
    sourceTaskRef: task.job_id,
    consultationIdentityHash: current.hash,
  });
};

export const baziRevisionInstruction = (context: SharedExecutionContext): readonly string[] =>
  context.resultRevision.revision === 0 ? [] : Object.freeze([
    `Website 已授权结果修订 ${context.resultRevision.revision}；只修正该拒绝回执指出的问题：${JSON.stringify(context.resultRevision.priorRejection)}`,
  ]);
