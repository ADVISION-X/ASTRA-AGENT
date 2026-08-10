import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AiFeedInput } from "../../capabilities/ai-input-gateway/index.js";
import {
  assertPersonParentMatches,
  requireXuanxueStage,
} from "./xuanxue-ai-production-parent-proof.js";
import type { XuanxueAiProductionRuntime } from "./xuanxue-ai-production.runtime.js";
import type {
  XuanxueAiOrderRecord,
  XuanxueAiStageId,
  XuanxueAiStageRecord,
} from "./xuanxue-ai-production.schema.js";

type GeneratedInput = AiFeedInput["inputRefs"][number];

type TypedJoinInput = {
  runtime: XuanxueAiProductionRuntime;
  record: XuanxueAiOrderRecord;
  stage: XuanxueAiStageRecord;
  writePriorStageInput(
    runtime: XuanxueAiProductionRuntime,
    orderId: string,
    targetStageId: XuanxueAiStageId,
    prior: XuanxueAiStageRecord,
    fileNamePrefix?: string,
  ): Promise<GeneratedInput>;
  generatedStageDirectory(
    runtime: XuanxueAiProductionRuntime,
    orderId: string,
    stageId: XuanxueAiStageId,
  ): string;
};

const isTypedJoinStage = (
  record: XuanxueAiOrderRecord,
  stage: XuanxueAiStageRecord,
): boolean => (
  record.order.productId === "hehun_ai_analysis"
    && stage.stageId === "final_compatibility"
) || (
  ["naming_bazi_analysis_and_naming", "naming_from_existing_bazi_report"]
    .includes(record.order.productId)
    && stage.stageId === "naming_author"
);

const expectedParentProduct = (
  record: XuanxueAiOrderRecord,
  role: string,
): string | null => {
  if (record.order.productId !== "hehun_ai_analysis") {
    return "bazi_canonical_base_interpretation";
  }
  if (role === "party_a") return "hehun_canonical_party_a_interpretation";
  if (role === "party_b") return "hehun_canonical_party_b_interpretation";
  return null;
};

const buildJoinedInput = async (
  input: TypedJoinInput,
  binding: XuanxueAiOrderRecord["order"]["joinParents"][number],
): Promise<GeneratedInput> => {
  const parentOrder = input.runtime.store.readOrder(binding.jobId);
  if (!parentOrder || parentOrder.status !== "completed") {
    throw new Error("XUANXUE_AI_PRODUCTION_JOIN_PARENT_MISSING");
  }
  const parentStage = requireXuanxueStage(parentOrder, binding.stageId);
  assertPersonParentMatches({
    child: input.record,
    parent: parentOrder,
    personRef: binding.personRef,
  });
  if (
    parentOrder.order.productId
      !== expectedParentProduct(input.record, binding.participantRoleCode)
    || parentStage.status !== "completed"
    || parentStage.executionId !== binding.executionId
    || parentStage.rawOutputHash !== binding.rawOutputHash
    || parentOrder.order.conversationScopeRef !== binding.conversationScopeRef
    || parentOrder.order.frozenSubject.primaryPersonRef !== binding.personRef
  ) throw new Error("XUANXUE_AI_PRODUCTION_JOIN_PARENT_PROOF_MISMATCH");
  const generated = await input.writePriorStageInput(
    input.runtime,
    input.record.order.orderId,
    input.stage.stageId,
    parentStage,
    `${binding.participantSlotRef.replace(/[^a-zA-Z0-9._-]+/gu, "_")}-`,
  );
  return {
    ...generated,
    id: `${generated.id}:participant:${binding.participantSlotRef}`,
    kind: "typed_participant_private_base",
    summary: `已按 participant manifest 校验的私有基础解读：${binding.participantRoleCode}/${binding.personRef}`,
  };
};

const writeManifest = async (
  input: TypedJoinInput,
  joined: GeneratedInput[],
): Promise<GeneratedInput> => {
  const directory = input.generatedStageDirectory(
    input.runtime, input.record.order.orderId, input.stage.stageId,
  );
  await mkdir(directory, { recursive: true });
  const fileName = "typed-participant-manifest.json";
  const filePath = path.join(directory, fileName);
  const participants = input.record.order.joinParents.map((binding, index) => ({
    slot_ref: binding.participantSlotRef,
    role_code: binding.participantRoleCode,
    person_ref: binding.personRef,
    source_job_id: binding.jobId,
    source_stage_id: binding.stageId,
    source_execution_id: binding.executionId,
    source_raw_output_hash: binding.rawOutputHash,
    source_conversation_scope_ref: binding.conversationScopeRef,
    attached_file_name: joined[index]!.fileName,
    attached_file_sha256: joined[index]!.sha256,
  }));
  const manifest = {
    schema_version: "xuanxue-ai-typed-participant-manifest-v1",
    frozen_subject_snapshot_ref: input.record.order.frozenSubject.snapshotRef,
    frozen_subject_snapshot_hash: input.record.order.frozenSubject.snapshotHash,
    participant_manifest_hash: input.record.order.frozenSubject.participantManifestHash,
    canonical_participant_order: input.record.order.frozenSubject.participants
      .map((participant) => participant.slotRef),
    participants,
  } as const;
  const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const sha256 = `sha256:${createHash("sha256").update(bytes).digest("hex")}` as const;
  await writeFile(filePath, bytes);
  return {
    id: `${input.record.order.orderId}:${input.stage.stageId}:typed-participant-manifest`,
    kind: "typed_participant_manifest",
    summary: "具名、具角色、具来源 hash 的参与者合流清单",
    filePath,
    fileName,
    mimeType: "application/json",
    sha256,
    byteCount: bytes.byteLength,
  };
};

export const buildTypedJoinInputs = async (
  input: TypedJoinInput,
): Promise<GeneratedInput[]> => {
  if (!isTypedJoinStage(input.record, input.stage)) return [];
  const joined = await Promise.all(input.record.order.joinParents.map(
    (binding) => buildJoinedInput(input, binding),
  ));
  if (joined.length === 0) return joined;
  return [await writeManifest(input, joined), ...joined];
};
