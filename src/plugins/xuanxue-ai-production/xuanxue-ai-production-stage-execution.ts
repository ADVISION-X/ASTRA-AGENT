import type {
  AiFeedResult,
  AiInputGatewayProgress,
  AiInputGatewaySubmissionAdmission,
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
  type XuanxueAiProductionOrder,
  type XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";
import {
  xuanxueAiOutputIntegrityFailure,
} from "./xuanxue-ai-production-output-integrity.js";
import { xuanxueProviderEvidenceFailure } from "./xuanxue-ai-production-provider-evidence.js";
import type { WebChatPageActionProof } from "../../capabilities/ai-input-gateway/index.js";
import type {
  XuanxueAiBrowserTargetLease,
  XuanxueAiExecutionDeadlineBudget,
} from "./xuanxue-ai-production.runtime.js";

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

const browserHash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const requireBrowserHash = (value: string): `sha256:${string}` => {
  if (!/^sha256:[a-f0-9]{64}$/u.test(value)) {
    throw new Error("XUANXUE_AI_PRODUCTION_BROWSER_BINDING_HASH_INVALID");
  }
  return value as `sha256:${string}`;
};

const outcomeResolvingPageActions = new Set<WebChatPageActionProof["actionId"]>([
  "apply_execution_profile",
  "dismiss_known_search_dialog",
  "focus_exact_composer",
  "write_exact_prompt",
  "submit_exact_turn",
  "switch_exact_conversation",
  "discover_conversation_via_search",
  "rename_exact_conversation",
  "cleanup_owned_transient_ui",
]);

type StageBrowserAdmission = Readonly<{
  browser?: XuanxueAiBrowserTargetLease;
  submissionAdmission?: AiInputGatewaySubmissionAdmission;
}>;

export const buildXuanxueAiSubmissionAdmission = (input: {
  identity: NonNullable<XuanxueAiProductionOrder["cloudExecutionIdentity"]>;
  orderCreatedAt: string;
  orderId: string;
  stageExecutionId: string;
  stageOrdinal: number;
}): AiInputGatewaySubmissionAdmission => {
  const priorityKey = [
    input.orderCreatedAt,
    input.orderId,
    String(input.stageOrdinal).padStart(4, "0"),
  ].join(":");
  return {
    admissionRef: browserHash(JSON.stringify({
      jobId: input.identity.jobId,
      attemptId: input.identity.attemptId,
      requiredDeviceId: input.identity.requiredDeviceId,
      leaseVersion: input.identity.leaseVersion,
      executionFenceHash: input.identity.executionFenceHash,
      contractManifestHash: input.identity.contractManifestHash,
      executionId: input.stageExecutionId,
      priorityKey,
    })),
    priorityKey,
  };
};

const acquireStageBrowser = async (input: {
  runtime: XuanxueAiProductionRuntime;
  orderId: string;
  stage: XuanxueAiStageRecord;
  deadlineBudget?: XuanxueAiExecutionDeadlineBudget;
}): Promise<StageBrowserAdmission> => {
  const record = input.runtime.store.readOrder(input.orderId);
  const identity = record?.order.cloudExecutionIdentity;
  if (!identity) return {};
  if (!input.runtime.browserAuthority || !input.deadlineBudget) {
    throw new Error("XUANXUE_AI_PRODUCTION_BROWSER_AUTHORITY_REQUIRED");
  }
  const remainingMs = Math.floor(
    input.deadlineBudget.expiresAtMonotonic - performance.now(),
  );
  const commandTtlMs = Math.min(
    input.deadlineBudget.commandTtlMs,
    remainingMs,
  );
  if (commandTtlMs < 1) {
    throw new Error("XUANXUE_AI_PRODUCTION_V6_DEADLINE_BUDGET_EXHAUSTED");
  }
  const executionRef = `${identity.jobId}:${identity.attemptId}:${input.stage.executionId}`;
  const submissionAdmission = buildXuanxueAiSubmissionAdmission({
    identity,
    orderCreatedAt: record.order.createdAt,
    orderId: record.order.orderId,
    stageExecutionId: input.stage.executionId,
    stageOrdinal: input.stage.ordinal,
  });
  const browser = await input.runtime.browserAuthority.acquireJobBoundTargetLease({
    kind: "xuanxue",
    ownerPluginId: "xuanxue-ai-production",
    jobId: identity.jobId,
    attemptId: identity.attemptId,
    deviceId: identity.requiredDeviceId,
    leaseVersion: identity.leaseVersion,
    localOrderId: record.order.orderId,
    contractManifestHash: requireBrowserHash(identity.contractManifestHash),
    executionRef,
    jobRefHash: browserHash(identity.jobId),
    executionRefHash: browserHash(executionRef),
    writerLeaseEpoch: identity.leaseVersion,
    writerFenceHash: requireBrowserHash(identity.executionFenceHash),
    candidateHash: requireBrowserHash(input.runtime.candidateHash),
    commandTtlMs,
  }, `xuanxue-ai-production:${record.order.orderId}`);
  return {
    browser,
    submissionAdmission,
  };
};

const resolvePageActionMutations = async (
  browser: XuanxueAiBrowserTargetLease,
  proof: WebChatPageActionProof,
): Promise<void> => {
  if (!outcomeResolvingPageActions.has(proof.actionId)
    || proof.result !== "committed"
    || proof.candidateCount !== 1
    || proof.semantics.length === 0
    || !proof.targetRefHash
    || !proof.documentRefHash) return;
  await browser.resolvePendingMutation({
    schemaVersion: "grasseye.browser.outcome-resolution.v1",
    ownerPluginId: "xuanxue-ai-production",
    outcome: proof.result === "committed" || proof.result === "no_op"
      ? "TERMINAL_SUCCESS"
      : "TERMINAL_FAILURE",
    positiveEvidenceRef: `${proof.evidenceRef}:target-state-confirmed`,
    negativeEvidenceRef: `${proof.evidenceRef}:adjacent-states-excluded`,
    uniqueTargetRef: browser.target.targetRef,
    boundedAt: proof.endedAt,
  });
};

const resolveAttachmentMutations = async (
  browser: XuanxueAiBrowserTargetLease,
  orderId: string,
  stageId: XuanxueAiStageRecord["stageId"],
  proof: WebChatAttachmentUploadProof,
): Promise<void> => {
  if (proof.status !== "attachments_stable"
    || proof.expectedFileCount < 1
    || proof.detectedFileCount !== proof.expectedFileCount
    || proof.files.length !== proof.expectedFileCount) return;
  const prefix = `xuanxue-stage:${orderId}:${stageId}:attachment:${proof.uploadAttemptId}`;
  await browser.resolvePendingMutation({
    schemaVersion: "grasseye.browser.outcome-resolution.v1",
    ownerPluginId: "xuanxue-ai-production",
    outcome: "TERMINAL_SUCCESS",
    positiveEvidenceRef: `${prefix}:exact-files-stable`,
    negativeEvidenceRef: `${prefix}:adjacent-states-excluded`,
    uniqueTargetRef: browser.target.targetRef,
    boundedAt: proof.endedAt,
  });
};

export const continuationConversationUnavailable = (
  reason: string | null,
): boolean => Boolean(
  reason
  && /(?:WEB_CHAT_CONTINUATION_CONVERSATION_DRIFT|provider continuation conversation mismatch|XUANXUE_AI_PRODUCTION_CONTINUATION_PROOF_MISSING)/iu
    .test(reason)
);

export const waitForRecoveryRetry = async (
  stage: XuanxueAiStageRecord,
  signal?: AbortSignal,
): Promise<boolean> => {
  if (signal?.aborted) return false;
  const deadline = new Date(stage.createdAt).getTime()
    + stage.material.timeoutMs;
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) return false;
  const retryDelayMs = Math.min(
    remainingMs,
    MAX_RECOVERY_RETRY_DELAY_MS,
    RECOVERY_RETRY_DELAY_MS * Math.max(1, stage.attemptCount),
  );
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, retryDelayMs);
    signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });
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

const reviewRequiredStage = (result: AiFeedResult): Pick<XuanxueAiStageRecord, "status" | "failureReason"> | null => {
  const reason = result.reviewRequiredReason ?? result.failureReason ?? "";
  if (!/^review_required:/iu.test(reason) && !/\bBROWSER_OUTCOME_UNKNOWN\b/iu.test(reason)) return null;
  return { status: "review_required", failureReason: reason };
};

const explicitFailureStage = (result: AiFeedResult): Pick<XuanxueAiStageRecord, "status" | "failureReason"> | null => {
  if (result.status === "recovery_pending") return {
    status: "recovery_pending", failureReason: result.failureReason ?? "provider recovery pending",
  };
  if (result.status === "review_required") return {
    status: "review_required", failureReason: result.reviewRequiredReason ?? "provider review required",
  };
  if (result.status === "failed") return {
    status: "failed", failureReason: result.failureReason ?? "provider execution failed",
  };
  return null;
};

const outputIntegrityStage = (result: AiFeedResult): Pick<XuanxueAiStageRecord, "status" | "failureReason"> | null => {
  if (!result.rawResponseText || !result.rawOutputHash) return {
    status: "failed", failureReason: "XUANXUE_AI_PRODUCTION_RAW_RESPONSE_MISSING",
  };
  const integrityFailure = xuanxueAiOutputIntegrityFailure(result.rawResponseText);
  if (integrityFailure) return { status: "failed", failureReason: integrityFailure };
  if (result.parseStatus === "json_invalid" && result.schemaValidationStatus !== "not_applicable") return {
    status: "failed", failureReason: "XUANXUE_AI_PRODUCTION_OUTPUT_JSON_INVALID",
  };
  return null;
};

const immediateTerminalStage = (
  result: AiFeedResult,
  stage: XuanxueAiStageRecord,
  productId: XuanxueAiOrderRecord["order"]["productId"],
): Pick<XuanxueAiStageRecord, "status" | "failureReason"> | null => {
  const reviewStage = reviewRequiredStage(result);
  if (reviewStage) return reviewStage;
  if (isPublicKnowledgePreSubmitAttachmentBlock(result, stage, productId)) return {
    status: "failed",
    failureReason: `${XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_BLOCKED_BEFORE_SUBMISSION}:${terminalAttachmentReason(result)}`,
  };
  return explicitFailureStage(result) ?? outputIntegrityStage(result);
};

const terminalStageFromResult = (
  result: AiFeedResult,
  stage: XuanxueAiStageRecord,
  order: XuanxueAiOrderRecord["order"],
): Pick<XuanxueAiStageRecord, "status" | "failureReason"> => {
  const immediate = immediateTerminalStage(result, stage, order.productId);
  if (immediate) return immediate;
  const evidenceFailure = xuanxueProviderEvidenceFailure(result, order);
  if (evidenceFailure) return { status: "failed", failureReason: evidenceFailure };
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
    progressPhase: terminal.status === "completed"
      || terminal.status === "failed"
      || terminal.status === "review_required"
      ? "terminal"
      : "recovery_pending",
    updatedAt: nowIso(),
  }, "stage_terminal");
};

export const acknowledgeControlIntentSafePoint = async (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  checkpoint: string,
): Promise<void> => {
  const acknowledged = runtime.store.acknowledgeControlIntentAtSafePoint(
    orderId,
    checkpoint,
  );
  if (acknowledged) {
    if (acknowledged.intent === "handover_requested") {
      await runtime.aiInputGateway.releaseProviderTargetForOperator?.(
        `xuanxue-ai-production:${orderId}`,
      );
    }
    throw new Error(
      `XUANXUE_AI_CONTROL_STOPPED:${acknowledged.intent}:${checkpoint}`,
    );
  }
};

export const executeGatewayStage = async (input: {
  runtime: XuanxueAiProductionRuntime;
  orderId: string;
  stage: XuanxueAiStageRecord;
  feedInput: Awaited<ReturnType<typeof buildXuanxueAiFeedInput>>;
  observer?: XuanxueAiProductionExecutionObserver;
  deadlineBudget?: XuanxueAiExecutionDeadlineBudget;
}): Promise<AiFeedResult> => {
  const { browser, submissionAdmission } = await acquireStageBrowser(input);
  const result = canonicalizeStageResult(await input.runtime.aiInputGateway.execute(
    input.feedInput,
    {
      executionId: input.stage.executionId,
      ...(input.deadlineBudget ? { signal: input.deadlineBudget.abortSignal } : {}),
      ...(submissionAdmission ? { submissionAdmission } : {}),
      ...(browser ? { browser } : {}),
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
        if (browser) {
          await resolveAttachmentMutations(
            browser,
            input.orderId,
            input.stage.stageId,
            proof,
          );
        }
      },
      ...(browser ? {
        onPageActionCommitted: (proof) =>
          resolvePageActionMutations(browser, proof),
      } : {}),
    },
  ));
  browser?.assertNoPendingMutations();
  return normalizeGeneratedImageResult(
    input.runtime,
    input.orderId,
    input.stage.stageId,
    result,
  );
};
