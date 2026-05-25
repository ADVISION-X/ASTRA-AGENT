import { SyntaxKind, type SourceFile } from "ts-morph";
import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const forbiddenTerms = [
  decode("cHB0"),
  decode("cHB0eA=="),
  decode("ZGVjaw=="),
  decode("YnVzaW5lc3MtZGVjaw=="),
  decode("YnVzaW5lc3NEZWNr"),
  decode("bG9jYWxGYWxsYmFjaw=="),
  decode("b2xkRmxvdw=="),
] as const;

export const inspectNoPresentationArtifacts = (input: {
  sourceFiles: readonly SourceFile[];
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of input.sourceFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    input.inspectedFiles.add(repoPath);
    const strings = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue());
    const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText());
    const found = forbiddenTerms.filter((term) =>
      strings.some((value) => value.includes(term))
      || identifiers.some((value) => value.includes(term)),
    );
    if (found.length === 0) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/no-presentation-artifacts",
      lawId: input.lawId,
      filePath: repoPath,
      message: `Deep Research active source contains removed path term(s): ${found.join(", ")}.`,
    }));
  }
};
