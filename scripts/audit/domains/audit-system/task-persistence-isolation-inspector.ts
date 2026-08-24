import { SyntaxKind, type SourceFile } from "ts-morph";

import { identifierNames } from "./ci-integrity-ast.js";

type Finding = { code: string; detail: string; path: string };

export const inspectTaskPersistenceIsolation = (source: SourceFile): Finding[] => {
  const findings: Finding[] = [];
  const qualityDirectory = source.getVariableDeclaration("qualityRunDirectory");
  const qualityNames = new Set(qualityDirectory?.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText()) ?? []);
  for (const required of ["mkdtempSync", "tmpdir"]) if (!qualityNames.has(required)) findings.push({ code: "AUDIT_EPHEMERAL_OUTPUT_MISSING", detail: required, path: source.getFilePath() });
  const releaseNames = identifierNames(source.getFunction("writeReleasePackage"));
  for (const required of ["candidateId", "validateReleaseProofPackage"]) if (!releaseNames.has(required)) findings.push({ code: "AUDIT_RELEASE_PERSISTENCE_UNBOUND", detail: required, path: source.getFilePath() });
  return findings;
};
