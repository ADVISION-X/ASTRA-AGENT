import path from "node:path";
import { fileURLToPath } from "node:url";

import { enrollProductionDevice } from "../../src/lib/local-runtime/production/credential.js";
import {
  productionContractProjectionPaths,
  verifyProductionContractProjection,
} from "./lib/production-contract-preflight.js";
import { buildStartupSourceFingerprint } from "./lib/source-fingerprint.mjs";

const agentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const websiteRoot = path.resolve(
  process.env.XUANSHU_WEBSITE_REPOSITORY_ROOT?.trim() || path.join(agentRoot, "..", "xuanxue-web"),
);
await verifyProductionContractProjection(productionContractProjectionPaths({ agentRoot, websiteRoot }));

const computedSourceFingerprint = buildStartupSourceFingerprint(agentRoot);
const providedSourceFingerprint = process.env.GRASSEYE_SOURCE_FINGERPRINT?.trim();
if (providedSourceFingerprint && providedSourceFingerprint !== computedSourceFingerprint) {
  throw new Error("PRODUCTION_ENROLLMENT_CANDIDATE_MISMATCH");
}
process.env.GRASSEYE_SOURCE_FINGERPRINT = computedSourceFingerprint;

const result = await enrollProductionDevice();
process.stdout.write(`${JSON.stringify({
  verdict: "PASS",
  device_id: result.deviceId,
  credential_file: result.credentialPath,
  credential_permissions: "0600",
}, null, 2)}\n`);
