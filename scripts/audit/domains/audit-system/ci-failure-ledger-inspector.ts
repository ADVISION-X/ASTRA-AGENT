import { Node, SyntaxKind, type SourceFile } from "ts-morph";

type Finding = { code: string; detail: string; path: string };

export const inspectCiFailureLedger = (source: SourceFile): Finding[] => {
  const findings: Finding[] = [];
  const reportValidator = source.getFunction("validateQualityReport");
  const values = new Set(reportValidator?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((item) => item.getLiteralValue()) ?? []);
  for (const forbidden of ["WARNING", "PARTIAL", "SOFT_FAIL", "NOT_APPLICABLE"]) {
    if (values.has(forbidden)) findings.push({ code: "AUDIT_NON_BINARY_VERDICT", detail: forbidden, path: source.getFilePath() });
  }
  const extraLedger = source.getVariableDeclarations().find((declaration) => {
    const name = declaration.getName().toLowerCase();
    return name.includes("ledger") && Node.isArrayLiteralExpression(declaration.getInitializer());
  });
  if (extraLedger) findings.push({ code: "AUDIT_SECOND_FAILURE_LEDGER", detail: extraLedger.getName(), path: source.getFilePath() });
  return findings;
};
