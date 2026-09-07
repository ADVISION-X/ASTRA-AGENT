import path from "node:path";

import { normalizeRetiredProductionCredentialManifestHash } from
  "../../src/lib/local-runtime/production/credential.js";

if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(["--remove-retired-control-manifest-hash"])) {
  throw new Error("PRODUCTION_CREDENTIAL_NORMALIZATION_EXPLICIT_ACTION_REQUIRED");
}

const dataDir = path.resolve(process.env.GRASSEYE_DATA_DIR ?? path.join(process.cwd(), ".grasseye-local"));
const result = await normalizeRetiredProductionCredentialManifestHash(dataDir);
process.stdout.write(`${JSON.stringify({
  verdict: "PASS",
  action: "remove-retired-control-manifest-hash",
  status: result.status,
  credential_file: result.credentialPath,
})}\n`);
