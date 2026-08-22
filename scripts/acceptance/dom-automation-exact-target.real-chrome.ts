import { loadCurrentBrowserProofJournal, validateDomExactTargetRealChromeProof } from "./dom-real-chrome-proof-support.js";

const proof = loadCurrentBrowserProofJournal();
const result = validateDomExactTargetRealChromeProof(proof);
process.stdout.write(`${JSON.stringify({
  marker: "[ACCEPTANCE][DOM-AUTOMATION][REAL-CHROME-EXACT-TARGET]",
  status: "CHROME_VERIFIED",
  candidateHash: proof.candidateHash,
  ...result,
})}\n`);
