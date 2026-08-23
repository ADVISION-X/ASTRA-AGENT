import { randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  stat,
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
  const [linkMetadata, metadata, parentMetadata] = await Promise.all([
    lstat(filePath), stat(filePath), stat(path.dirname(filePath)),
  ]);
  const currentUid = process.getuid?.();
  if (linkMetadata.isSymbolicLink() || !metadata.isFile()
    || (metadata.mode & 0o077) !== 0 || (parentMetadata.mode & 0o077) !== 0
    || (currentUid !== undefined && (metadata.uid !== currentUid || parentMetadata.uid !== currentUid))) {
    throw new Error(
      "XUANXUE_AI_PRODUCTION_CREDENTIAL_PERMISSIONS_INVALID",
    );
  }
  const parsed = credentialSchema.parse(JSON.parse(await readFile(filePath, "utf8")));
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
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(destination), 0o700);
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(temporary, 0o600);
  await rename(temporary, destination);
  await chmod(destination, 0o600);
}
