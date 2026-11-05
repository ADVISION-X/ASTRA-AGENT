import { randomUUID } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ASTRA_DATA_DIRECTORY, ASTRA_LOCAL_ORIGIN } from "../../browser/profile/browser-application-identity.js";

import {
  AiProductionErrorEnvelopeSchema,
  DeviceCredentialSchema,
  type DeviceCredential,
} from "./transport-protocol.js";
import { executionFailure } from "../../execution-failure.js";

export const productionCredentialPath = (dataDir: string): string =>
  process.env.AGENT_PRODUCTION_CREDENTIAL_FILE?.trim()
  || path.join(dataDir, "runtime-data", "production-runtime", "device-credential.json");

const errno = (error: unknown): string | null =>
  error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code : null;

const credentialFailure = (code: string, cause?: unknown): never => {
  throw executionFailure("failed", code, cause === undefined ? {} : { cause });
};

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
  catch (error) { return credentialFailure("PRODUCTION_CREDENTIAL_JSON_INVALID", error); }
};

const parseCredentialUrl = (value: string): URL => {
  try { return new URL(value); }
  catch (error) { return credentialFailure("PRODUCTION_CREDENTIAL_ORIGIN_INVALID", error); }
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
    if (!opened.isFile() || opened.dev !== expected.dev || opened.ino !== expected.ino
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
  if (!file.isFile() || (file.mode & 0o077) !== 0 || (uid !== undefined && file.uid !== uid)) {
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

const assertCredentialOrigins = (credential: DeviceCredential): void => {
  const server = parseCredentialUrl(credential.server_base_url);
  const origin = parseCredentialUrl(credential.origin);
  const serverValid = server.protocol === "https:"
    || (server.protocol === "http:" && server.hostname === "127.0.0.1");
  const originValid = origin.protocol === "https:"
    || (origin.protocol === "http:" && origin.hostname === "127.0.0.1");
  if (!serverValid || !originValid || credential.origin !== ASTRA_LOCAL_ORIGIN) credentialFailure("PRODUCTION_CREDENTIAL_ORIGIN_INVALID");
  const configuredServer = process.env.AGENT_PRODUCTION_CLOUD_BASE_URL?.trim();
  if (configuredServer && server.href.replace(/\/+$/u, "") !== parseCredentialUrl(configuredServer).href.replace(/\/+$/u, "")) {
    credentialFailure("PRODUCTION_CREDENTIAL_ORIGIN_INVALID");
  }
};

const readProductionCredentialValue = async (dataDir: string): Promise<unknown> => {
  const filePath = productionCredentialPath(dataDir);
  const parent = await credentialMetadata(path.dirname(filePath),
    "PRODUCTION_CREDENTIAL_PARENT_MISSING", "PRODUCTION_CREDENTIAL_PARENT_UNREADABLE");
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
      origin_allowlist: z.array(z.string().url()).min(1),
    }).passthrough(),
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

const assertEnrollmentDoesNotReplaceCredential = async (dataDir: string): Promise<void> => {
  try {
    await lstat(productionCredentialPath(dataDir));
    throw new Error("PRODUCTION_DEVICE_ALREADY_ENROLLED");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
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
  const dataDir = path.resolve(input?.dataDir ?? process.env.GRASSEYE_DATA_DIR ?? path.join(process.cwd(), ASTRA_DATA_DIRECTORY));
  await assertEnrollmentDoesNotReplaceCredential(dataDir);
  const serverBaseUrl = assertProductionUrl(requiredEnvironment("AGENT_PRODUCTION_CLOUD_BASE_URL"));
  const origin = assertProductionUrl(
    process.env.AGENT_PRODUCTION_AGENT_ORIGIN?.trim() || ASTRA_LOCAL_ORIGIN,
  );
  if (origin !== ASTRA_LOCAL_ORIGIN) throw new Error("PRODUCTION_ORIGIN_INVALID");
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
  if (!response.ok || !envelope.ok) {
    throw new Error(`PRODUCTION_ENROLLMENT_FAILED:${envelope.ok ? response.status : envelope.error.code}`);
  }
  const device = envelope.data.device;
  const credentialValue = envelope.data.device_credential;
  if (!device.origin_allowlist.includes(origin)) throw new Error("PRODUCTION_ENROLLMENT_ORIGIN_MISMATCH");
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
