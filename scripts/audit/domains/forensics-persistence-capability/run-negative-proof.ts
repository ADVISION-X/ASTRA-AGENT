import { runNegativeProofEntry } from "../../core/run-negative-proof-entry.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";

void runNegativeProofEntry("forensics-persistence-capability negative-proof", runNegativeProofHarness).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
