import { buildStartupSourceFingerprint } from "./lib/source-fingerprint.mjs";

const computedSourceFingerprint = buildStartupSourceFingerprint(process.cwd());
const providedSourceFingerprint = process.env.GRASSEYE_SOURCE_FINGERPRINT?.trim();
if (providedSourceFingerprint && providedSourceFingerprint !== computedSourceFingerprint) {
  throw new Error("XUANXUE_AI_PRODUCTION_ENROLLMENT_CANDIDATE_MISMATCH");
}
process.env.GRASSEYE_SOURCE_FINGERPRINT = computedSourceFingerprint;

const { enrollXuanxueAiProductionCloudDevice } = await import(
  "../../src/plugins/xuanxue-ai-production/index.js"
);

const result = await enrollXuanxueAiProductionCloudDevice();
process.stdout.write(JSON.stringify({
  verdict: "PASS",
  device_id: result.deviceId,
  credential_file: result.credentialPath,
  credential_permissions: "0600",
}, null, 2));
process.stdout.write("\n");
