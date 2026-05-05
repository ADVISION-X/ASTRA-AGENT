import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { validateGeneratedArtifacts } from "./validate-generated-artifacts.js";
import { validateLawHome } from "./validate-law-home.js";
import { validateManifestOwnership } from "./validate-manifest-ownership.js";
import { validateOwnerEvidence } from "./validate-owner-evidence.js";
import { validateRequiredPhaseDomains } from "./validate-required-phase-domains.js";
import { validateRunnerBoundary } from "./validate-runner-boundary.js";
import { validateStaticClauseCoverage } from "./validate-static-clause-coverage.js";

type AuditCheckResult = {
  findings: Finding[];
  phases: InspectorPhase[];
};

export const runAuditGovernanceChecks = async (
  context: InspectorContext,
): Promise<AuditCheckResult[]> =>
  Promise.all([
    validateLawHome(context),
    validateManifestOwnership(context),
    validateGeneratedArtifacts(context),
    validateStaticClauseCoverage(context),
    validateRequiredPhaseDomains(context),
    validateRunnerBoundary(context),
    validateOwnerEvidence(context),
  ]);