import { loadCurrentBrowserProofJournal, validateDomAtomicMutationRealChromeJournal } from "./dom-real-chrome-proof-support.js";

const proof = loadCurrentBrowserProofJournal();
const result = validateDomAtomicMutationRealChromeJournal(proof);
process.stdout.write(`${JSON.stringify({
  marker: "[ACCEPTANCE][DOM-AUTOMATION][REAL-CHROME-ATOMIC-MUTATION]",
  status: "CHROME_VERIFIED",
  candidateHash: proof.candidateHash,
  ...result,
})}\n`);
