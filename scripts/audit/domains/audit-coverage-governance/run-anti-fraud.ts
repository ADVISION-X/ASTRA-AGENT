import { runAuditCoverageAntiFraudHarness } from "./anti-fraud-harness.js";

const exitNow = (code: number): never => {
  process.exit(code);
};

runAuditCoverageAntiFraudHarness()
  .then((artifact) => {
    process.stdout.write(`[AUDIT-COVERAGE-ANTI-FRAUD] ${artifact.passedMutations}/${artifact.totalMutations} mutations failed as expected and rolled back.\n`);
    for (const mutation of artifact.mutations) {
      process.stdout.write(`- ${mutation.name}: actual=${mutation.actual} rollback=${mutation.rollback} hash=${mutation.rollbackHashVerified ? "PASS" : "FAIL"}\n`);
    }
    exitNow(artifact.failedMutations === 0 ? 0 : 1);
  })
  .catch((error: unknown) => {
    process.stderr.write(`[AUDIT-COVERAGE-ANTI-FRAUD ERROR] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    exitNow(1);
  });
