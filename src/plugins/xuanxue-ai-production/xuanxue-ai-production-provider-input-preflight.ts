import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { z } from "zod";

import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const MAX_FILES_PER_UPLOAD = 10;

const PreflightFileSchema = z.object({
  input_id: z.string().min(1).max(500),
  ordinal: z.number().int().nonnegative(),
  file_name: z.string().min(1).max(255),
  mime_type: z.enum(["application/json", "text/markdown", "text/plain"]),
  sha256: z.string().regex(SHA256_PATTERN),
  byte_count: z.number().int().positive(),
  bytes_base64: z.string().min(1),
}).strict();

export const XuanxueProviderInputPreflightRequestSchema = z.object({
  schema_version: z.literal("xuanxue-ai-production-provider-input-preflight-request.v1"),
  source_task_id: z.string().min(1).max(180),
  input_set_hash: z.string().regex(SHA256_PATTERN),
  files: z.array(PreflightFileSchema).min(1).max(MAX_FILES_PER_UPLOAD),
}).strict().superRefine((value, context) => {
  value.files.forEach((file, index) => {
    if (file.ordinal !== index) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["files", index, "ordinal"],
        message: "XUANXUE_PROVIDER_PREFLIGHT_FILE_ORDINAL_INVALID",
      });
    }
    if (path.basename(file.file_name) !== file.file_name) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["files", index, "file_name"],
        message: "XUANXUE_PROVIDER_PREFLIGHT_FILE_NAME_INVALID",
      });
    }
  });
});

const sha256 = (value: string | Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const canonical = (value: unknown): unknown => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonical(child)]))
    : value;

const hashCanonical = (value: unknown): `sha256:${string}` =>
  sha256(JSON.stringify(canonical(value)));

const decodeFile = (input: z.infer<typeof PreflightFileSchema>): Buffer => {
  const bytes = Buffer.from(input.bytes_base64, "base64");
  if (bytes.byteLength !== input.byte_count || sha256(bytes) !== input.sha256) {
    throw new Error(`XUANXUE_PROVIDER_PREFLIGHT_FILE_INTEGRITY_INVALID:${input.input_id}`);
  }
  return bytes;
};

const readUtf8 = (bytes: Buffer, inputId: string): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`XUANXUE_PROVIDER_PREFLIGHT_FILE_UTF8_INVALID:${inputId}`);
  }
};

type PreflightRequest = z.infer<typeof XuanxueProviderInputPreflightRequestSchema>;
type PreparedFile = {
  file: PreflightRequest["files"][number];
  filePath: string;
};

const prepareFiles = async (
  request: PreflightRequest,
  directory: string,
): Promise<PreparedFile[]> => Promise.all(request.files.map(async (file) => {
  const bytes = decodeFile(file);
  readUtf8(bytes, file.input_id);
  const filePath = path.join(directory, `${String(file.ordinal).padStart(3, "0")}-${file.file_name}`);
  await writeFile(filePath, bytes, { flag: "wx", mode: 0o600 });
  const persisted = await readFile(filePath);
  if (persisted.byteLength !== bytes.byteLength || sha256(persisted) !== file.sha256) {
    throw new Error(`XUANXUE_PROVIDER_PREFLIGHT_STAGING_INTEGRITY_INVALID:${file.input_id}`);
  }
  return { file, filePath };
}));

const buildGatewayRequest = (request: PreflightRequest, prepared: PreparedFile[]) => ({
  providerKind: "gpt-web-chat" as const,
  taskIdentity: {
    labelKey: "seo_research" as const,
    sourceProject: "xuanxue-web",
    taskKind: "provider-input-preflight",
    sourceTaskId: request.source_task_id,
  },
  promptPackageId: `provider-input-preflight:${request.input_set_hash}`,
  promptContractId: "public-knowledge-provider-input-preflight.v1",
  expectedOutputSchemaRef: null,
  expectedOutputKind: "text" as const,
  textPrompt: "Provider input preflight only. Do not submit this prompt.",
  inputRefs: prepared.map(({ file, filePath }) => ({
    id: file.input_id,
    kind: "public_knowledge_provider_preflight_input",
    summary: "Frozen public knowledge corpus input for provider upload preflight",
    filePath,
    mimeType: file.mime_type,
    fileName: path.basename(filePath),
    sha256: file.sha256,
    byteCount: file.byte_count,
  })),
  modelName: null,
  timeoutMs: 3_600_000,
  maxInputChars: 1_000,
  maxFileCount: request.files.length,
  requestedBy: "ai-capability" as const,
  missionId: request.source_task_id,
  runId: request.source_task_id,
  roundId: "provider-input-preflight",
  conversationScopeRef: `provider-input-preflight:${request.source_task_id}`,
});

const assertUploadProof = (
  proof: Awaited<ReturnType<NonNullable<AiInputGatewayAbilityGroup["preflightApprovedWebChatFiles"]>>>["attachmentUploadProof"],
  expectedFileCount: number,
): void => {
  if (proof.status !== "attachments_stable"
    || proof.expectedFileCount !== expectedFileCount
    || proof.detectedFileCount !== expectedFileCount
    || proof.files.length !== expectedFileCount) {
    throw new Error("XUANXUE_PROVIDER_PREFLIGHT_UPLOAD_PROOF_INVALID");
  }
};

const buildReceiptFiles = (
  prepared: PreparedFile[],
  proof: Awaited<ReturnType<NonNullable<AiInputGatewayAbilityGroup["preflightApprovedWebChatFiles"]>>>["attachmentUploadProof"],
  proofHash: `sha256:${string}`,
) => prepared.map(({ file }, index) => {
  const actual = proof.files[index];
  if (!actual || actual.inputRefId !== file.input_id || actual.order !== index + 1
    || actual.sha256 !== file.sha256 || actual.byteCount !== file.byte_count) {
    throw new Error(`XUANXUE_PROVIDER_PREFLIGHT_UPLOAD_IDENTITY_INVALID:${file.input_id}`);
  }
  return {
    input_id: file.input_id,
    ordinal: file.ordinal,
    file_name: file.file_name,
    sha256: file.sha256,
    byte_count: file.byte_count,
    provider_receipt_ref: `chatgpt-web-upload:${proof.uploadAttemptId}:${proofHash}:${file.input_id}`,
  };
});

const providerProfile = {
  schema_version: "chatgpt-web-attachment-transport-profile.v1",
  provider: "chatgpt-web",
  transport: "browser_attachment_upload",
  max_files_per_upload: MAX_FILES_PER_UPLOAD,
  local_file_size_gate: "absent",
  local_token_gate: "absent",
  acceptance_authority: "real_chatgpt_window",
} as const;

export async function runXuanxueProviderInputPreflight(input: {
  rawInput: unknown;
  aiInputGateway: AiInputGatewayAbilityGroup;
}) {
  const request = XuanxueProviderInputPreflightRequestSchema.parse(input.rawInput);
  if (!input.aiInputGateway.preflightApprovedWebChatFiles) {
    throw new Error("XUANXUE_PROVIDER_PREFLIGHT_GATEWAY_UNAVAILABLE");
  }
  const directory = await mkdtemp(path.join(tmpdir(), "xuanxue-provider-preflight-"));
  try {
    const prepared = await prepareFiles(request, directory);
    const upload = await input.aiInputGateway.preflightApprovedWebChatFiles(
      buildGatewayRequest(request, prepared),
    );
    const proof = upload.attachmentUploadProof;
    assertUploadProof(proof, request.files.length);
    const proofHash = hashCanonical(proof);
    const files = buildReceiptFiles(prepared, proof, proofHash);
    return {
      schema_version: "xuanxue-ai-production-provider-input-preflight-result.v1" as const,
      status: "verified" as const,
      source_task_id: request.source_task_id,
      input_set_hash: request.input_set_hash,
      files,
      provider_profile_ref: "chatgpt-web:browser-attachment-upload:no-local-capacity-gate.v1",
      provider_profile_hash: hashCanonical(providerProfile),
      attachment_upload_proof: proof,
      attachment_upload_proof_hash: proofHash,
      issued_at: new Date().toISOString(),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
