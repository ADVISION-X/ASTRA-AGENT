import type {
  AiFeedResult,
  AiInputGatewayProgress,
  WebChatAttachmentUploadProof,
} from "../../capabilities/ai-input-gateway/index.js";
import { createHash } from "node:crypto";
import type { XuanxueAiStageDefinition } from "./xuanxue-ai-production.profile.js";
import {
  buildXuanxueAiFeedInput,
  canonicalXuanxueRawOutputHash,
  requireXuanxueStage,
} from "./xuanxue-ai-production-feed.js";
import type { XuanxueAiProductionRuntime } from "./xuanxue-ai-production.runtime.js";
import { normalizeGeneratedImageResult } from "./xuanxue-ai-production-image-result.js";
import {
  XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_BLOCKED_BEFORE_SUBMISSION,
  type XuanxueAiOrderRecord,
  type XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";
import {
  xuanxueAiOutputIntegrityFailure,
} from "./xuanxue-ai-production-output-integrity.js";
import {
  isXuanxueLocalizationProduct,
} from "./xuanxue-ai-production-localization-contract.js";
import {
  isXuanxueTerminalMetaphysicsProduct,
  isXuanxueTerminalMetaphysicsProfile,
  xuanxueTerminalMetaphysicsProviderProfile,
} from "./xuanxue-ai-production-terminal-profile.js";

export interface XuanxueAiProductionExecutionObserver {
  readonly onAttachmentUploadCompleted?: (input: {
    readonly orderId: string;
    readonly stageId: XuanxueAiStageRecord["stageId"];
    readonly proof: WebChatAttachmentUploadProof;
  }) => Promise<void>;
}

const nowIso = (): string => new Date().toISOString();
const RECOVERY_RETRY_DELAY_MS = 1_000;
const MAX_RECOVERY_RETRY_DELAY_MS = 10_000;

export const continuationConversationUnavailable = (
  reason: string | null,
): boolean => Boolean(
  reason
  && /(?:WEB_CHAT_CONTINUATION_CONVERSATION_DRIFT|provider continuation conversation mismatch|XUANXUE_AI_PRODUCTION_CONTINUATION_PROOF_MISSING)/iu
    .test(reason)
);

export const waitForRecoveryRetry = async (
  stage: XuanxueAiStageRecord,
): Promise<boolean> => {
  const deadline = new Date(stage.createdAt).getTime()
    + stage.material.timeoutMs;
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) return false;
  const retryDelayMs = Math.min(
    remainingMs,
    MAX_RECOVERY_RETRY_DELAY_MS,
    RECOVERY_RETRY_DELAY_MS * Math.max(1, stage.attemptCount),
  );
  await new Promise<void>((resolve) => setTimeout(resolve, retryDelayMs));
  return true;
};

const canonicalizeStageResult = (
  result: AiFeedResult,
): AiFeedResult => {
  const rawOutputHash = result.rawOutputHash
    ? canonicalXuanxueRawOutputHash(result.rawOutputHash)
    : null;
  const providerOutputHash = result.providerProof.outputHash
    ? canonicalXuanxueRawOutputHash(result.providerProof.outputHash)
    : null;
  return {
    ...result,
    rawOutputHash,
    providerProof: {
      ...result.providerProof,
      outputHash: providerOutputHash,
    },
  };
};

const terminalAttachmentReason = (result: AiFeedResult): string => {
  const proof = result.providerProof.attachmentUploadProof;
  const reason = proof?.failureReason
    ?? proof?.reviewRequiredReason
    ?? result.failureReason
    ?? result.reviewRequiredReason
    ?? "provider rejected the governed attachment set";
  return reason.replace(/\s+/gu, " ").trim().slice(0, 400);
};

const isPublicKnowledgePreSubmitAttachmentBlock = (
  result: AiFeedResult,
  stage: XuanxueAiStageRecord,
  productId: XuanxueAiOrderRecord["order"]["productId"],
): boolean => {
  const proofStatus = result.providerProof.attachmentUploadProof?.status;
  return productId === "public_knowledge_article_pipeline"
    && stage.stageId === "corpus_research"
    && (result.status === "failed" || result.status === "review_required")
    && (proofStatus === "failed" || proofStatus === "review_required")
    && !result.providerProof.webChatUrl
    && !result.providerProof.freshConversationProof
    && !result.providerProof.sameConversationProof
    && !result.providerProof.forkedFromCheckpointProof;
};

const record = (value: unknown): Readonly<Record<string, unknown>> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : null;

const localizationTranscriptValid = (transcript: string): boolean => {
  if (!transcript.trim()) return false;
  const forbidden = new Set([
    "tool_call",
    "tool_result",
    "browser_action",
    "computer_call",
    "function_call",
    "command_execution",
  ]);
  for (const line of transcript.trim().split("\n")) {
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      return false;
    }
    const eventRecord = record(event);
    const item = record(eventRecord?.item);
    const kinds = [
      eventRecord?.type,
      eventRecord?.event,
      item?.type,
    ].filter((value): value is string => typeof value === "string");
    if (kinds.some((kind) => forbidden.has(kind))) return false;
  }
  return true;
};

const localizationProviderEvidenceFailure = (
  result: AiFeedResult,
  order: XuanxueAiOrderRecord["order"],
): string | null => {
  if (!isXuanxueLocalizationProduct(order.productId)) return null;
  const expected = order.providerExecutionProfile;
  const identity = result.providerProof.modelIdentityProof;
  const transcript = result.providerProof.providerTranscriptJsonl;
  const transcriptHash = result.providerProof.providerTranscriptHash;
  const actualTranscriptHash = transcript
    ? `sha256:${createHash("sha256").update(transcript).digest("hex")}`
    : null;
  if (
    !expected
    || !identity
    || identity.proofStatus !== "verified"
    || identity.modelFamily !== expected.model_family
    || identity.modelDisplayName !== expected.model_label
    || identity.reasoningEffort !== expected.reasoning_effort
  ) {
    return "XUANXUE_AI_PRODUCTION_LOCALIZATION_MODEL_IDENTITY_MISMATCH";
  }
  if (
    !transcript
    || !transcriptHash
    || transcriptHash !== actualTranscriptHash
    || !localizationTranscriptValid(transcript)
  ) {
    return "XUANXUE_AI_PRODUCTION_LOCALIZATION_PROVIDER_TRANSCRIPT_INVALID";
  }
  return null;
};

const terminalMetaphysicsProviderEvidenceFailure = (
  result: AiFeedResult,
  order: XuanxueAiOrderRecord["order"],
): string | null => {
  if (!isXuanxueTerminalMetaphysicsProduct(order.productId)) return null;
  const expected = order.providerExecutionProfile as Record<string, unknown> | null;
  const profileProof = result.providerProof.providerExecutionProfileProof;
  const identity = result.providerProof.modelIdentityProof;
  if (!isXuanxueTerminalMetaphysicsProfile(expected)) {
    return "XUANXUE_AI_PRODUCTION_GPT_5_6_SOL_PROFILE_MISMATCH";
  }
  if (
    !profileProof
    || profileProof.proofStatus !== "verified"
    || profileProof.provider !== "openai-chatgpt-web"
    || profileProof.transport !== "gpt-web-chat"
    || profileProof.modelDisplayName !== xuanxueTerminalMetaphysicsProviderProfile.modelLabel
    || profileProof.modelFamily !== xuanxueTerminalMetaphysicsProviderProfile.modelFamily
    || profileProof.reasoningTier !== xuanxueTerminalMetaphysicsProviderProfile.reasoningTier
    || !identity
    || identity.proofStatus !== "verified"
    || identity.modelIdentityStatus !== "verified"
    || identity.modelDisplayName !== xuanxueTerminalMetaphysicsProviderProfile.modelLabel
    || identity.modelFamily !== xuanxueTerminalMetaphysicsProviderProfile.modelFamily
    || identity.reasoningEffort !== xuanxueTerminalMetaphysicsProviderProfile.reasoningUiLabel
  ) {
    return "XUANXUE_AI_PRODUCTION_GPT_5_6_SOL_PROVIDER_PROOF_MISMATCH";
  }
  return null;
};

const terminalStageFromResult = (
  result: AiFeedResult,
  stage: XuanxueAiStageRecord,
  order: XuanxueAiOrderRecord["order"],
): Pick<XuanxueAiStageRecord, "status" | "failureReason"> => {
  if (isPublicKnowledgePreSubmitAttachmentBlock(result, stage, order.productId)) {
    return {
      status: "failed",
      failureReason:
        `${XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_BLOCKED_BEFORE_SUBMISSION}:`
        + terminalAttachmentReason(result),
    };
  }
  if (result.status === "review_required") {
    return {
      status: "recovery_pending",
      failureReason:
        result.reviewRequiredReason ?? "provider review required",
    };
  }
  if (result.status === "failed") {
    return {
      status: "recovery_pending",
      failureReason: result.failureReason ?? "provider execution failed",
    };
  }
  if (!result.rawResponseText || !result.rawOutputHash) {
    return {
      status: "recovery_pending",
      failureReason: "XUANXUE_AI_PRODUCTION_RAW_RESPONSE_MISSING",
    };
  }
  const integrityFailure = xuanxueAiOutputIntegrityFailure(
    result.rawResponseText,
  );
  if (integrityFailure) {
    return {
      status: "recovery_pending",
      failureReason: integrityFailure,
    };
  }
  if (
    result.parseStatus === "json_invalid"
    && result.schemaValidationStatus !== "not_applicable"
  ) {
    return {
      status: "recovery_pending",
      failureReason: "XUANXUE_AI_PRODUCTION_OUTPUT_JSON_INVALID",
    };
  }
  const localizationEvidenceFailure = localizationProviderEvidenceFailure(
    result,
    order,
  );
  const terminalMetaphysicsEvidenceFailure = terminalMetaphysicsProviderEvidenceFailure(
    result,
    order,
  );
  if (localizationEvidenceFailure || terminalMetaphysicsEvidenceFailure) {
    return {
      status: "recovery_pending",
      failureReason: localizationEvidenceFailure ?? terminalMetaphysicsEvidenceFailure,
    };
  }
  return { status: "completed", failureReason: null };
};

const progressStatus = (
  phase: AiInputGatewayProgress["phase"],
): XuanxueAiStageRecord["status"] => phase === "recovery_pending"
  ? "recovery_pending"
  : phase === "waiting_provider"
    ? "waiting_provider"
    : phase === "response_checkpointed"
      ? "response_checkpointed"
      : "running";

const persistStageProgress = (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  stageId: XuanxueAiStageRecord["stageId"],
  progress: AiInputGatewayProgress,
): void => {
  const latest = runtime.store.readOrder(orderId);
  if (!latest) return;
  const persisted = requireXuanxueStage(latest, stageId);
  if (persisted.status === "completed") return;
  runtime.store.updateStage({
    ...persisted,
    status: progressStatus(progress.phase),
    progressPhase: progress.phase,
    updatedAt: progress.occurredAt,
  }, "stage_progress");
};

const persistStageAttachmentUploadProof = (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  stageId: XuanxueAiStageRecord["stageId"],
  proof: WebChatAttachmentUploadProof,
): void => {
  const latest = runtime.store.readOrder(orderId);
  if (!latest) throw new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND");
  const persisted = requireXuanxueStage(latest, stageId);
  if (
    persisted.attachmentUploadProof
    && JSON.stringify(persisted.attachmentUploadProof) !== JSON.stringify(proof)
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_ATTACHMENT_PROOF_DRIFT");
  }
  if (persisted.attachmentUploadProof) return;
  runtime.store.updateStage({
    ...persisted,
    attachmentUploadProof: proof,
    updatedAt: proof.endedAt,
  }, "stage_attachment_upload_proof");
};

export const persistStageResult = (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  stage: XuanxueAiStageRecord,
  result: AiFeedResult,
): XuanxueAiStageRecord => {
  const progressedOrder = runtime.store.readOrder(orderId);
  if (!progressedOrder) {
    throw new Error("XUANXUE_AI_PRODUCTION_ORDER_NOT_FOUND");
  }
  const progressedStage = requireXuanxueStage(
    progressedOrder,
    stage.stageId,
  );
  const terminal = terminalStageFromResult(
    result,
    progressedStage,
    progressedOrder.order,
  );
  return runtime.store.updateStage({
    ...progressedStage,
    ...terminal,
    aiFeedResult: result,
    rawResponseText: result.rawResponseText ?? null,
    rawOutputHash: result.rawOutputHash,
    progressPhase: terminal.status === "completed" || terminal.status === "failed"
      ? "terminal"
      : "recovery_pending",
    updatedAt: nowIso(),
  }, "stage_terminal");
};

export const acknowledgeInterventionSafePoint = async (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  checkpoint: string,
): Promise<void> => {
  const acknowledged = runtime.store.acknowledgeInterventionAtSafePoint(
    orderId,
    checkpoint,
  );
  if (acknowledged) {
    if (acknowledged.state === "taken_over") {
      await runtime.aiInputGateway.releaseProviderTargetForOperator?.(
        `xuanxue-ai-production:${orderId}`,
      );
    }
    throw new Error(
      `XUANXUE_AI_INTERVENTION_STOPPED:${acknowledged.state}:${checkpoint}`,
    );
  }
};

export const executeGatewayStage = async (input: {
  runtime: XuanxueAiProductionRuntime;
  orderId: string;
  stage: XuanxueAiStageRecord;
  feedInput: Awaited<ReturnType<typeof buildXuanxueAiFeedInput>>;
  observer?: XuanxueAiProductionExecutionObserver;
}): Promise<AiFeedResult> => normalizeGeneratedImageResult(
  input.runtime,
  input.orderId,
  input.stage.stageId,
  canonicalizeStageResult(await input.runtime.aiInputGateway.execute(
    input.feedInput,
    {
      executionId: input.stage.executionId,
      ...(input.stage.supersededExecutionId && input.stage.attemptCount === 2
        ? { supersededExecutionId: input.stage.supersededExecutionId }
        : {}),
      onProgress: async (progress) =>
        persistStageProgress(
          input.runtime,
          input.orderId,
          input.stage.stageId,
          progress,
        ),
      onAttachmentUploadCompleted: async (proof) => {
        persistStageAttachmentUploadProof(
          input.runtime,
          input.orderId,
          input.stage.stageId,
          proof,
        );
        await input.observer?.onAttachmentUploadCompleted?.({
          orderId: input.orderId,
          stageId: input.stage.stageId,
          proof,
        });
      },
    },
  )),
);
