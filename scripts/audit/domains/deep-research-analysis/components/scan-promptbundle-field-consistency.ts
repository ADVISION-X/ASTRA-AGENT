import { SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../../shared/ast-node-identity.js";
import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const retiredSupplementAlias = decode("b3B0aW9uYWxDb250ZW50");

const hasIdentifier = (sourceFile: SourceFile, value: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => astIdentifierName(identifier) === value);

const hasStringLiteral = (sourceFile: SourceFile, value: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === value);

const hasIdentifierOrString = (sourceFile: SourceFile, value: string): boolean =>
  hasIdentifier(sourceFile, value) || hasStringLiteral(sourceFile, value);

export const inspectPromptBundleFieldConsistency = (input: {
  sourceFiles: SourceFile[];
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  let supplementalContentSeen = false;
  for (const sourceFile of input.sourceFiles) {
    input.inspectedFiles.add(getRepoSourcePath(sourceFile));
    supplementalContentSeen = supplementalContentSeen || hasIdentifierOrString(sourceFile, "supplementalContent");
    if (!hasIdentifierOrString(sourceFile, retiredSupplementAlias)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/promptbundle-field-consistency/retired-supplement-alias",
      lawId: input.lawId,
      filePath: getRepoSourcePath(sourceFile),
      message: "PromptBundle must use supplementalContent only; the retired supplemental alias is forbidden.",
    }));
  }
  if (!supplementalContentSeen) {
    input.findings.push(createFinding({
      checkId: "deep-research/promptbundle-field-consistency/missing-supplemental-content",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis",
      message: "PromptBundle schema and prompts must use supplementalContent.",
    }));
  }
};
