import { createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getAuditProject } from "../../core/ts-morph.js";

import { runAntiFallbackBoundaryChecks } from "./run-anti-fallback-boundary-checks.js";
import { runForbiddenOwnerRuntimeChecks } from "./run-forbidden-owner-runtime-checks.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runNegativeProofWiringChecks } from "./run-negative-proof-wiring-checks.js";
import { runPromptContractRoutingChecks } from "./run-prompt-contract-routing-checks.js";

const createSkippedNegativeProofResult = () => ({
  findings: [] as Finding[],
  phase: createPhase(
    "negative-proof-harness",
    "PASS",
    true,
    "Kernel negative-proof harness was skipped for nested inspector execution.",
  ),
});

export async function runKernelBoundaryPhaseSuite(skipNegativeProof: boolean): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const antiFallback = await runAntiFallbackBoundaryChecks();
  const forbiddenOwnerRuntime = await runForbiddenOwnerRuntimeChecks();
  const promptContractRouting = await runPromptContractRoutingChecks();
  const negativeProofWiring = await runNegativeProofWiringChecks(getAuditProject());
  const negativeProof = skipNegativeProof
    ? createSkippedNegativeProofResult()
    : await runNegativeProofHarness();

  return {
    findings: [
      ...antiFallback.findings,
      ...forbiddenOwnerRuntime.findings,
      ...promptContractRouting.findings,
      ...negativeProofWiring.findings,
      ...negativeProof.findings,
    ],
    phases: [
      ...antiFallback.phases,
      ...forbiddenOwnerRuntime.phases,
      ...promptContractRouting.phases,
      ...negativeProofWiring.phases,
      negativeProof.phase,
    ],
  };
}