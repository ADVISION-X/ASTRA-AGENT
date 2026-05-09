import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { inspectCodePurity } from "../../code-purity/components/inspect-code-purity.js";
import { validateNoSimulatedProductionPaths } from "./validate-no-simulated-production-paths.js";
import { validateNegativeProofWiring } from "./validate-negative-proof-wiring.js";
import { validateNegativeProofRuntimeTopology } from "./validate-negative-proof-runtime-topology.js";
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
  results.push(await validateNegativeProofWiring(context));
  results.push(await validateNegativeProofRuntimeTopology(context));
  results.push(await inspectCodePurity(context));
  return results;
};
