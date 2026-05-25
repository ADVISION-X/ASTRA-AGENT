import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const forbiddenIdentifiers = new Set([
  decode("cnVuQnVzaW5lc3NEZWNrUGhhc2U="),
  decode("cnVuUHB0QXJ0aWZhY3RQaGFzZQ=="),
  "runPositivePhase",
  "runFalsificationPhase",
]);

export const inspectSingleChainSovereignty = (input: {
  analysisRunnerFile: SourceFile | undefined;
  finalPackageFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of [input.analysisRunnerFile, input.finalPackageFile]) {
    if (!sourceFile) continue;
    const repoPath = getRepoSourcePath(sourceFile);
    input.inspectedFiles.add(repoPath);
    sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).forEach((identifier) => {
      if (!forbiddenIdentifiers.has(identifier.getText())) return;
      input.findings.push(createFinding({
        checkId: "deep-research/single-flow-forbidden-identifier",
        lawId: input.lawId,
        filePath: repoPath,
        message: `Forbidden Deep Research phase identifier remains: ${identifier.getText()}.`,
      }));
    });
  }
};
