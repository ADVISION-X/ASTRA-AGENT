import path from "node:path";

import {
  XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION,
  type XuanxueAiProductionCloudCredential,
} from "./xuanxue-ai-production-cloud-contract.js";
import {
  xuanxueAiProductionDeviceContractProof,
} from "./xuanxue-ai-production-cloud-client.js";
import {
  isExactXuanxueLocalizationProductContractMap,
} from "./xuanxue-ai-production-localization-contract.js";
import {
  writeXuanxueAiProductionCloudCredential,
  xuanxueAiProductionCloudCredentialPath,
} from "./xuanxue-ai-production-cloud-credential.js";

interface EnrollmentEnvelope {
  readonly ok?: boolean;
  readonly data?: {
    readonly device?: {
      readonly device_id?: string;
      readonly device_name?: string;
      readonly max_in_flight?: number;
      readonly contract_manifest_hash?: string;
      readonly supported_product_contracts?: Record<string, string>;
      readonly agent_build_fingerprint?: string;
    };
    readonly credential?: string;
  };
  readonly error?: { readonly code?: string; readonly message?: string };
}

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`XUANXUE_AI_PRODUCTION_ENROLLMENT_REQUIRED:${name}`);
  }
  return value;
};

const enrollmentConfig = () => {
  const maxInFlight = Number(process.env.XUANXUE_AI_PRODUCTION_MAX_IN_FLIGHT ?? "1");
  if (maxInFlight !== 1) {
    throw new Error("XUANXUE_AI_PRODUCTION_MAX_IN_FLIGHT_INVALID");
  }
  return {
    serverBaseUrl: required("XUANXUE_AI_PRODUCTION_CLOUD_BASE_URL").replace(/\/+$/u, ""),
    deviceName: required("XUANXUE_AI_PRODUCTION_DEVICE_NAME"),
    enrollmentToken: required("XUANXUE_AI_PRODUCTION_ENROLLMENT_TOKEN"),
    maxInFlight,
  };
};

const assertEnrollmentResponse = (input: {
  response: Response;
  body: EnrollmentEnvelope;
  contractProof: ReturnType<typeof xuanxueAiProductionDeviceContractProof>;
}): { device: NonNullable<NonNullable<EnrollmentEnvelope["data"]>["device"]>; credential: string } => {
  const device = input.body.data?.device;
  const credential = input.body.data?.credential;
  const valid = input.response.ok
    && input.body.ok === true
    && Boolean(device?.device_id)
    && Boolean(device?.device_name)
    && Boolean(device?.max_in_flight)
    && Boolean(credential)
    && device?.contract_manifest_hash === input.contractProof.contract_manifest_hash
    && isExactXuanxueLocalizationProductContractMap(
      device?.supported_product_contracts,
    );
  if (!valid || !device || !credential) {
    throw new Error(
      `XUANXUE_AI_PRODUCTION_ENROLLMENT_FAILED:`
      + `${input.body.error?.code ?? input.response.status}:`
      + `${input.body.error?.message ?? "contract proof mismatch"}`,
    );
  }
  return { device, credential };
};

export async function enrollXuanxueAiProductionCloudDevice(input?: {
  readonly dataDir?: string;
}): Promise<{ readonly deviceId: string; readonly credentialPath: string }> {
  const config = enrollmentConfig();
  const contractProof = xuanxueAiProductionDeviceContractProof();
  const response = await fetch(
    `${config.serverBaseUrl}/internal/ai-production/devices/enroll`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ai-enrollment-token": config.enrollmentToken,
      },
      body: JSON.stringify({
        device_name: config.deviceName,
        capabilities: ["xuanxue_ai_production"],
        max_in_flight: config.maxInFlight,
        ...contractProof,
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  const body = await response.json() as EnrollmentEnvelope;
  const { device, credential: credentialValue } = assertEnrollmentResponse({ response, body, contractProof });
  const dataDir = path.resolve(
    input?.dataDir
    ?? process.env.GRASSEYE_DATA_DIR
    ?? path.join(process.cwd(), ".grasseye-local"),
  );
  const credential: XuanxueAiProductionCloudCredential = {
    protocol_version: XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION,
    server_base_url: config.serverBaseUrl,
    device_id: device.device_id!,
    device_name: device.device_name!,
    credential: credentialValue,
    max_in_flight: device.max_in_flight!,
    enrolled_at: new Date().toISOString(),
  };
  await writeXuanxueAiProductionCloudCredential(dataDir, credential);
  return {
    deviceId: credential.device_id,
    credentialPath: xuanxueAiProductionCloudCredentialPath(dataDir),
  };
}
