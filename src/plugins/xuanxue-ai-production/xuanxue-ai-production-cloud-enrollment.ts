import path from "node:path";

import {
  XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION,
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
      readonly device_name?: string;
      readonly max_in_flight?: number;
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

export async function enrollXuanxueAiProductionCloudDevice(input?: {
  readonly dataDir?: string;
}): Promise<{ readonly deviceId: string; readonly credentialPath: string }> {
  const serverBaseUrl = required(
    "XUANXUE_AI_PRODUCTION_CLOUD_BASE_URL",
  ).replace(/\/+$/u, "");
  const deviceName = required("XUANXUE_AI_PRODUCTION_DEVICE_NAME");
  const enrollmentToken = required(
    "XUANXUE_AI_PRODUCTION_ENROLLMENT_TOKEN",
  );
  const maxInFlight = Number(
    process.env.XUANXUE_AI_PRODUCTION_MAX_IN_FLIGHT ?? "10",
  );
  if (!Number.isInteger(maxInFlight) || maxInFlight < 1 || maxInFlight > 64) {
    throw new Error("XUANXUE_AI_PRODUCTION_MAX_IN_FLIGHT_INVALID");
  }
  const response = await fetch(
    `${serverBaseUrl}/internal/ai-production/devices/enroll`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ai-enrollment-token": enrollmentToken,
      },
      body: JSON.stringify({
        device_name: deviceName,
        capabilities: ["xuanxue_ai_production"],
        max_in_flight: maxInFlight,
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  const body = await response.json() as EnrollmentEnvelope;
  const device = body.data?.device;
  const credentialValue = body.data?.credential;
  if (
    !response.ok
    || body.ok !== true
    || !device?.device_id
    || !device.device_name
    || !device.max_in_flight
    || !credentialValue
  ) {
    throw new Error(
      `XUANXUE_AI_PRODUCTION_ENROLLMENT_FAILED:`
      + `${body.error?.code ?? response.status}:`
      + `${body.error?.message ?? "unknown"}`,
    );
  }
  const dataDir = path.resolve(
    input?.dataDir
    ?? process.env.GRASSEYE_DATA_DIR
    ?? path.join(process.cwd(), ".grasseye-local"),
  );
  const credential: XuanxueAiProductionCloudCredential = {
    protocol_version: XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION,
    server_base_url: serverBaseUrl,
    device_id: device.device_id,
    device_name: device.device_name,
    credential: credentialValue,
    max_in_flight: device.max_in_flight,
    enrolled_at: new Date().toISOString(),
  };
  await writeXuanxueAiProductionCloudCredential(dataDir, credential);
  return {
    deviceId: credential.device_id,
    credentialPath: xuanxueAiProductionCloudCredentialPath(dataDir),
  };
}
