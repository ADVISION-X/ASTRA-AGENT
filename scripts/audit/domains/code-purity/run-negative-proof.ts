import {
  assertCodePurityMemoryBoundary,
  logCodePurityStageMetrics,
} from "./components/purity-stage-memory.js";
import {
  writeNegativeProofResult,
} from "./components/purity-stage-results.js";
import { runCodePurityNegativeProof } from "./components/purity-negative-proof.js";

const main = async (): Promise<void> => {
  logCodePurityStageMetrics("negative-proof:start", 0, 0);
  const result = await runCodePurityNegativeProof();
  await writeNegativeProofResult({
    generatedAt: new Date().toISOString(),
    findings: result.findings,
    phase: result.phase,
  });
  assertCodePurityMemoryBoundary("negative-proof", 0, result.findings.length);
  logCodePurityStageMetrics("negative-proof:done", 0, result.findings.length);
  if (result.findings.length > 0) {
    process.exitCode = 1;
  }
};

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
