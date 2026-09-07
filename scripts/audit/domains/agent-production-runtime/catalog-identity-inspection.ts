import { SyntaxKind, type SourceFile } from "ts-morph";

export const catalogIdentityMaintenanceFailures = (
  source: SourceFile | undefined,
  normalizedText: string,
): string[] => {
  const failures: string[] = [];
  for (const token of ["begin immediate", "where state='active'", "catalog_hash: _retired",
    "integrity_check", "foreign_key_check", "rollback"]) {
    if (!normalizedText.includes(token)) failures.push(`retirement:${token}`);
  }
  const tables = source?.getVariableDeclaration("tables")?.getInitializer()
    ?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue()) ?? [];
  const expectedTables = ["production_tasks", "production_attempt_failures", "production_continuations",
    "production_outbox", "production_checkpoints", "production_leases"];
  const calls = new Set(source?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .map((call) => call.getExpression().getText()) ?? []);
  if (JSON.stringify(tables) !== JSON.stringify(expectedTables)
    || !calls.has("resolveStoredProductionAuthority")
    || !calls.has("databaseSnapshot")
    || !source?.getFunction("verifyAuthorityReadback")) {
    failures.push("authority-readback");
  }
  return failures;
};
