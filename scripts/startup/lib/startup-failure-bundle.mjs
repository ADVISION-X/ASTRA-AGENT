import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const sanitizeTimestamp = (value) => value.replace(/[:.]/g, "-");

export async function writeStartupFailureBundle({
  rootDir,
  runId,
  baseUrl,
  failureReason,
  actionableMessage,
  ownerResponsible,
}) {
  const bundleDir = path.join(rootDir, "tmp", "startup-failures", sanitizeTimestamp(runId));
  await mkdir(bundleDir, { recursive: true });
  const payload = {
    runId,
    baseUrl,
    ownerResponsible: ownerResponsible ?? "startup-entrypoint",
    failureReason,
    actionableMessage: actionableMessage ?? "Inspect startup structured logs and rerun npm run grasseye:start.",
    writtenAt: new Date().toISOString(),
  };
  await writeFile(path.join(bundleDir, "startup-failure.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return bundleDir;
}
