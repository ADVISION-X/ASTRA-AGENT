import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  downloadXuanxueAiProductionInput,
  downloadXuanxueAiProductionParentReplayInput,
} from "./xuanxue-ai-production-cloud-client.js";
import type {
  XuanxueAiProductionCloudClaimedJob,
  XuanxueAiProductionCloudCredential,
} from "./xuanxue-ai-production-cloud-contract.js";
import type {
  XuanxueAiProductionOrder,
  XuanxueAiStageMaterial,
} from "./xuanxue-ai-production.schema.js";

const safeFileName = (value: string): string => {
  const base = path.basename(value).replace(/[\p{Cc}/\\]/gu, "_");
  return base.slice(0, 240) || "input.bin";
};

const stagingRoot = (dataDir: string, jobId: string): string => {
  if (!/^aiprod_[A-Za-z0-9-]+$/u.test(jobId)) {
    throw new Error("XUANXUE_AI_PRODUCTION_CLOUD_JOB_ID_INVALID");
  }
  return path.join(
    dataDir,
    "plugin-tasks",
    "xuanxue-ai-production",
    "cloud-staging",
    jobId,
  );
};

const parentReplayRoot = (
  childRoot: string,
  parentJobId: string,
): string => {
  if (!/^aiprod_[A-Za-z0-9-]+$/u.test(parentJobId)) {
    throw new Error("XUANXUE_AI_PRODUCTION_PARENT_REPLAY_ID_INVALID");
  }
  return path.join(childRoot, "parent-replay", parentJobId);
};

const writeVerifiedFile = async (
  destination: string,
  bytes: Uint8Array,
  expectedHash: string,
  expectedBytes: number,
): Promise<void> => {
  const digest =
    `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (digest !== expectedHash || bytes.byteLength !== expectedBytes) {
    throw new Error("XUANXUE_AI_PRODUCTION_INPUT_INTEGRITY_INVALID");
  }
  await writeFile(destination, bytes, { mode: 0o600 });
  const stored = await readFile(destination);
  const storedHash =
    `sha256:${createHash("sha256").update(stored).digest("hex")}`;
  if (storedHash !== expectedHash || stored.byteLength !== expectedBytes) {
    throw new Error("XUANXUE_AI_PRODUCTION_STAGED_INPUT_INVALID");
  }
};

const stageMaterial = async (
  root: string,
  material: XuanxueAiProductionCloudClaimedJob["materials"][number],
  download: (inputId: string) => Promise<Uint8Array>,
): Promise<XuanxueAiStageMaterial> => {
  const directory = path.join(root, material.stage_id);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const names = material.inputs.map((input) => safeFileName(input.file_name));
  if (new Set(names).size !== names.length) {
    throw new Error("XUANXUE_AI_PRODUCTION_INPUT_NAME_CONFLICT");
  }
  const inputRefs = [];
  for (const input of material.inputs) {
    const fileName = safeFileName(input.file_name);
    const destination = path.join(directory, fileName);
    let validExisting = false;
    try {
      const existing = await readFile(destination);
      validExisting = existing.byteLength === input.byte_count
        && `sha256:${createHash("sha256").update(existing).digest("hex")}`
          === input.sha256;
    } catch {
      validExisting = false;
    }
    if (!validExisting) {
      await writeVerifiedFile(
        destination,
        await download(input.input_id),
        input.sha256,
        input.byte_count,
      );
    }
    inputRefs.push({
      id: input.input_id,
      kind: input.kind,
      summary: input.summary,
      filePath: destination,
      fileName,
      mimeType: input.mime_type,
      sha256: input.sha256,
      byteCount: input.byte_count,
    });
  }
  const actualNames = await readdir(directory);
  const expectedNames = new Set(names);
  if (
    actualNames.length !== expectedNames.size
    || actualNames.some((name) => !expectedNames.has(name))
  ) {
    throw new Error("XUANXUE_AI_PRODUCTION_STAGING_MEMBERSHIP_INVALID");
  }
  return {
    stageId: material.stage_id,
    promptPackageId: material.instruction_package_id,
    promptContractId: material.output_contract_ref,
    expectedOutputSchemaRef: material.output_schema_ref,
    expectedOutputKind: material.expected_output_kind,
    textPrompt: material.task_directive,
    inputRefs,
    timeoutMs: material.timeout_ms,
    maxFileCount: material.max_file_count,
  };
};

const stageMaterials = async (
  root: string,
  materials: XuanxueAiProductionCloudClaimedJob["materials"],
  download: (
    material: XuanxueAiProductionCloudClaimedJob["materials"][number],
    inputId: string,
  ) => Promise<Uint8Array>,
): Promise<XuanxueAiStageMaterial[]> => {
  const staged = [];
  for (const material of materials) {
    staged.push(await stageMaterial(
      root,
      material,
      (inputId) => download(material, inputId),
    ));
  }
  return staged;
};

const seededStages = (
  stages: XuanxueAiProductionCloudClaimedJob["seeded_stages"],
): XuanxueAiProductionOrder["seededStages"] => stages.map((stage) => ({
  stageId: stage.stage_id,
  executionId: stage.execution_id,
  rawResponseText: stage.raw_response_text,
  rawOutputHash: stage.raw_output_hash,
  providerProof: stage.provider_proof,
  transportWarnings: stage.transport_warnings,
}));

const frozenSubject = (
  subject: XuanxueAiProductionCloudClaimedJob["frozen_subject"],
): XuanxueAiProductionOrder["frozenSubject"] => ({
  privacyOwnerRef: subject.privacy_owner_ref,
  snapshotRef: subject.snapshot_ref,
  snapshotHash: subject.snapshot_hash,
  caseRevisionRef: subject.case_revision_ref,
  primaryPersonRef: subject.primary_person_ref,
  participantManifestHash: subject.participant_manifest_hash,
  participants: subject.participants.map((participant) => ({
    slotRef: participant.slot_ref,
    roleCode: participant.role_code,
    personRef: participant.person_ref,
    profileVersionRef: participant.profile_version_ref,
    chartStateRef: participant.chart_state_ref,
    chartStateVersion: participant.chart_state_version,
    chartStateHash: participant.chart_state_hash,
    purposeCode: participant.purpose_code,
    authorizationReceiptRef: participant.authorization_receipt_ref,
  })),
});

const childOrder = (
  job: XuanxueAiProductionCloudClaimedJob,
  materials: XuanxueAiStageMaterial[],
): XuanxueAiProductionOrder => ({
    protocolVersion: "xuanxue-ai-production-v4",
  orderId: job.job_id,
  sourceProject: "xuanxue-web",
  sourceTaskId: job.source_task_id,
  productId: job.product_id,
  serviceClass: job.service_class,
  triggerKind: job.trigger_kind,
  lineageId: job.lineage_id,
  reflectionSnapshotRef: job.reflection_snapshot_ref,
  reflectionPlanId: job.reflection_plan_id,
  inputBundleRef: job.input_bundle_ref,
  inputBundleHash: job.input_bundle_hash,
  requestHash: job.request_hash,
  frozenSubject: frozenSubject(job.frozen_subject),
  conversationScopeRef: job.conversation_scope_ref,
  conversationParent: job.conversation_parent
    ? {
        relation: job.conversation_parent.relation,
        jobId: job.conversation_parent.job_id,
        stageId: job.conversation_parent.stage_id,
        executionId: job.conversation_parent.execution_id,
        rawOutputHash: job.conversation_parent.raw_output_hash,
        inputBundleHash: job.conversation_parent.input_bundle_hash,
        conversationScopeRef:
          job.conversation_parent.conversation_scope_ref,
      }
    : null,
  joinParents: job.join_parents.map((parent) => ({
    participantSlotRef: parent.participant_slot_ref,
    participantRoleCode: parent.participant_role_code,
    personRef: parent.person_ref,
    jobId: parent.job_id,
    stageId: parent.stage_id,
    executionId: parent.execution_id,
    rawOutputHash: parent.raw_output_hash,
    conversationScopeRef: parent.conversation_scope_ref,
  })),
  seededStages: seededStages(job.seeded_stages),
  materials,
  createdAt: job.created_at,
});

type CloudParentReplay = NonNullable<
  XuanxueAiProductionCloudClaimedJob["continuation_parent_replay"]
>;
type CloudDependencyReplay = CloudParentReplay[
  "dependency_replays"
][number];

const parentReplayOrder = (
  replay: CloudParentReplay | CloudDependencyReplay,
  materials: XuanxueAiStageMaterial[],
): XuanxueAiProductionOrder => ({
    protocolVersion: "xuanxue-ai-production-v4",
  orderId: replay.job_id,
  sourceProject: "xuanxue-web",
  sourceTaskId: replay.source_task_id,
  productId: replay.product_id,
  serviceClass: replay.service_class,
  triggerKind: replay.trigger_kind,
  lineageId: replay.lineage_id,
  reflectionSnapshotRef: replay.reflection_snapshot_ref,
  reflectionPlanId: replay.reflection_plan_id,
  inputBundleRef: replay.input_bundle_ref,
  inputBundleHash: replay.input_bundle_hash,
  requestHash: replay.request_hash,
  frozenSubject: frozenSubject(replay.frozen_subject),
  conversationScopeRef: replay.conversation_scope_ref,
  conversationParent: replay.conversation_parent
    ? {
        relation: replay.conversation_parent.relation,
        jobId: replay.conversation_parent.job_id,
        stageId: replay.conversation_parent.stage_id,
        executionId: replay.conversation_parent.execution_id,
        rawOutputHash: replay.conversation_parent.raw_output_hash,
        inputBundleHash: replay.conversation_parent.input_bundle_hash,
        conversationScopeRef:
          replay.conversation_parent.conversation_scope_ref,
      }
    : null,
  joinParents: replay.join_parents.map((parent) => ({
    participantSlotRef: parent.participant_slot_ref,
    participantRoleCode: parent.participant_role_code,
    personRef: parent.person_ref,
    jobId: parent.job_id,
    stageId: parent.stage_id,
    executionId: parent.execution_id,
    rawOutputHash: parent.raw_output_hash,
    conversationScopeRef: parent.conversation_scope_ref,
  })),
  seededStages: seededStages(replay.seeded_stages),
  materials,
  createdAt: replay.created_at,
});

export async function stageXuanxueAiProductionCloudJob(
  dataDir: string,
  credential: XuanxueAiProductionCloudCredential,
  job: XuanxueAiProductionCloudClaimedJob,
): Promise<{
  readonly order: XuanxueAiProductionOrder;
  readonly parentReplay: XuanxueAiProductionOrder | null;
  readonly parentReplayDependencies: XuanxueAiProductionOrder[];
}> {
  const childRoot = stagingRoot(dataDir, job.job_id);
  const materials = await stageMaterials(
    childRoot,
    job.materials,
    (material, inputId) => downloadXuanxueAiProductionInput(
        credential,
        job,
        material.stage_id,
        inputId,
      ),
  );
  const order = childOrder(job, materials);
  const replay = job.continuation_parent_replay;
  if (!replay) {
    return { order, parentReplay: null, parentReplayDependencies: [] };
  }
  const parentRoot = parentReplayRoot(childRoot, replay.job_id);
  const parentMaterials = await stageMaterials(
    parentRoot,
    replay.materials,
    (material, inputId) =>
      downloadXuanxueAiProductionParentReplayInput(
        credential,
        job,
        material.stage_id,
        inputId,
      ),
  );
  const parentReplayDependencies = await Promise.all(
    replay.dependency_replays.map(async (dependency) => {
      const dependencyRoot = parentReplayRoot(
        parentRoot,
        dependency.job_id,
      );
      const dependencyMaterials = await stageMaterials(
        dependencyRoot,
        dependency.materials,
        (material, inputId) =>
          downloadXuanxueAiProductionParentReplayInput(
            credential,
            job,
            material.stage_id,
            inputId,
          ),
      );
      return parentReplayOrder(dependency, dependencyMaterials);
    }),
  );
  return {
    order,
    parentReplay: parentReplayOrder(replay, parentMaterials),
    parentReplayDependencies,
  };
}

export const cleanXuanxueAiProductionCloudStaging = (
  dataDir: string,
  jobId: string,
): Promise<void> => rm(
  stagingRoot(dataDir, jobId),
  { recursive: true, force: true },
);
