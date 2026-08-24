import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import {
  XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION,
  type XuanxueAiProductionCloudCredential,
} from "./xuanxue-ai-production-cloud-contract.js";

const credentialSchema = z.object({
  protocol_version: z.literal(
    XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION,
  ),
  server_base_url: z.string().url(),
  environment_id: z.enum(["production", "isolated-test"]),
  origin: z.string().url(),
  device_id: z.string().min(1),
  device_epoch: z.number().int().positive(),
  credential: z.string().regex(/^aidc_v6_[A-Za-z0-9_-]{32,}$/u),
  agent_build_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/u).transform((value): `sha256:${string}` => value as `sha256:${string}`),
  control_manifest_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/u).transform((value): `sha256:${string}` => value as `sha256:${string}`),
  enrolled_at: z.string().min(1),
}).strict();

const permissionsInvalid = (): Error =>
  new Error("XUANXUE_AI_PRODUCTION_CREDENTIAL_PERMISSIONS_INVALID");

const assertOwnedDirectory = async (directory: string): Promise<Readonly<{ dev: number; ino: number }>> => {
  const metadata = await lstat(directory);
  const currentUid = process.getuid?.();
  if (metadata.isSymbolicLink() || !metadata.isDirectory()
    || (metadata.mode & 0o077) !== 0
    || (currentUid !== undefined && metadata.uid !== currentUid)) throw permissionsInvalid();
  return { dev: metadata.dev, ino: metadata.ino };
};

const ensureCredentialDirectory = async (directory: string): Promise<Readonly<{ dev: number; ino: number }>> => {
  const absolute = path.resolve(directory);
  const missing: string[] = [];
  let cursor = absolute;
  while (true) {
    try {
      const metadata = await lstat(cursor);
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw permissionsInvalid();
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw permissionsInvalid();
      missing.push(path.basename(cursor));
      cursor = parent;
    }
  }
  for (const segment of missing.reverse()) {
    cursor = path.join(cursor, segment);
    await mkdir(cursor, { mode: 0o700 });
    const created = await lstat(cursor);
    if (created.isSymbolicLink() || !created.isDirectory()) throw permissionsInvalid();
  }
  return assertOwnedDirectory(absolute);
};

export const xuanxueAiProductionCloudCredentialPath = (
  dataDir: string,
): string => process.env.XUANXUE_AI_PRODUCTION_CREDENTIAL_FILE?.trim()
  || path.join(
    dataDir,
    "runtime-data",
    "xuanxue-ai-production",
    "cloud-device-credential.json",
  );

export async function readXuanxueAiProductionCloudCredential(
  dataDir: string,
): Promise<XuanxueAiProductionCloudCredential> {
  const filePath = xuanxueAiProductionCloudCredentialPath(dataDir);
  const parentPath = path.dirname(filePath);
  const [linkMetadata, metadata, parentLinkMetadata, parentMetadata] = await Promise.all([
    lstat(filePath), stat(filePath), lstat(parentPath), stat(parentPath),
  ]);
  const currentUid = process.getuid?.();
  if (linkMetadata.isSymbolicLink() || parentLinkMetadata.isSymbolicLink()
    || !metadata.isFile() || !parentMetadata.isDirectory()
    || linkMetadata.dev !== metadata.dev || linkMetadata.ino !== metadata.ino
    || parentLinkMetadata.dev !== parentMetadata.dev || parentLinkMetadata.ino !== parentMetadata.ino
    || (metadata.mode & 0o077) !== 0 || (parentMetadata.mode & 0o077) !== 0
    || (currentUid !== undefined && (metadata.uid !== currentUid || parentMetadata.uid !== currentUid))) {
    throw permissionsInvalid();
  }
  const raw = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
  if (raw.protocol_version !== XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION) {
    throw new Error("XUANXUE_AI_PRODUCTION_CREDENTIAL_REENROLLMENT_REQUIRED");
  }
  const parsed = credentialSchema.parse(raw);
  if (parsed.environment_id === "production"
    && (new URL(parsed.server_base_url).protocol !== "https:"
      || new URL(parsed.origin).protocol !== "https:")) {
    throw new Error("XUANXUE_AI_PRODUCTION_PRODUCTION_ORIGIN_INVALID");
  }
  return parsed;
}

export async function writeXuanxueAiProductionCloudCredential(
  dataDir: string,
  credential: XuanxueAiProductionCloudCredential,
): Promise<void> {
  const parsed = credentialSchema.parse(credential);
  const destination = xuanxueAiProductionCloudCredentialPath(dataDir);
  const parent = path.dirname(destination);
  const parentIdentity = await ensureCredentialDirectory(parent);
  try {
    const existing = await lstat(destination);
    const currentUid = process.getuid?.();
    if (existing.isSymbolicLink() || !existing.isFile()
      || (existing.mode & 0o077) !== 0
      || (currentUid !== undefined && existing.uid !== currentUid)) throw permissionsInvalid();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    const temporaryMetadata = await lstat(temporary);
    const currentUid = process.getuid?.();
    const currentParent = await assertOwnedDirectory(parent);
    if (!temporaryMetadata.isFile() || temporaryMetadata.isSymbolicLink()
      || (temporaryMetadata.mode & 0o077) !== 0
      || (currentUid !== undefined && temporaryMetadata.uid !== currentUid)
      || currentParent.dev !== parentIdentity.dev || currentParent.ino !== parentIdentity.ino) throw permissionsInvalid();
    await rename(temporary, destination);
    const destinationMetadata = await lstat(destination);
    if (!destinationMetadata.isFile() || destinationMetadata.isSymbolicLink()
      || (destinationMetadata.mode & 0o077) !== 0
      || (currentUid !== undefined && destinationMetadata.uid !== currentUid)) throw permissionsInvalid();
    const directoryHandle = await open(parent, "r");
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}
