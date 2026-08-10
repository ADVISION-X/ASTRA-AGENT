import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  AiFeedInput,
  AiFeedResult,
  AiTaskLabelKey,
} from "../../capabilities/ai-input-gateway/index.js";
import type {
  XuanxueAiProductionProfile,
  XuanxueAiStageDefinition,
} from "./xuanxue-ai-production.profile.js";
import type { XuanxueAiProductionRuntime } from "./xuanxue-ai-production.runtime.js";
import {
  isXuanxueAiPaidFollowupProduct,
  isXuanxueAiRequiredContinuationProduct,
  isXuanxueAiReusableBaseConsumerProduct,
  isAllowedXuanxueConversationParent,
} from "./xuanxue-ai-production-conversation-policy.js";
import {
  assertExactFrozenSubjectMatches,
  assertPersonParentMatches,
  physicalParentRecord,
  requireXuanxueStage,
} from "./xuanxue-ai-production-parent-proof.js";
export { requireXuanxueStage } from "./xuanxue-ai-production-parent-proof.js";
import {
  XUANXUE_AI_PRODUCTION_JOB_ID,
  type XuanxueAiOrderRecord,
  type XuanxueAiProductionOrder,
  type XuanxueAiStageId,
  type XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";
import {
  xuanxueAiOutputIntegrityFailure,
} from "./xuanxue-ai-production-output-integrity.js";
import { publicKnowledgeImagePromptBoundary } from "./generated-image-policy.js";
import { buildTypedJoinInputs } from "./xuanxue-ai-production-typed-join-inputs.js";

export const canonicalXuanxueRawOutputHash = (
  value: string,
): `sha256:${string}` => {
  const canonical = value.startsWith("sha256:")
    ? value
    : `sha256:${value}`;
  if (!/^sha256:[a-f0-9]{64}$/u.test(canonical)) {
    throw new Error("XUANXUE_AI_PRODUCTION_OUTPUT_HASH_INVALID");
  }
  return canonical as `sha256:${string}`;
};

const labelForStage = (
  productId: XuanxueAiProductionOrder["productId"],
  stageId: XuanxueAiStageId,
): AiTaskLabelKey => {
  if (productId === "public_knowledge_article_pipeline") {
    return stageId === "corpus_research" ? "seo_research" : "seo_article";
  }
  if (productId.startsWith("bazi_")) return "bazi_analysis";
  if (productId.startsWith("qimen_")) return "qimen_analysis";
  if (productId.startsWith("hehun_")) return "hehun_analysis";
  if (productId.startsWith("naming_")) return "naming_analysis";
  return "generic_ai";
};

const seededAiResult = (
  seeded: XuanxueAiProductionOrder["seededStages"][number],
): AiFeedResult => ({
  abilityGroupId: "ai-input-gateway",
  childCapabilityId: "feed-gpt-web-chat-once",
  providerKind: "gpt-web-chat",
  status: "success",
  outputKind: "text",
  outputArtifacts: [],
  rawResponseText: seeded.rawResponseText,
  transportWarnings: seeded.transportWarnings,
  normalizedText: seeded.rawResponseText,
  rawOutputRef:
    (seeded.providerProof.outputRefs as string[] | undefined)?.[0] ?? null,
  rawOutputHash: seeded.rawOutputHash,
  parseStatus: "not_requested",
  parsedJson: null,
  schemaValidationStatus: "not_applicable",
  providerProof: seeded.providerProof as AiFeedResult["providerProof"],
  failureReason: null,
  reviewRequiredReason: null,
});

export const initialXuanxueStages = (
  order: XuanxueAiProductionOrder,
  profile: XuanxueAiProductionProfile,
): XuanxueAiStageRecord[] => profile.stages.map((definition, ordinal) => {
  const seeded = order.seededStages.find(
    (stage) => stage.stageId === definition.stageId,
  );
  const seededFailure = seeded
    ? xuanxueAiOutputIntegrityFailure(seeded.rawResponseText)
    : null;
  const seededAccepted = Boolean(seeded && !seededFailure);
  return {
    orderId: order.orderId,
    stageId: definition.stageId,
    ordinal,
    executionId: seededAccepted
      ? seeded!.executionId
      : `${XUANXUE_AI_PRODUCTION_JOB_ID}:${order.orderId}:${definition.stageId}`,
    supersededExecutionId: seededFailure ? seeded!.executionId : null,
    status: seededAccepted
      ? "completed"
      : seededFailure
        ? "recovery_pending"
        : "queued",
    attemptCount: seeded ? 1 : 0,
    material: order.materials[ordinal]!,
    aiFeedResult: seededAccepted ? seededAiResult(seeded!) : null,
    rawResponseText: seededAccepted ? seeded!.rawResponseText : null,
    rawOutputHash: seededAccepted ? seeded!.rawOutputHash : null,
    progressPhase: seededAccepted
      ? "terminal"
      : seededFailure
        ? "recovery_pending"
        : "queued",
    failureReason: seededFailure,
    createdAt: order.createdAt,
    updatedAt: order.createdAt,
  };
});

const generatedStageDirectory = (
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  stageId: XuanxueAiStageId,
): string => path.join(
  runtime.dataDir,
  "plugin-tasks",
  XUANXUE_AI_PRODUCTION_JOB_ID,
  "generated-inputs",
  orderId,
  stageId,
);

async function writePriorStageInput(
  runtime: XuanxueAiProductionRuntime,
  orderId: string,
  targetStageId: XuanxueAiStageId,
  prior: XuanxueAiStageRecord,
  fileNamePrefix?: string,
) {
  if (!prior.rawResponseText || !prior.rawOutputHash) {
    throw new Error(
      `XUANXUE_AI_PRODUCTION_DEPENDENCY_OUTPUT_MISSING:${prior.stageId}`,
    );
  }
  const directory = generatedStageDirectory(runtime, orderId, targetStageId);
  await mkdir(directory, { recursive: true });
  const fileName = `${fileNamePrefix ?? ""}${String(prior.ordinal + 1).padStart(2, "0")}-${prior.stageId}-raw-response.txt`;
  const filePath = path.join(directory, fileName);
  const bytes = Buffer.from(prior.rawResponseText, "utf8");
  const sha256 =
    `sha256:${createHash("sha256").update(bytes).digest("hex")}` as const;
  if (sha256 !== canonicalXuanxueRawOutputHash(prior.rawOutputHash)) {
    throw new Error(
      `XUANXUE_AI_PRODUCTION_DEPENDENCY_HASH_MISMATCH:${prior.stageId}`,
    );
  }
  await writeFile(filePath, bytes);
  return {
    id: `${orderId}:${targetStageId}:prior:${prior.stageId}`,
    kind: "prior_stage_raw_response",
    summary: `工厂已校验的前置阶段原始回答：${prior.stageId}`,
    filePath,
    fileName,
    mimeType: "text/plain; charset=utf-8",
    sha256,
    byteCount: bytes.byteLength,
  };
}

const continuationFor = (
  record: XuanxueAiOrderRecord,
  definition: XuanxueAiStageDefinition,
): AiFeedInput["providerContinuationRef"] | undefined => {
  if (!definition.continuationFrom) return undefined;
  const prior = requireXuanxueStage(record, definition.continuationFrom);
  const providerPageUrl = prior.aiFeedResult?.providerProof.webChatUrl;
  if (
    prior.status !== "completed"
    || !prior.rawOutputHash
    || !providerPageUrl
  ) {
    throw new Error(
      `XUANXUE_AI_PRODUCTION_CONTINUATION_PROOF_MISSING:${prior.stageId}`,
    );
  }
  return {
    priorTaskId: prior.executionId,
    priorRawOutputHash:
      canonicalXuanxueRawOutputHash(prior.rawOutputHash),
    providerPageUrl,
    priorTurnMarker: providerTurnMarker(prior.aiFeedResult!.providerProof),
  };
};

const providerTurnMarker = (
  proof: AiFeedResult["providerProof"],
): string => {
  const marker = proof.forkedFromCheckpointProof?.childFirstTurnMarker
    ?? proof.sameConversationProof?.newTurnMarker
    ?? proof.freshConversationProof?.firstTurnMarker;
  if (!marker) {
    throw new Error("XUANXUE_AI_PRODUCTION_PROVIDER_TURN_MARKER_MISSING");
  }
  return marker;
};

const requireParentConversationProof = (
  runtime: XuanxueAiProductionRuntime,
  record: XuanxueAiOrderRecord,
): {
  parentStage: XuanxueAiStageRecord;
  parentRawOutputHash: `sha256:${string}`;
  providerPageUrl: string;
  parentMarker: string;
} => {
  const parentRef = record.order.conversationParent!;
  const parentOrder = runtime.store.readOrder(parentRef.jobId);
  if (!parentOrder || parentOrder.status !== "completed") {
    throw new Error("XUANXUE_AI_PRODUCTION_PARENT_LOCAL_ORDER_MISSING");
  }
  if (isXuanxueAiRequiredContinuationProduct(record.order.productId)
    && !isAllowedXuanxueConversationParent({
      childProductId: record.order.productId,
      parentProductId: parentOrder.order.productId,
      parentStageId: parentRef.stageId,
    })) {
    throw new Error("XUANXUE_AI_PRODUCTION_PARENT_PROFILE_MISMATCH");
  }
  if (isXuanxueAiPaidFollowupProduct(record.order.productId)) {
    assertExactFrozenSubjectMatches(record, parentOrder);
  } else if (isXuanxueAiReusableBaseConsumerProduct(record.order.productId)) {
    const primaryPersonRef = record.order.frozenSubject.primaryPersonRef;
    if (!primaryPersonRef) {
      throw new Error("XUANXUE_AI_PRODUCTION_PRIMARY_PERSON_NOT_FROZEN");
    }
    assertPersonParentMatches({
      child: record,
      parent: parentOrder,
      personRef: primaryPersonRef,
    });
  }
  const rebuild = runtime.store.readParentConversationRebuild({
    parentJobId: parentRef.jobId,
    parentStageId: parentRef.stageId,
    originalRawOutputHash: parentRef.rawOutputHash,
  });
  const physical = physicalParentRecord({
    runtime,
    originalParent: parentOrder,
    parentRef,
    rebuild,
  });
  const parentStage = physical.stage;
  const parentRawOutputHash = parentStage.rawOutputHash
    ? canonicalXuanxueRawOutputHash(parentStage.rawOutputHash)
    : null;
  const providerPageUrl = parentStage.aiFeedResult?.providerProof.webChatUrl;
  if (
    !parentRawOutputHash
    || parentRawOutputHash !== parentRef.rawOutputHash
    || !providerPageUrl
    || (rebuild && providerPageUrl !== rebuild.providerPageUrl)
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_PARENT_LOCAL_PROOF_MISMATCH");
  }
  const parentMarker = providerTurnMarker(parentStage.aiFeedResult!.providerProof);
  if (rebuild?.rebuiltTurnMarker && parentMarker !== rebuild.rebuiltTurnMarker) {
    throw new Error("XUANXUE_AI_PRODUCTION_PARENT_LOCAL_PROOF_MISMATCH");
  }
  return { parentStage, parentRawOutputHash, providerPageUrl, parentMarker };
};

const parentConversation = async (
  runtime: XuanxueAiProductionRuntime,
  record: XuanxueAiOrderRecord,
): Promise<{
  continuation?: AiFeedInput["providerContinuationRef"];
  fork?: AiFeedInput["providerForkRef"];
  taskLabel: AiTaskLabelKey;
} | null> => {
  const parentRef = record.order.conversationParent;
  if (!parentRef) return null;
  const proof = requireParentConversationProof(runtime, record);
  const common = {
    priorTaskId: proof.parentStage.executionId,
    priorRawOutputHash: proof.parentRawOutputHash,
    providerPageUrl: proof.providerPageUrl,
  };
  return {
    ...(parentRef.relation === "same_conversation"
      ? { continuation: {
          ...common,
          priorTurnMarker: proof.parentMarker,
        } }
      : { fork: {
          ...common,
          checkpointTurnMarker: proof.parentMarker,
          checkpointResponseHash: proof.parentRawOutputHash,
          parentConversationScopeRef: parentRef.conversationScopeRef,
        } }),
    taskLabel: labelForStage(
      record.order.productId,
      record.stages[0]!.stageId,
    ),
  };
};

const ensureInputBundleRef = (
  record: XuanxueAiOrderRecord,
  inputs: AiFeedInput["inputRefs"],
): AiFeedInput["inputRefs"] => inputs.some(
  (inputRef) => inputRef.id === record.order.inputBundleRef,
) ? inputs : [{
  id: record.order.inputBundleRef,
  kind: "input_bundle",
  summary: "玄学网站锁定的完整 AI 输入包",
}, ...inputs];

export const buildXuanxueAiFeedInput = async (
  runtime: XuanxueAiProductionRuntime,
  record: XuanxueAiOrderRecord,
  stage: XuanxueAiStageRecord,
  definition: XuanxueAiStageDefinition,
): Promise<AiFeedInput> => {
  const generated = await Promise.all(
    definition.generatedInputsFrom.map((stageId) =>
      writePriorStageInput(
        runtime,
        record.order.orderId,
        stage.stageId,
        requireXuanxueStage(record, stageId),
      )),
  );
  const joined = await buildTypedJoinInputs({
    runtime,
    record,
    stage,
    writePriorStageInput,
    generatedStageDirectory,
  });
  const parent = (
    definition.continuationFrom === null
    && record.order.conversationParent !== null
  )
    ? await parentConversation(runtime, record)
    : null;
  const continuation = parent?.continuation
    ?? continuationFor(record, definition);
  const taskLabel = parent?.taskLabel
    ?? labelForStage(record.order.productId, stage.stageId);
  const trustedGeneratedFileCount =
    generated.length + joined.length;
  const stageInputs = [
    ...stage.material.inputRefs,
    ...generated,
    ...joined,
  ];
  const inputRefs = ensureInputBundleRef(record, stageInputs);
  return {
    providerKind: "gpt-web-chat",
    taskIdentity: {
      labelKey: taskLabel,
      sourceProject: "xuanxue-web",
      taskKind: record.order.productId,
      sourceTaskId: `${record.order.orderId}:${stage.stageId}`,
    },
    promptPackageId: stage.material.promptPackageId,
    promptContractId: stage.material.promptContractId,
    expectedOutputSchemaRef: stage.material.expectedOutputSchemaRef,
    expectedOutputKind: stage.material.expectedOutputKind,
    textPrompt: stage.material.expectedOutputKind === "generated_image"
      ? `${stage.material.textPrompt}\n\n${publicKnowledgeImagePromptBoundary}`
      : stage.material.textPrompt,
    inputRefs,
    modelName: null,
    timeoutMs: stage.material.timeoutMs,
    maxInputChars: stage.material.maxInputChars,
    maxFileCount:
      stage.material.maxFileCount + trustedGeneratedFileCount,
    maxFileBytes: stage.material.maxFileBytes,
    requestedBy: "ai-capability",
    missionId: XUANXUE_AI_PRODUCTION_JOB_ID,
    runId: record.order.orderId,
    roundId: stage.stageId,
    conversationScopeRef: record.order.conversationScopeRef,
    ...(continuation ? { providerContinuationRef: continuation } : {}),
    ...(parent?.fork ? { providerForkRef: parent.fork } : {}),
  };
};
