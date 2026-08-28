import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import {
  DeviceCredentialSchema,
  PRODUCTION_V6_MANIFEST_HASH,
  type DeviceCredential,
} from "./transport-protocol.js";

export const productionCredentialPath = (dataDir: string): string =>
  process.env.AGENT_PRODUCTION_CREDENTIAL_FILE?.trim()
  || path.join(dataDir, "runtime-data", "production-runtime", "device-credential.json");

export async function readProductionCredential(dataDir: string): Promise<DeviceCredential> {
  const filePath = productionCredentialPath(dataDir);
  const [file, parent] = await Promise.all([lstat(filePath), lstat(path.dirname(filePath))]);
  const uid = process.getuid?.();
  if (!file.isFile() || file.isSymbolicLink() || (file.mode & 0o077) !== 0
    || !parent.isDirectory() || parent.isSymbolicLink() || (parent.mode & 0o077) !== 0
    || (uid !== undefined && (file.uid !== uid || parent.uid !== uid))) {
    throw new Error("PRODUCTION_CREDENTIAL_PERMISSIONS_INVALID");
  }
  const parsed = DeviceCredentialSchema.parse(JSON.parse(await readFile(filePath, "utf8")));
  const server = new URL(parsed.server_base_url);
  const origin = new URL(parsed.origin);
  if (!((server.protocol === "https:") || (server.protocol === "http:" && server.hostname === "127.0.0.1"))
    || !((origin.protocol === "https:") || (origin.protocol === "http:" && origin.hostname === "127.0.0.1"))) {
    throw new Error("PRODUCTION_ORIGIN_INVALID");
  }
  return parsed;
}

const EnrollmentEnvelopeSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    device: z.object({
      device_id: z.string().min(1),
      environment_id: z.literal("production"),
      device_epoch: z.number().int().positive(),
      status: z.literal("active"),
      origin_allowlist: z.array(z.string().url()).min(1),
      control_contract_manifest_hash: z.literal(PRODUCTION_V6_MANIFEST_HASH),
    }).passthrough(),
    device_credential: z.string().regex(/^aidc_v6_[A-Za-z0-9_-]{32,}$/u),
  }).strict().optional(),
  error: z.object({
    code: z.string().optional(),
    message: z.string().optional(),
  }).passthrough().optional(),
}).strict();

const requiredEnvironment = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`PRODUCTION_ENROLLMENT_REQUIRED:${name}`);
  return value;
};

const assertProductionUrl = (value: string): string => {
  const url = new URL(value);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "127.0.0.1")) {
    throw new Error("PRODUCTION_ORIGIN_INVALID");
  }
  return url.origin + url.pathname.replace(/\/+$/u, "");
};

const assertCredentialDestination = async (destination: string): Promise<string> => {
  const parent = path.dirname(destination);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const parentMetadata = await lstat(parent);
  const uid = process.getuid?.();
  if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink()
    || (parentMetadata.mode & 0o077) !== 0 || (uid !== undefined && parentMetadata.uid !== uid)) {
    throw new Error("PRODUCTION_CREDENTIAL_PERMISSIONS_INVALID");
  }
  try {
    const existing = await lstat(destination);
    if (!existing.isFile() || existing.isSymbolicLink() || (existing.mode & 0o077) !== 0
      || (uid !== undefined && existing.uid !== uid)) throw new Error("PRODUCTION_CREDENTIAL_PERMISSIONS_INVALID");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return parent;
};

const replaceCredentialFile = async (temporary: string, destination: string, parent: string): Promise<void> => {
  try {
    await rename(temporary, destination);
    const directory = await open(parent, "r");
    try { await directory.sync(); } finally { await directory.close(); }
  } catch (error) {
    try { await unlink(temporary); }
    catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "PRODUCTION_CREDENTIAL_CLEANUP_FAILED");
    }
    throw error;
  }
};

async function writeProductionCredential(dataDir: string, credential: DeviceCredential): Promise<string> {
  const parsed = DeviceCredentialSchema.parse(credential);
  const destination = productionCredentialPath(dataDir);
  const parent = await assertCredentialDestination(destination);
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await replaceCredentialFile(temporary, destination, parent);
  return destination;
}

export async function enrollProductionDevice(input?: Readonly<{
  dataDir?: string;
}>): Promise<Readonly<{ deviceId: string; credentialPath: string }>> {
  const serverBaseUrl = assertProductionUrl(requiredEnvironment("AGENT_PRODUCTION_CLOUD_BASE_URL"));
  const origin = assertProductionUrl(
    process.env.AGENT_PRODUCTION_AGENT_ORIGIN?.trim() || "http://127.0.0.1:4173",
  );
  const response = await fetch(`${serverBaseUrl}/internal/ai-production/v6/devices/enroll`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({
      schema_version: "xuanxue-ai-device-enrollment.v6",
      request_id: `aipenroll_${randomUUID()}`,
      environment_id: "production",
      enrollment_token: requiredEnvironment("AGENT_PRODUCTION_ENROLLMENT_TOKEN"),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const envelope = EnrollmentEnvelopeSchema.parse(await response.json() as unknown);
  const device = envelope.data?.device;
  const credentialValue = envelope.data?.device_credential;
  if (!response.ok || envelope.ok !== true || !device || !credentialValue
    || !device.origin_allowlist.includes(origin)) {
    throw new Error(`PRODUCTION_ENROLLMENT_FAILED:${envelope.error?.code ?? response.status}`);
  }
  const dataDir = path.resolve(input?.dataDir ?? process.env.GRASSEYE_DATA_DIR ?? path.join(process.cwd(), ".grasseye-local"));
  const credential: DeviceCredential = {
    protocol_version: "xuanxue-ai-production-v6",
    server_base_url: serverBaseUrl,
    environment_id: "production",
    origin,
    device_id: device.device_id,
    device_epoch: device.device_epoch,
    credential: credentialValue,
    control_manifest_hash: device.control_contract_manifest_hash,
    enrolled_at: new Date().toISOString(),
  };
  const credentialPath = await writeProductionCredential(dataDir, credential);
  return Object.freeze({ deviceId: credential.device_id, credentialPath });
}
