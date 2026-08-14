import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../../shared/ast-node-identity.js";
import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const oldTextRawIndexBuilder = "buildFinalAdjudication" + "TextRawIndexValue";

const hasStringLiteral = (sourceFile: SourceFile, value: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === value);

const hasIdentifier = (sourceFile: SourceFile, value: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => astIdentifierName(identifier) === value);

export const inspectNoSystemGeneratedConfidence = (input: {
  sourceFiles: SourceFile[];
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of input.sourceFiles) {
    input.inspectedFiles.add(getRepoSourcePath(sourceFile));
    for (const assignment of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      const name = assignment.getName();
      const initializer = assignment.getInitializer();
      if (name === "confidence" && Node.isStringLiteral(initializer) && initializer.getLiteralText() === "medium") {
        input.findings.push(createFinding({
          checkId: "deep-research/no-system-generated-confidence/medium",
          lawId: input.lawId,
          filePath: getRepoSourcePath(sourceFile),
          message: "Runtime must not synthesize confidence: \"medium\".",
        }));
      }
    }
    for (const forbidden of [
      { kind: "identifier", value: oldTextRawIndexBuilder },
      { kind: "string", value: "first sentence" },
      { kind: "string", value: "default confidence" },
    ]) {
      const found = forbidden.kind === "identifier"
        ? hasIdentifier(sourceFile, forbidden.value)
        : hasStringLiteral(sourceFile, forbidden.value);
      if (!found) continue;
      input.findings.push(createFinding({
        checkId: "deep-research/no-system-generated-confidence/forbidden-normalizer",
        lawId: input.lawId,
        filePath: getRepoSourcePath(sourceFile),
        message: `Final adjudication must not contain forbidden generated-confidence marker ${forbidden.value}.`,
      }));
    }
  }
};
