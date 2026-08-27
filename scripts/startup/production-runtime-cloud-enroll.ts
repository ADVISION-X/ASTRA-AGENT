import { enrollProductionDevice } from "../../src/lib/local-runtime/production/credential.js";
import { buildStartupSourceFingerprint } from "./lib/source-fingerprint.mjs";

const computedSourceFingerprint = buildStartupSourceFingerprint(process.cwd());
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
