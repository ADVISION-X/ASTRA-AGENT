import path from "node:path";
import { fileURLToPath } from "node:url";

import { enrollProductionDevice } from "../../src/lib/local-runtime/production/credential.js";
import {
  productionDependencyPath,
  verifyProductionDependency,
} from "./lib/production-contract-preflight.js";
import { buildStartupSourceFingerprint } from "./lib/source-fingerprint.mjs";

const agentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
await verifyProductionDependency({
  agentDependencyPath: productionDependencyPath({ agentRoot }),
});

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
