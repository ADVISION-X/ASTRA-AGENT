import path from "node:path";
import {
  XUANYUAN_CLOUD_PROTOCOL_VERSION,
  type XuanyuanCloudCredential,
} from "./xuanyuan-cloud-contract.js";
import { writeXuanyuanCloudCredential } from "./xuanyuan-cloud-credential.js";

interface EnrollmentEnvelope {
  ok?: boolean;
  data?: {
    device?: {
      device_id?: string;
      device_name?: string;
      max_in_flight?: number;
    };
    credential?: string;
  };
  error?: { code?: string; message?: string };
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`XUANYUAN_CLOUD_ENROLLMENT_REQUIRED:${name}`);
  return value;
}

export async function enrollXuanyuanCloudDevice(input?: {
  dataDir?: string;
}): Promise<{ deviceId: string; credentialPath: string }> {
  const serverBaseUrl = required("XUANYUAN_CLOUD_BASE_URL").replace(/\/+$/u, "");
  const deviceName = required("XUANYUAN_CLOUD_DEVICE_NAME");
  const enrollmentToken = required("XUANYUAN_CLOUD_ENROLLMENT_TOKEN");
  const maxInFlight = Number(process.env.XUANYUAN_CLOUD_MAX_IN_FLIGHT ?? "10");
  if (!Number.isInteger(maxInFlight) || maxInFlight < 1 || maxInFlight > 64) {
    throw new Error("XUANYUAN_CLOUD_MAX_IN_FLIGHT_INVALID");
  }
  const response = await fetch(`${serverBaseUrl}/internal/ai-acceptance/devices/enroll`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ai-enrollment-token": enrollmentToken,
    },
    body: JSON.stringify({
      device_name: deviceName,
      capabilities: ["local_gpt_web"],
      max_in_flight: maxInFlight,
    }),
    signal: AbortSignal.timeout(30_000),
  });
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
      `XUANYUAN_CLOUD_ENROLLMENT_FAILED:${body.error?.code ?? response.status}:${body.error?.message ?? "unknown"}`,
    );
  }
  const dataDir = path.resolve(
    input?.dataDir
    ?? process.env.GRASSEYE_DATA_DIR
    ?? path.join(process.cwd(), ".grasseye-local"),
  );
  const credential: XuanyuanCloudCredential = {
    protocol_version: XUANYUAN_CLOUD_PROTOCOL_VERSION,
    server_base_url: serverBaseUrl,
    device_id: device.device_id,
    device_name: device.device_name,
    credential: credentialValue,
    max_in_flight: device.max_in_flight,
    enrolled_at: new Date().toISOString(),
  };
  await writeXuanyuanCloudCredential(dataDir, credential);
  return {
    deviceId: credential.device_id,
    credentialPath:
      process.env.XUANYUAN_CLOUD_CREDENTIAL_FILE?.trim()
      ?? path.join(dataDir, "runtime-data", "xuanyuan", "cloud-device-credential.json"),
  };
}
