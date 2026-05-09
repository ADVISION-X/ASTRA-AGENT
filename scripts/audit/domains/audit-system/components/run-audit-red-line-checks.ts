import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { validateNoSimulatedProductionPaths } from "./validate-no-simulated-production-paths.js";
import { validateCodePurityEvidence } from "./validate-code-purity-evidence.js";
import { validateNoTestArtifacts } from "./validate-no-test-artifacts.js";
import { validateOwnedLawExecution } from "./validate-owned-law-execution.js";

type AuditCheckResult = {
  findings: Finding[];
  phases: InspectorPhase[];
};

export const runAuditRedLineChecks = async (
  context: InspectorContext,
): Promise<AuditCheckResult[]> => {
  const results: AuditCheckResult[] = [];
  results.push(await validateNoTestArtifacts(context));
  results.push(await validateOwnedLawExecution(context));
  results.push(await validateNoSimulatedProductionPaths(context));
  results.push(await validateCodePurityEvidence(context));
  return results;
};
