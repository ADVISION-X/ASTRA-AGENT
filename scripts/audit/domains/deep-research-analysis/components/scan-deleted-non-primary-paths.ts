import { SyntaxKind, type SourceFile } from "ts-morph";
import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const retiredTerms = [
  decode("bGVnYWN5XzFfbl9uXzE="),
  decode("cG9zaXRpdmVBbnN3ZXJSZWNvcmRz"),
  decode("ZmFsc2lmaWNhdGlvbkFuc3dlclJlY29yZHM="),
  decode("Y29uZmxpY3RNYXRyaXg="),
  decode("YnVzaW5lc3MtZGVjay1vdXRsaW5l"),
  decode("YnVzaW5lc3MtZGVjay5wcHR4"),
  decode("YnVzaW5lc3MtZGVjay5haS1wcHR4"),
  decode("YnVzaW5lc3MtZGVjay5sb2NhbC1wcHR4"),
] as const;

export const inspectDeletedNonPrimaryPaths = (input: {
  sourceFiles: readonly SourceFile[];
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of input.sourceFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    input.inspectedFiles.add(repoPath);
    const stringValues = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue().toLowerCase());
    const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText());
    const found = retiredTerms.filter((term) =>
      stringValues.some((value) => value.includes(term.toLowerCase()))
      || identifiers.some((value) => value === term),
    );
    if (found.length === 0) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/delete-non-primary-path",
      lawId: input.lawId,
      filePath: repoPath,
      message: "Forbidden Deep Research historical path markers remain in active runtime source.",
    }));
  }
};
