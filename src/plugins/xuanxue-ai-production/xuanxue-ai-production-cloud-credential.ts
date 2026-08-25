import { randomUUID } from "node:crypto";
import type { Stats } from "node:fs";
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
  environment_id: z.literal("production"),
  origin: z.string().url(),
  device_id: z.string().min(1),
  device_epoch: z.number().int().positive(),
  credential: z.string().regex(/^aidc_v6_[A-Za-z0-9_-]{32,}$/u),
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

const validOwnedFile = (metadata: Stats, currentUid: number | undefined): boolean =>
  metadata.isFile()
  && !metadata.isSymbolicLink()
  && (metadata.mode & 0o077) === 0
  && (currentUid === undefined || metadata.uid === currentUid);

const readCredentialFile = async (filePath: string): Promise<string> => {
  const parentPath = path.dirname(filePath);
  const [linkMetadata, metadata, parentLinkMetadata, parentMetadata] = await Promise.all([
    lstat(filePath), stat(filePath), lstat(parentPath), stat(parentPath),
  ]);
  const currentUid = process.getuid?.();
  const identitiesMatch = linkMetadata.dev === metadata.dev && linkMetadata.ino === metadata.ino
    && parentLinkMetadata.dev === parentMetadata.dev && parentLinkMetadata.ino === parentMetadata.ino;
  const parentOwned = parentMetadata.isDirectory() && (parentMetadata.mode & 0o077) === 0
    && (currentUid === undefined || parentMetadata.uid === currentUid);
  if (linkMetadata.isSymbolicLink() || parentLinkMetadata.isSymbolicLink()
    || !validOwnedFile(metadata, currentUid) || !parentOwned || !identitiesMatch) throw permissionsInvalid();
  return readFile(filePath, "utf8");
};

const assertExistingCredentialFile = async (destination: string): Promise<void> => {
  try {
    const existing = await lstat(destination);
    if (!validOwnedFile(existing, process.getuid?.())) throw permissionsInvalid();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
};

const writeTemporaryCredential = async (
  temporary: string,
  credential: XuanxueAiProductionCloudCredential,
): Promise<void> => {
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(credential, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
};

const syncCredentialDirectory = async (directory: string): Promise<void> => {
  const handle = await open(directory, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
};

const installTemporaryCredential = async (
  temporary: string,
  destination: string,
  parent: string,
  parentIdentity: Readonly<{ dev: number; ino: number }>,
): Promise<void> => {
  const temporaryMetadata = await lstat(temporary);
  const currentUid = process.getuid?.();
  const currentParent = await assertOwnedDirectory(parent);
  if (!validOwnedFile(temporaryMetadata, currentUid)
    || currentParent.dev !== parentIdentity.dev || currentParent.ino !== parentIdentity.ino) throw permissionsInvalid();
  await rename(temporary, destination);
  if (!validOwnedFile(await lstat(destination), currentUid)) throw permissionsInvalid();
  await syncCredentialDirectory(parent);
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
  const raw = JSON.parse(await readCredentialFile(filePath)) as Record<string, unknown>;
  if (raw.protocol_version !== XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION) {
    throw new Error("XUANXUE_AI_PRODUCTION_CREDENTIAL_REENROLLMENT_REQUIRED");
  }
  const parsed = credentialSchema.parse(raw);
  const server = new URL(parsed.server_base_url);
  const origin = new URL(parsed.origin);
  const serverAllowed = server.protocol === "https:" || (server.protocol === "http:" && server.hostname === "127.0.0.1");
  const originAllowed = origin.protocol === "https:" || (origin.protocol === "http:" && origin.hostname === "127.0.0.1");
  if (!serverAllowed || !originAllowed) {
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
  await assertExistingCredentialFile(destination);
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  await writeTemporaryCredential(temporary, parsed);
  try {
    await installTemporaryCredential(temporary, destination, parent, parentIdentity);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}
