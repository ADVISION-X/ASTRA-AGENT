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
    promptPackageId: material.prompt_package_id,
    promptContractId: material.prompt_contract_id,
    expectedOutputSchemaRef: material.output_schema_ref,
    textPrompt: material.text_prompt,
    inputRefs,
    timeoutMs: material.timeout_ms,
    maxInputChars: material.max_input_chars,
    maxFileCount: material.max_file_count,
    maxFileBytes: material.max_file_bytes,
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

const childOrder = (
  job: XuanxueAiProductionCloudClaimedJob,
  materials: XuanxueAiStageMaterial[],
): XuanxueAiProductionOrder => ({
  protocolVersion: "xuanxue-ai-production-v1",
  orderId: job.job_id,
  sourceProject: "xuanxue-web",
  sourceTaskId: job.source_task_id,
  productId: job.product_id,
  inputBundleRef: job.input_bundle_ref,
  inputBundleHash: job.input_bundle_hash,
  requestHash: job.request_hash,
  continuationParent: job.continuation_parent
    ? {
        jobId: job.continuation_parent.job_id,
        stageId: job.continuation_parent.stage_id,
        rawOutputHash: job.continuation_parent.raw_output_hash,
      }
    : null,
  seededStages: seededStages(job.seeded_stages),
  materials,
  createdAt: job.created_at,
});

const parentReplayOrder = (
  replay: NonNullable<
    XuanxueAiProductionCloudClaimedJob["continuation_parent_replay"]
  >,
  materials: XuanxueAiStageMaterial[],
): XuanxueAiProductionOrder => ({
  protocolVersion: "xuanxue-ai-production-v1",
  orderId: replay.job_id,
  sourceProject: "xuanxue-web",
  sourceTaskId: replay.source_task_id,
  productId: replay.product_id,
  inputBundleRef: replay.input_bundle_ref,
  inputBundleHash: replay.input_bundle_hash,
  requestHash: replay.request_hash,
  continuationParent: null,
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
  if (!replay) return { order, parentReplay: null };
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
  return {
    order,
    parentReplay: parentReplayOrder(replay, parentMaterials),
  };
}

export const cleanXuanxueAiProductionCloudStaging = (
  dataDir: string,
  jobId: string,
): Promise<void> => rm(
  stagingRoot(dataDir, jobId),
  { recursive: true, force: true },
);
