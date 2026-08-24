import { SyntaxKind, type SourceFile } from "ts-morph";

import { identifierNames } from "./ci-integrity-ast.js";

type Finding = { code: string; detail: string; path: string };

export const inspectOwnerEvaluationIntegrity = (source: SourceFile): Finding[] => {
  const projectChecks = source.getFunction("projectChecks");
  const runCheck = source.getFunction("runCheck");
  const runAcceptanceChecks = source.getFunction("runAcceptanceChecks");
  const runInternalGate = source.getFunction("runInternalGate");
  const missingScriptCheck = source.getFunction("missingScriptCheck");
  const findings: Finding[] = [];
  const projectNames = identifierNames(projectChecks);
  for (const required of ["DOMAIN_READY_SCRIPTS", "runCheck"]) if (!projectNames.has(required)) findings.push({ code: "AUDIT_OWNER_EVALUATION_BYPASSED", detail: required, path: source.getFilePath() });
  const projectValues = new Set([
    ...(projectChecks?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue()) ?? []),
    ...(missingScriptCheck?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue()) ?? []),
  ]);
  if (!projectValues.has("PROJECT_CHECK_MISSING")) findings.push({ code: "AUDIT_OWNER_EVALUATION_BYPASSED", detail: "PROJECT_CHECK_MISSING", path: source.getFilePath() });
  const runNames = identifierNames(runCheck);
  for (const required of ["candidateSnapshot", "claims", "finding", "normalizeClaims", "outcome", "validateClaims", "writeEvidence"]) if (!runNames.has(required)) findings.push({ code: "AUDIT_CHECK_RECEIPT_INCOMPLETE", detail: required, path: source.getFilePath() });
  const acceptanceNames = identifierNames(runAcceptanceChecks);
  for (const required of ["CANONICAL_ACCEPTANCE_BINDINGS", "clauseId", "evidenceFacet", "lawId"]) if (!acceptanceNames.has(required)) findings.push({ code: "AUDIT_ACCEPTANCE_CLAIM_IDENTITY_BROKEN", detail: required, path: source.getFilePath() });
  const internalNames = identifierNames(runInternalGate);
  for (const required of ["candidateSnapshot", "finding", "outcome", "verify", "writeEvidence"]) if (!internalNames.has(required)) findings.push({ code: "AUDIT_INTERNAL_GATE_FIXED_OUTCOME", detail: required, path: source.getFilePath() });
  if (source.getFunction("internalGateCheck")) findings.push({ code: "AUDIT_INTERNAL_GATE_FIXED_OUTCOME", detail: "retired internalGateCheck remains", path: source.getFilePath() });
  return findings;
};
