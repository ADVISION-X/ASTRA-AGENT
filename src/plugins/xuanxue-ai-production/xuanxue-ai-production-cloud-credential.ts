import { randomUUID } from "node:crypto";
import {
  chmod,
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
  device_id: z.string().min(1),
  device_name: z.string().min(1),
  credential: z.string().regex(/^aidc_[A-Za-z0-9_-]{32,}$/u),
  max_in_flight: z.number().int().min(1).max(64),
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
  const metadata = await stat(filePath);
  if ((metadata.mode & 0o077) !== 0) {
    throw new Error(
      "XUANXUE_AI_PRODUCTION_CREDENTIAL_PERMISSIONS_INVALID",
    );
  }
  return credentialSchema.parse(JSON.parse(await readFile(filePath, "utf8")));
}

export async function writeXuanxueAiProductionCloudCredential(
  dataDir: string,
  credential: XuanxueAiProductionCloudCredential,
): Promise<void> {
  const parsed = credentialSchema.parse(credential);
  const destination = xuanxueAiProductionCloudCredentialPath(dataDir);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
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
