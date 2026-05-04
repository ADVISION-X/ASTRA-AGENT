import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { inspectCodePurity } from "../../code-purity/components/inspect-code-purity.js";
import { validateNoSimulatedProductionPaths } from "./validate-no-simulated-production-paths.js";
import { validateNegativeProofWiring } from "./validate-negative-proof-wiring.js";
import { validateNoTestArtifacts } from "./validate-no-test-artifacts.js";
import { validateOwnedLawExecution } from "./validate-owned-law-execution.js";

type AuditCheckResult = {
  findings: Finding[];
  phases: InspectorPhase[];
};

export const runAuditRedLineChecks = async (
  context: InspectorContext,
): Promise<AuditCheckResult[]> =>
  Promise.all([
    validateNoTestArtifacts(context),
    validateOwnedLawExecution(context),
    validateNoSimulatedProductionPaths(context),
    validateNegativeProofWiring(context),
    inspectCodePurity(context),
  ]);