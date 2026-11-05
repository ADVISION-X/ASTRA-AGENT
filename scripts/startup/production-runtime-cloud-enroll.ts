import path from "node:path";
import { fileURLToPath } from "node:url";
import { enrollProductionDevice } from "../../src/lib/local-runtime/production/credential.js";
import { failureCode } from "../../src/lib/execution-failure.js";
import { productionDependencyPath, verifyProductionDependency } from "./lib/production-contract-preflight.js";
import { buildStartupSourceFingerprint } from "./lib/source-fingerprint.mjs";

const [requestId, ...extra] = process.argv.slice(2);
if (!requestId || extra.length || !/^aipenroll_[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u.test(requestId)) {
  throw new Error("PRODUCTION_ENROLLMENT_REQUEST_INVALID");
}
const agentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await verifyProductionDependency({ agentDependencyPath: productionDependencyPath({ agentRoot }) });
const fingerprint = buildStartupSourceFingerprint(agentRoot);
const configuredFingerprint = process.env.GRASSEYE_SOURCE_FINGERPRINT?.trim();
if (configuredFingerprint && configuredFingerprint !== fingerprint) {
  throw new Error("PRODUCTION_ENROLLMENT_CANDIDATE_MISMATCH");
}
process.env.GRASSEYE_SOURCE_FINGERPRINT = fingerprint;
try {
  const result = await enrollProductionDevice({ requestId });
  process.stdout.write(JSON.stringify({
    status: "enrolled", request_id: requestId, device_id: result.deviceId,
    credential_file: result.credentialPath, credential_permissions: "0600",
  }) + "\n");
} catch (error) {
  process.stderr.write(JSON.stringify({ status: "blocked", request_id: requestId,
    code: failureCode(error, "PRODUCTION_ENROLLMENT_RESULT_UNKNOWN") }) + "\n");
  process.exitCode = 1;
}
