import { readFileSync } from "node:fs";

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
