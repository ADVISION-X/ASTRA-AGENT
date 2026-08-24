import { SyntaxKind, type SourceFile } from "ts-morph";

import { identifierNames } from "./ci-integrity-ast.js";

type Finding = { code: string; detail: string; path: string };

export const inspectBinaryVerdict = (source: SourceFile): Finding[] => {
  const validator = source.getFunction("validateQualityReport");
  const values = new Set(validator?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue()) ?? []);
  const names = identifierNames(validator);
  const findings: Finding[] = [];
  for (const required of ["PASS", "FAIL"]) if (!values.has(required)) findings.push({ code: "AUDIT_BINARY_VERDICT_MISSING", detail: required, path: source.getFilePath() });
  for (const required of ["failed", "mutants", "outcome", "laws"]) if (!names.has(required)) findings.push({ code: "AUDIT_VERDICT_DENOMINATOR_BROKEN", detail: required, path: source.getFilePath() });
  return findings;
};
