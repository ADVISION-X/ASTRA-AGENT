import { createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getAuditProject } from "../../core/ts-morph.js";

import { runAntiFallbackBoundaryChecks } from "./run-anti-fallback-boundary-checks.js";
import { runForbiddenOwnerRuntimeChecks } from "./run-forbidden-owner-runtime-checks.js";
import { runPromptContractRoutingChecks } from "./run-prompt-contract-routing-checks.js";

export async function runKernelBoundaryPhaseSuite(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const antiFallback = await runAntiFallbackBoundaryChecks();
  const forbiddenOwnerRuntime = await runForbiddenOwnerRuntimeChecks();
  const promptContractRouting = await runPromptContractRoutingChecks();

  return {
    findings: [
      ...antiFallback.findings,
      ...forbiddenOwnerRuntime.findings,
      ...promptContractRouting.findings,
    ],
    phases: [
      ...antiFallback.phases,
      ...forbiddenOwnerRuntime.phases,
      ...promptContractRouting.phases,
    ],
  };
}