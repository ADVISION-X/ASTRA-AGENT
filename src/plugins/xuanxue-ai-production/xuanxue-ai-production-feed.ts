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
  XUANXUE_AI_PRODUCTION_JOB_ID,
  type XuanxueAiOrderRecord,
  type XuanxueAiProductionOrder,
  type XuanxueAiStageId,
  type XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";

type GeneratedStageInput = Awaited<ReturnType<typeof writePriorStageInput>>;

const labelForStage = (
  productId: XuanxueAiProductionOrder["productId"],
  stageId: XuanxueAiStageId,
): AiTaskLabelKey => {
  let label: AiTaskLabelKey = "bazi_analysis";
  if (productId.startsWith("qimen_")) label = "qimen_analysis";
  if (productId.startsWith("hehun_")) label = "hehun_analysis";
  if (productId.startsWith("naming_")) label = "naming_analysis";
  if (stageId === "analysis") label = "qimen_analysis";
  if (stageId === "naming_author") label = "naming_analysis";
  if (stageId === "payment_screenshot_observation") label = "generic_ai";
  if (stageId === "corpus_research") label = "seo_research";
  if (stageId === "article_synthesis") label = "seo_article";
  if (stageId === "followup") label = "hehun_analysis";
  return label;
};

const seededAiResult = (
  seeded: XuanxueAiProductionOrder["seededStages"][number],
): AiFeedResult => ({
  abilityGroupId: "ai-input-gateway",
  childCapabilityId: "feed-gpt-web-chat-once",
  providerKind: "gpt-web-chat",
  status: "success",
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
  return {
    orderId: order.orderId,
    stageId: definition.stageId,
    ordinal,
    executionId: seeded?.executionId
      ?? `${XUANXUE_AI_PRODUCTION_JOB_ID}:${order.orderId}:${definition.stageId}`,
    status: seeded ? "completed" : "queued",
    attemptCount: seeded ? 1 : 0,
    material: order.materials[ordinal]!,
    aiFeedResult: seeded ? seededAiResult(seeded) : null,
    rawResponseText: seeded?.rawResponseText ?? null,
    rawOutputHash: seeded?.rawOutputHash ?? null,
    progressPhase: seeded ? "terminal" : "queued",
    failureReason: null,
    createdAt: order.createdAt,
    updatedAt: order.createdAt,
  };
});

export const requireXuanxueStage = (
  record: XuanxueAiOrderRecord,
  stageId: XuanxueAiStageId,
): XuanxueAiStageRecord => {
  const stage = record.stages.find((candidate) => candidate.stageId === stageId);
  if (!stage) {
    throw new Error(`XUANXUE_AI_PRODUCTION_STAGE_MISSING:${stageId}`);
  }
  return stage;
};

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
) {
  if (!prior.rawResponseText || !prior.rawOutputHash) {
    throw new Error(
      `XUANXUE_AI_PRODUCTION_DEPENDENCY_OUTPUT_MISSING:${prior.stageId}`,
    );
  }
  const directory = generatedStageDirectory(runtime, orderId, targetStageId);
  await mkdir(directory, { recursive: true });
  const fileName = `${String(prior.ordinal + 1).padStart(2, "0")}-${prior.stageId}-raw-response.txt`;
  const filePath = path.join(directory, fileName);
  const bytes = Buffer.from(prior.rawResponseText, "utf8");
  const sha256 =
    `sha256:${createHash("sha256").update(bytes).digest("hex")}` as const;
  if (sha256 !== prior.rawOutputHash) {
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
    priorRawOutputHash: prior.rawOutputHash,
    providerPageUrl,
  };
};

const parentContinuation = async (
  runtime: XuanxueAiProductionRuntime,
  record: XuanxueAiOrderRecord,
  stage: XuanxueAiStageRecord,
): Promise<{
  generated: GeneratedStageInput[];
  continuation: AiFeedInput["providerContinuationRef"];
  taskLabel: AiTaskLabelKey;
} | null> => {
  const parentRef = record.order.continuationParent;
  if (!parentRef) return null;
  const parentOrder = runtime.store.readOrder(parentRef.jobId);
  if (!parentOrder || parentOrder.status !== "completed") {
    throw new Error("XUANXUE_AI_PRODUCTION_PARENT_LOCAL_ORDER_MISSING");
  }
  const parentStage = requireXuanxueStage(parentOrder, parentRef.stageId);
  const providerPageUrl =
    parentStage.aiFeedResult?.providerProof.webChatUrl;
  if (
    parentStage.rawOutputHash !== parentRef.rawOutputHash
    || !providerPageUrl
    || parentStage.status !== "completed"
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_PARENT_LOCAL_PROOF_MISMATCH");
  }
  return {
    generated: [
      await writePriorStageInput(
        runtime,
        record.order.orderId,
        stage.stageId,
        parentStage,
      ),
    ],
    continuation: {
      priorTaskId: parentStage.executionId,
      priorRawOutputHash: parentStage.rawOutputHash,
      providerPageUrl,
    },
    taskLabel: labelForStage(
      parentOrder.order.productId,
      parentStage.stageId,
    ),
  };
};

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
  const parent = await parentContinuation(runtime, record, stage);
  const continuation = parent?.continuation
    ?? continuationFor(record, definition);
  const taskLabel = parent?.taskLabel
    ?? labelForStage(record.order.productId, stage.stageId);
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
    textPrompt: stage.material.textPrompt,
    inputRefs: [
      ...stage.material.inputRefs,
      ...generated,
      ...(parent?.generated ?? []),
    ],
    modelName: null,
    timeoutMs: stage.material.timeoutMs,
    maxInputChars: stage.material.maxInputChars,
    maxFileCount: stage.material.maxFileCount,
    maxFileBytes: stage.material.maxFileBytes,
    requestedBy: "ai-capability",
    missionId: XUANXUE_AI_PRODUCTION_JOB_ID,
    runId: record.order.orderId,
    roundId: stage.stageId,
    ...(continuation ? { providerContinuationRef: continuation } : {}),
  };
};
