import { chmod, mkdir, open, readFile, rename, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  XUANYUAN_CLOUD_PROTOCOL_VERSION,
  type XuanyuanCloudCredential,
} from "./xuanyuan-cloud-contract.js";

const credentialSchema = z.object({
  protocol_version: z.literal(XUANYUAN_CLOUD_PROTOCOL_VERSION),
  server_base_url: z.string().url(),
  device_id: z.string().min(1),
  device_name: z.string().min(1),
  credential: z.string().regex(/^aidc_[A-Za-z0-9_-]{32,}$/u),
  max_in_flight: z.number().int().min(1).max(64),
  enrolled_at: z.string().min(1),
}).strict();

export function xuanyuanCloudCredentialPath(dataDir: string): string {
  return process.env.XUANYUAN_CLOUD_CREDENTIAL_FILE?.trim()
    || path.join(dataDir, "runtime-data", "xuanyuan", "cloud-device-credential.json");
}

export async function readXuanyuanCloudCredential(dataDir: string): Promise<XuanyuanCloudCredential> {
  const filePath = xuanyuanCloudCredentialPath(dataDir);
  const metadata = await stat(filePath);
  if ((metadata.mode & 0o077) !== 0) {
    throw new Error("XUANYUAN_CLOUD_CREDENTIAL_PERMISSIONS_INVALID");
  }
  return credentialSchema.parse(JSON.parse(await readFile(filePath, "utf8")));
}

export async function writeXuanyuanCloudCredential(
  dataDir: string,
  credential: XuanyuanCloudCredential,
): Promise<void> {
  const parsed = credentialSchema.parse(credential);
  const destination = xuanyuanCloudCredentialPath(dataDir);
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
