import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { validateCodePurityEvidence } from "./validate-code-purity-evidence.js";

type AuditCheckResult = {
  findings: Finding[];
  phases: InspectorPhase[];
};

export const runAuditRedLineChecks = async (
  context: InspectorContext,
): Promise<AuditCheckResult[]> => {
  const results: AuditCheckResult[] = [];
  results.push(await validateCodePurityEvidence(context));
  return results;
};
