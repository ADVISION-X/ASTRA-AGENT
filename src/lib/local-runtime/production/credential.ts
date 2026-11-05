import { randomUUID } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { link, lstat, mkdir, open, unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ASTRA_LOCAL_ORIGIN } from "../../browser/profile/browser-application-identity.js";

import {
  AiProductionErrorEnvelopeSchema,
  DeviceCredentialSchema,
  type DeviceCredential,
} from "./transport-protocol.js";
import { executionFailure } from "../../execution-failure.js";
import { resolveProductionLocalDataDir } from "../default-data-dir.js";

const ASTRA_WEBSITE_ORIGIN = "https://127.0.0.1:4343";

const errno = (error: unknown): string | null =>
  error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code : null;

const credentialFailure = (code: string, cause?: unknown): never => {
  throw executionFailure("failed", code, cause === undefined ? {} : { cause });
};

export function productionCredentialPath(dataDir: string): string {
  const expected = path.resolve(dataDir, "runtime-data", "production-runtime", "device-credential.json");
  const configured = process.env.AGENT_PRODUCTION_CREDENTIAL_FILE?.trim();
  if (configured && path.resolve(configured) !== expected) credentialFailure("PRODUCTION_CREDENTIAL_PATH_INVALID");
  return expected;
}

function assertCredentialOrigins(credential?: DeviceCredential): void {
  const cloud = process.env.AGENT_PRODUCTION_CLOUD_BASE_URL?.trim();
  const agent = process.env.AGENT_PRODUCTION_AGENT_ORIGIN?.trim();
  if (cloud !== ASTRA_WEBSITE_ORIGIN || (agent && agent !== ASTRA_LOCAL_ORIGIN)
    || (credential && (credential.server_base_url !== cloud || credential.origin !== ASTRA_LOCAL_ORIGIN))) {
    credentialFailure("PRODUCTION_CREDENTIAL_ORIGIN_INVALID");
  }
}

const credentialMetadata = async (
  filePath: string,
  missingCode: string,
  unreadableCode: string,
): Promise<Stats> => {
  try { return await lstat(filePath); }
  catch (error) {
    return credentialFailure(errno(error) === "ENOENT" ? missingCode : unreadableCode, error);
  }
};

const parseCredentialJson = (source: string): unknown => {
  try { return JSON.parse(source) as unknown; }
  catch { return credentialFailure("PRODUCTION_CREDENTIAL_JSON_INVALID"); }
};

const readCredentialFile = async (filePath: string, expected: Stats): Promise<string> => {
  let handle: Awaited<ReturnType<typeof open>>;
  try { handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW); }
  catch (error) {
    return credentialFailure(errno(error) === "ELOOP"
      ? "PRODUCTION_CREDENTIAL_SYMLINK_INVALID" : "PRODUCTION_CREDENTIAL_FILE_UNREADABLE", error);
  }
  try {
    const opened = await handle.stat();
    const uid = process.getuid?.();
    if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== expected.dev || opened.ino !== expected.ino
      || (opened.mode & 0o077) !== 0 || (uid !== undefined && opened.uid !== uid)) {
      credentialFailure("PRODUCTION_CREDENTIAL_FILE_PERMISSIONS_INVALID");
    }
    return await handle.readFile("utf8");
  } catch (error) {
    if (error instanceof Error && error.name === "TypedExecutionFailure") throw error;
    return credentialFailure("PRODUCTION_CREDENTIAL_FILE_UNREADABLE", error);
  } finally {
    await handle.close();
  }
};

const assertCredentialMetadata = (parent: Stats, file: Stats): void => {
  const uid = process.getuid?.();
  if (parent.isSymbolicLink() || file.isSymbolicLink()) {
    credentialFailure("PRODUCTION_CREDENTIAL_SYMLINK_INVALID");
  }
  if (!parent.isDirectory() || (parent.mode & 0o077) !== 0
    || (uid !== undefined && parent.uid !== uid)) {
    credentialFailure("PRODUCTION_CREDENTIAL_PARENT_PERMISSIONS_INVALID");
  }
  if (!file.isFile() || file.nlink !== 1 || (file.mode & 0o077) !== 0 || (uid !== undefined && file.uid !== uid)) {
    credentialFailure("PRODUCTION_CREDENTIAL_FILE_PERMISSIONS_INVALID");
  }
};

const parseProductionCredential = (value: unknown): DeviceCredential => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return credentialFailure("PRODUCTION_CREDENTIAL_SCHEMA_INVALID");
  }
  const result = DeviceCredentialSchema.safeParse(value);
  return result.success ? result.data : credentialFailure("PRODUCTION_CREDENTIAL_SCHEMA_INVALID");
};

const readProductionCredentialValue = async (dataDir: string): Promise<unknown> => {
  const filePath = productionCredentialPath(dataDir);
  const directory = path.dirname(filePath);
  const ancestor = await credentialMetadata(path.dirname(directory),
    "PRODUCTION_CREDENTIAL_PARENT_MISSING", "PRODUCTION_CREDENTIAL_PARENT_UNREADABLE");
  if (ancestor.isSymbolicLink()) credentialFailure("PRODUCTION_CREDENTIAL_SYMLINK_INVALID");
  if (!ancestor.isDirectory()) credentialFailure("PRODUCTION_CREDENTIAL_PARENT_PERMISSIONS_INVALID");
  const parent = await credentialMetadata(directory,
    "PRODUCTION_CREDENTIAL_PARENT_MISSING", "PRODUCTION_CREDENTIAL_PARENT_UNREADABLE");
  if (parent.isSymbolicLink()) credentialFailure("PRODUCTION_CREDENTIAL_SYMLINK_INVALID");
  const file = await credentialMetadata(filePath,
    "PRODUCTION_CREDENTIAL_MISSING", "PRODUCTION_CREDENTIAL_FILE_UNREADABLE");
  assertCredentialMetadata(parent, file);
  return parseCredentialJson(await readCredentialFile(filePath, file));
};

export async function readProductionCredential(dataDir: string): Promise<DeviceCredential> {
  const credential = parseProductionCredential(await readProductionCredentialValue(dataDir));
  assertCredentialOrigins(credential);
  return credential;
}

const EnrollmentSuccessEnvelopeSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    device: z.object({
      device_id: z.string().min(1),
      environment_id: z.literal("production"),
      device_epoch: z.number().int().positive(),
      status: z.literal("active"),
      origin_allowlist: z.array(z.string().url()).length(1),
      credential_revocation_epoch: z.number().int().nonnegative(),
    }).strict(),
    device_credential: z.string().regex(/^aidc_v6_[A-Za-z0-9_-]{32,}$/u),
  }).strict(),
}).strict();

const EnrollmentEnvelopeSchema = z.discriminatedUnion("ok", [
  EnrollmentSuccessEnvelopeSchema,
  AiProductionErrorEnvelopeSchema,
]);

const requiredEnvironment = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`PRODUCTION_ENROLLMENT_REQUIRED:${name}`);
  return value;
};

const prepareEnrollmentDestination = async (dataDir: string): Promise<string> => {
  const destination = productionCredentialPath(dataDir);
  const directory = path.dirname(destination);
  await ensureEnrollmentDirectory(dataDir);
  await ensureEnrollmentDirectory(path.dirname(directory));
  const parent = await ensureEnrollmentDirectory(directory);
  const uid = process.getuid?.();
  if ((parent.mode & 0o777) !== 0o700 || (uid !== undefined && parent.uid !== uid)) {
    credentialFailure("PRODUCTION_CREDENTIAL_PARENT_PERMISSIONS_INVALID");
  }
  try {
    await lstat(destination);
    credentialFailure("PRODUCTION_DEVICE_ALREADY_ENROLLED");
  } catch (error) {
    if (errno(error) !== "ENOENT") throw error;
  }
  return destination;
};

async function ensureEnrollmentDirectory(directory: string): Promise<Stats> {
  let metadata: Stats;
  try {
    metadata = await lstat(directory);
  } catch (error) {
    if (errno(error) !== "ENOENT") throw error;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    metadata = await lstat(directory);
  }
  if (metadata.isSymbolicLink()) credentialFailure("PRODUCTION_CREDENTIAL_SYMLINK_INVALID");
  if (!metadata.isDirectory()) credentialFailure("PRODUCTION_CREDENTIAL_PARENT_PERMISSIONS_INVALID");
  return metadata;
}

async function writeProductionCredential(dataDir: string, credential: DeviceCredential): Promise<string> {
  const parsed = DeviceCredentialSchema.parse(credential);
  const destination = await prepareEnrollmentDestination(dataDir);
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try {
    try {
      await handle.writeFile(`${JSON.stringify(parsed, null, 2)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await link(temporary, destination);
  } finally {
    await unlink(temporary);
  }
  const directory = await open(path.dirname(destination), "r");
  try { await directory.sync(); } finally { await directory.close(); }
  return destination;
}

export async function enrollProductionDevice(input: Readonly<{
  requestId: string;
  dataDir?: string;
}>): Promise<Readonly<{ deviceId: string; credentialPath: string }>> {
  const dataDir = resolveProductionLocalDataDir();
  if (input.dataDir !== undefined && path.resolve(input.dataDir) !== dataDir) {
    credentialFailure("PRODUCTION_CREDENTIAL_PATH_INVALID");
  }
  if (!/^aipenroll_[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u.test(input.requestId)) {
    credentialFailure("PRODUCTION_ENROLLMENT_REQUEST_INVALID");
  }
  assertCredentialOrigins();
  const enrollmentToken = requiredEnvironment("AGENT_PRODUCTION_ENROLLMENT_TOKEN");
  await prepareEnrollmentDestination(dataDir);
  const serverBaseUrl = ASTRA_WEBSITE_ORIGIN;
  const origin = ASTRA_LOCAL_ORIGIN;
  const response = await fetch(`${serverBaseUrl}/internal/ai-production/v6/devices/enroll`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({
      schema_version: "xuanxue-ai-device-enrollment.v6",
      request_id: input.requestId,
      environment_id: "production",
      enrollment_token: enrollmentToken,
    }),
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  const raw: unknown = await response.json().catch(() => credentialFailure("PRODUCTION_ENROLLMENT_RESULT_UNKNOWN"));
  const parsed = EnrollmentEnvelopeSchema.safeParse(raw);
  if (!parsed.success) return credentialFailure("PRODUCTION_ENROLLMENT_RESPONSE_INVALID");
  const envelope = parsed.data;
  if (!response.ok || !envelope.ok) {
    if (response.ok || envelope.ok) return credentialFailure("PRODUCTION_ENROLLMENT_RESPONSE_INVALID");
    return credentialFailure(response.status >= 500 ? "PRODUCTION_ENROLLMENT_RESULT_UNKNOWN" : "PRODUCTION_ENROLLMENT_DENIED");
  }
  const device = envelope.data.device;
  const credentialValue = envelope.data.device_credential;
  if (device.origin_allowlist[0] !== origin) return credentialFailure("PRODUCTION_ENROLLMENT_ORIGIN_MISMATCH");
  const credential: DeviceCredential = {
    protocol_version: "xuanxue-ai-production-v6",
    server_base_url: serverBaseUrl,
    environment_id: "production",
    origin,
    device_id: device.device_id,
    device_epoch: device.device_epoch,
    credential: credentialValue,
    enrolled_at: new Date().toISOString(),
  };
  const credentialPath = await writeProductionCredential(dataDir, credential);
  return Object.freeze({ deviceId: credential.device_id, credentialPath });
}
