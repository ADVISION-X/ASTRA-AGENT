import { randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import {
  XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION,
  XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
  type XuanxueAiProductionCloudCredential,
} from "./xuanxue-ai-production-cloud-contract.js";
import {
  writeXuanxueAiProductionCloudCredential,
  xuanxueAiProductionCloudCredentialPath,
} from "./xuanxue-ai-production-cloud-credential.js";

const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const EnrollmentEnvelopeSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    device: z.object({
      device_id: z.string().min(1),
      environment_id: z.literal("production"),
      device_epoch: z.number().int().positive(),
      status: z.enum(["active", "revoked"]),
      origin_allowlist: z.array(z.string().url()).min(1),
      control_contract_manifest_hash: hashSchema,
    }).strict(),
    device_credential: z.string().min(1),
  }).strict().optional(),
  error: z.object({ code: z.string().min(1).optional() }).strict().optional(),
}).strict();

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`XUANXUE_AI_PRODUCTION_ENROLLMENT_REQUIRED:${name}`);
  return value;
};

const isProductionEndpoint = (value: string): boolean => {
  const url = new URL(value);
  return url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "127.0.0.1");
};

const enrollmentConfig = () => {
  const serverBaseUrl = required("XUANXUE_AI_PRODUCTION_CLOUD_BASE_URL").replace(/\/+$/u, "");
  const origin = new URL(process.env.XUANXUE_AI_PRODUCTION_AGENT_ORIGIN?.trim() || "http://127.0.0.1:4173").origin;
  if (!isProductionEndpoint(serverBaseUrl) || !isProductionEndpoint(origin)) throw new Error("XUANXUE_AI_PRODUCTION_PRODUCTION_ORIGIN_INVALID");
  return {
    serverBaseUrl,
    environmentId: "production" as const,
    origin,
    enrollmentToken: required("XUANXUE_AI_PRODUCTION_ENROLLMENT_TOKEN"),
  } as const;
};

export async function enrollXuanxueAiProductionCloudDevice(input?: {
  readonly dataDir?: string;
}): Promise<{ readonly deviceId: string; readonly credentialPath: string }> {
  const config = enrollmentConfig();
  const requestId = `aipenroll_${randomUUID()}`;
  const response = await fetch(`${config.serverBaseUrl}/internal/ai-production/v6/devices/enroll`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: config.origin },
    body: JSON.stringify({
      schema_version: "xuanxue-ai-device-enrollment.v6",
      request_id: requestId,
      environment_id: config.environmentId,
      enrollment_token: config.enrollmentToken,
      control_manifest_hash: XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = EnrollmentEnvelopeSchema.parse(await response.json() as unknown);
  const device = body.data?.device;
  const credentialValue = body.data?.device_credential;
  if (!response.ok || body.ok !== true || !device?.device_id || !credentialValue
    || device.environment_id !== config.environmentId || device.device_epoch !== 1
    || device.control_contract_manifest_hash !== XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH
    || !device.origin_allowlist?.includes(config.origin)) {
    throw new Error(`XUANXUE_AI_PRODUCTION_ENROLLMENT_FAILED:${body.error?.code ?? response.status}:V6_IDENTITY_MISMATCH`);
  }
  const dataDir = path.resolve(input?.dataDir ?? process.env.GRASSEYE_DATA_DIR ?? path.join(process.cwd(), ".grasseye-local"));
  const credential: XuanxueAiProductionCloudCredential = {
    protocol_version: XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION,
    server_base_url: config.serverBaseUrl,
    environment_id: config.environmentId,
    origin: config.origin,
    device_id: device.device_id,
    device_epoch: device.device_epoch,
    credential: credentialValue,
    control_manifest_hash: XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
    enrolled_at: new Date().toISOString(),
  };
  await writeXuanxueAiProductionCloudCredential(dataDir, credential);
  return { deviceId: credential.device_id, credentialPath: xuanxueAiProductionCloudCredentialPath(dataDir) };
}
