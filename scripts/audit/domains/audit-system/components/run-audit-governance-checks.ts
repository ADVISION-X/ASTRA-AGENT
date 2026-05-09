import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { validateGeneratedArtifacts } from "./validate-generated-artifacts.js";
import { validateCheckOwnership } from "./validate-check-ownership.js";
import { validateCiFullTopology } from "./validate-ci-full-topology.js";
import { validateCiFullEvidence } from "./validate-ci-full-evidence.js";
import { validateCodePurityTopology } from "./validate-code-purity-topology.js";
import { validateLawHome } from "./validate-law-home.js";
import { validateManifestOwnership } from "./validate-manifest-ownership.js";
import { validateOwnerEvidence } from "./validate-owner-evidence.js";
import { validateOwnerAuditResourceTopology } from "./validate-owner-audit-resource-topology.js";
import { validateRequiredPhaseDomains } from "./validate-required-phase-domains.js";
import { validateRunnerBoundary } from "./validate-runner-boundary.js";
import { validateStaticClauseCoverage } from "./validate-static-clause-coverage.js";

type AuditCheckResult = {
  findings: Finding[];
  phases: InspectorPhase[];
};

export const runAuditGovernanceChecks = async (
  context: InspectorContext,
): Promise<AuditCheckResult[]> => {
  const results: AuditCheckResult[] = [];
  results.push(await validateLawHome(context));
  results.push(await validateManifestOwnership(context));
  results.push(await validateGeneratedArtifacts(context));
  results.push(await validateCiFullEvidence(context));
  results.push(await validateCheckOwnership(context));
  results.push(await validateCiFullTopology(context));
  results.push(await validateCodePurityTopology(context));
  results.push(await validateOwnerAuditResourceTopology(context));
  results.push(await validateStaticClauseCoverage(context));
  results.push(await validateRequiredPhaseDomains(context));
  results.push(await validateRunnerBoundary(context));
  results.push(await validateOwnerEvidence(context));
  return results;
};
