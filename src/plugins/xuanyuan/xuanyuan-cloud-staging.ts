import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { XuanyuanRequest } from "./xuanyuan.schema.js";
import type {
  XuanyuanCloudClaimedJob,
  XuanyuanCloudCredential,
} from "./xuanyuan-cloud-contract.js";
import { downloadXuanyuanCloudInput } from "./xuanyuan-cloud-client.js";

function safeFileName(value: string): string {
  const base = path.basename(value).replace(/[\u0000-\u001f\u007f/\\]/gu, "_");
  return base.slice(0, 240) || "input.bin";
}

function stagingDirectory(dataDir: string, jobId: string): string {
  if (!/^aijob_[A-Za-z0-9-]+$/u.test(jobId)) {
    throw new Error("XUANYUAN_CLOUD_JOB_ID_INVALID");
  }
  return path.join(dataDir, "runtime-data", "xuanyuan", "cloud-jobs", jobId, "inputs");
}

async function writeVerifiedFile(
  directory: string,
  fileName: string,
  bytes: Uint8Array,
  expectedHash: string,
  expectedBytes: number,
): Promise<string> {
  const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (digest !== expectedHash || bytes.byteLength !== expectedBytes) {
    throw new Error("XUANYUAN_CLOUD_INPUT_INTEGRITY_INVALID");
  }
  const destination = path.join(directory, fileName);
  await writeFile(destination, bytes, { mode: 0o600 });
  const stored = await readFile(destination);
  const storedHash = `sha256:${createHash("sha256").update(stored).digest("hex")}`;
  if (storedHash !== expectedHash || stored.byteLength !== expectedBytes) {
    throw new Error("XUANYUAN_CLOUD_STAGED_INPUT_INTEGRITY_INVALID");
  }
  return destination;
}

async function stageCloudInputRefs(
  dataDir: string,
  credential: XuanyuanCloudCredential,
  job: XuanyuanCloudClaimedJob,
): Promise<XuanyuanRequest["inputRefs"]> {
  const directory = stagingDirectory(dataDir, job.job_id);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const refs: XuanyuanRequest["inputRefs"] = [
    {
      id: job.input_bundle_ref,
      kind: "input_bundle",
      summary: `complete ${job.domain_id} model input bundle`,
    },
  ];
  const normalizedNames = job.inputs.map((input) => safeFileName(input.file_name));
  if (new Set(normalizedNames).size !== normalizedNames.length) {
    throw new Error("XUANYUAN_CLOUD_INPUT_FILE_NAME_CONFLICT");
  }
  for (const input of job.inputs) {
    const fileName = safeFileName(input.file_name);
    const destination = path.join(directory, fileName);
    let validExisting = false;
    try {
      const existing = await readFile(destination);
      validExisting = existing.byteLength === input.byte_count
        && `sha256:${createHash("sha256").update(existing).digest("hex")}` === input.sha256;
    } catch {
      validExisting = false;
    }
    const filePath = validExisting
      ? destination
      : await writeVerifiedFile(
          directory,
          fileName,
          await downloadXuanyuanCloudInput(credential, job, input.input_id),
          input.sha256,
          input.byte_count,
        );
    refs.push({
      id: input.input_id,
      kind: input.kind,
      summary: input.summary,
      filePath,
      fileName,
      mimeType: input.mime_type,
      sha256: input.sha256,
      byteCount: input.byte_count,
    });
  }
  const expectedNames = new Set(normalizedNames);
  const actualNames = await readdir(directory);
  if (
    actualNames.length !== expectedNames.size
    || actualNames.some((name) => !expectedNames.has(name))
  ) {
    throw new Error("XUANYUAN_CLOUD_STAGING_MEMBERSHIP_INVALID");
  }
  return refs;
}

export async function stageXuanyuanCloudJob(
  dataDir: string,
  credential: XuanyuanCloudCredential,
  job: XuanyuanCloudClaimedJob,
): Promise<XuanyuanRequest> {
  const refs = await stageCloudInputRefs(dataDir, credential, job);
  return {
    requestId: job.job_id,
    sourceProject: "xuanxue-web-cloud",
    scenario: `${job.domain_id}_${job.stage}`,
    providerKind: "gpt-web-chat",
    promptPackageId: `xuanxue-web:${job.source_task_id}:${job.stage}:${job.attempt}`,
    promptContractId: job.prompt_contract_ref,
    expectedOutputSchemaRef: job.output_schema_ref,
    textPrompt: job.prompt_text,
    payloadJson: {
      domain_id: job.domain_id,
      input_bundle_ref: job.input_bundle_ref,
      input_bundle_hash: job.input_bundle_hash,
      stage: job.stage,
      attempt: job.attempt,
      payload: job.payload_json,
      cloud_job_id: job.job_id,
      cloud_request_hash: job.request_hash,
    },
    inputRefs: refs,
    timeoutMs: 3_600_000,
    maxInputChars: Math.max(120_000, job.prompt_text.length),
    maxFileCount: job.inputs.length,
    maxFileBytes: Math.max(1, ...job.inputs.map((input) => input.byte_count)),
    ...(job.continuation
      ? {
          continuationTaskId: job.continuation.provider_execution_ref,
          continuationResponseHash: job.continuation.raw_response_hash.replace(/^sha256:/u, ""),
        }
      : {}),
  };
}

export async function cleanXuanyuanCloudJobStaging(
  dataDir: string,
  jobId: string,
): Promise<void> {
  const directory = path.dirname(stagingDirectory(dataDir, jobId));
  await rm(directory, { recursive: true, force: true });
}
