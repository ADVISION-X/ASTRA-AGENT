import { createInspectorContext, loadGeneratedArtifacts } from "./core/runtime.js";
import { validateCheckOwnership } from "./domains/audit-system/components/validate-check-ownership.js";
import { validateCiFullEvidence } from "./domains/audit-system/components/validate-ci-full-evidence.js";

const runClosureValidators = async () => {
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const [evidence, ownership] = await Promise.all([
    validateCiFullEvidence(context),
    validateCheckOwnership(context),
  ]);

  return {
    findings: [...evidence.findings, ...ownership.findings],
    phases: [...evidence.phases, ...ownership.phases],
  };
};

const main = async (): Promise<void> => {
  const runId = process.env.GRASSEYE_CI_FULL_RUN_ID?.trim();
  if (process.env.GRASSEYE_CI_FULL_CLOSURE !== "1" || !runId) {
    process.stderr.write("[CI FULL CLOSURE] missing GRASSEYE_CI_FULL_CLOSURE=1 or GRASSEYE_CI_FULL_RUN_ID.\n");
    process.exitCode = 1;
    return;
  }

  const result = await runClosureValidators();
  const passed = result.findings.length === 0;

  process.stdout.write(JSON.stringify({
    passed,
    phases: result.phases,
    findings: result.findings,
    runId,
  }, null, 2));

  if (!passed) {
    process.exitCode = 1;
  }
};

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[CI FULL CLOSURE ERROR] ${message}\n`);
  process.exitCode = 1;
});