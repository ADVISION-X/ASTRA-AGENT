import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { validateGeneratedArtifacts } from "./validate-generated-artifacts.js";
import { validateLawHome } from "./validate-law-home.js";
import { validateManifestOwnership } from "./validate-manifest-ownership.js";

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
  return results;
};
