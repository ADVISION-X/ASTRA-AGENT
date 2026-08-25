import { readFileSync } from "node:fs";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

import {
  appShellProofPaths,
  validateAppShellRealChromeProof,
} from "./app-shell-real-chrome-proof-support.js";

const result = validateAppShellRealChromeProof(JSON.parse(
  readFileSync(appShellProofPaths.proof, "utf8"),
));
process.stdout.write(`${JSON.stringify({
  marker: "[ACCEPTANCE][APP-SHELL-UI][REAL-CHROME-PHYSICAL-CLEANUP]",
  status: "CHROME_VERIFIED",
  ...result,
})}\n`);
emitQualityProofObservation({ lawId: "LAW-LOCAL-APP-SHELL-001-V5", evidenceMode: "dynamic.browser", locator: "dynamic:app-shell:physical-layout", observedValue: `candidate=${result.candidateHash};browser=${result.browserVersion}` });
emitQualityProofObservation({ lawId: "LAW-WORKBENCH-API-BOUNDARY-001-V4", evidenceMode: "dynamic.browser", locator: "dynamic:app-shell:workbench-known-route", observedValue: `workbench=127.0.0.1:4173;candidate=${result.candidateHash}` });
