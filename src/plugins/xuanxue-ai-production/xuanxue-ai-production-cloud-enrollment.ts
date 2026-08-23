import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import {
  XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION,
  XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
  type XuanxueAiProductionCloudCredential,
} from "./xuanxue-ai-production-cloud-contract.js";
import {
  writeXuanxueAiProductionCloudCredential,
  xuanxueAiProductionCloudCredentialPath,
} from "./xuanxue-ai-production-cloud-credential.js";

interface EnrollmentEnvelope {
  readonly ok?: boolean;
  readonly data?: {
    readonly device?: {
      readonly device_id?: string;
      readonly environment_id?: "production" | "isolated-test";
      readonly device_epoch?: number;
      readonly status?: "active" | "revoked";
      readonly origin_allowlist?: readonly string[];
      readonly control_contract_manifest_hash?: string;
      readonly agent_build_hash?: string;
    };
    readonly device_credential?: string;
  };
  readonly error?: { readonly code?: string; readonly message?: string };
}

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`XUANXUE_AI_PRODUCTION_ENROLLMENT_REQUIRED:${name}`);
  return value;
};

export const xuanxueAiProductionAgentBuildHash = (): `sha256:${string}` => {
  const identity = process.env.GRASSEYE_SOURCE_FINGERPRINT?.trim()
    || process.env.npm_package_version?.trim()
    || "grasseye-agent-v6";
  return `sha256:${createHash("sha256").update(identity).digest("hex")}`;
};

const enrollmentConfig = () => {
  const environmentId = required("XUANXUE_AI_PRODUCTION_ENVIRONMENT_ID");
  if (environmentId !== "production" && environmentId !== "isolated-test") throw new Error("XUANXUE_AI_PRODUCTION_ENVIRONMENT_INVALID");
  const origin = new URL(required("XUANXUE_AI_PRODUCTION_AGENT_ORIGIN")).origin;
  if (environmentId === "production" && !origin.startsWith("https://")) throw new Error("XUANXUE_AI_PRODUCTION_PRODUCTION_ORIGIN_NOT_HTTPS");
  return {
    serverBaseUrl: required("XUANXUE_AI_PRODUCTION_CLOUD_BASE_URL").replace(/\/+$/u, ""),
    environmentId,
    origin,
    enrollmentToken: required("XUANXUE_AI_PRODUCTION_ENROLLMENT_TOKEN"),
    agentBuildHash: xuanxueAiProductionAgentBuildHash(),
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
      agent_build_hash: config.agentBuildHash,
      control_manifest_hash: XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json() as EnrollmentEnvelope;
  const device = body.data?.device;
  const credentialValue = body.data?.device_credential;
  if (!response.ok || body.ok !== true || !device?.device_id || !credentialValue
    || device.environment_id !== config.environmentId || device.device_epoch !== 1
    || device.control_contract_manifest_hash !== XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH
    || device.agent_build_hash !== config.agentBuildHash
    || !device.origin_allowlist?.includes(config.origin)) {
    throw new Error(`XUANXUE_AI_PRODUCTION_ENROLLMENT_FAILED:${body.error?.code ?? response.status}:${body.error?.message ?? "V6 identity mismatch"}`);
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
    agent_build_hash: config.agentBuildHash,
    control_manifest_hash: XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
    enrolled_at: new Date().toISOString(),
  };
  await writeXuanxueAiProductionCloudCredential(dataDir, credential);
  return { deviceId: credential.device_id, credentialPath: xuanxueAiProductionCloudCredentialPath(dataDir) };
}
