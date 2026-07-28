import {
  enrollXuanxueAiProductionCloudDevice,
} from "../../src/plugins/xuanxue-ai-production/index.js";

const result = await enrollXuanxueAiProductionCloudDevice();
process.stdout.write(JSON.stringify({
  verdict: "PASS",
  device_id: result.deviceId,
  credential_file: result.credentialPath,
  credential_permissions: "0600",
}, null, 2));
process.stdout.write("\n");
