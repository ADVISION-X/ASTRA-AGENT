import { Node, SyntaxKind } from "ts-morph";

import type { GovernedFile } from "./code-purity-governed-files.js";
import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import { collectDirectiveComments } from "./structural-metrics.js";

type TypeEscapeFindingInput = {
  checkId: string;
  collector: InventoryFindingCollector;
  governedFile: GovernedFile;
  lawId: string;
  reason: string;
  remediation: string;
  message: string;
};

const pushTypeEscapeFinding = (input: TypeEscapeFindingInput): void => {
  input.collector.push(
    {
      checkId: input.checkId,
      evidenceMode: "static.types",
      filePath: input.governedFile.repoPath,
      lawId: input.lawId,
      owner: input.governedFile.owner,
      reason: input.reason,
      remediation: input.remediation,
      role: input.governedFile.role,
      verificationCommand: "npm run quality:check -- READY",
    },
    input.message,
  );
};

const scanAnyKeywordEscape = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  typeEscapeLawId: string,
): void => {
  const anyKeyword = governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword)[0];
  if (!anyKeyword) {
    return;
  }
  pushTypeEscapeFinding({
    checkId: "code-purity/any-keyword",
    collector,
    governedFile,
    lawId: typeEscapeLawId,
    reason: `any escape appears near line ${anyKeyword.getStartLineNumber()}.`,
    remediation: "Replace any with a schema-validated unknown or a specific contract type.",
    message: `${governedFile.repoPath} contains an any escape near line ${anyKeyword.getStartLineNumber()}.`,
  });
};

const scanAsAnyEscape = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  typeEscapeLawId: string,
): void => {
  const anyAssertion = governedFile.sourceFile
    .getDescendantsOfKind(SyntaxKind.AsExpression)
    .find((expression) => expression.getTypeNode()?.getKind() === SyntaxKind.AnyKeyword);
  if (!anyAssertion) {
    return;
  }
  pushTypeEscapeFinding({
    checkId: "code-purity/as-any",
    collector,
    governedFile,
    lawId: typeEscapeLawId,
    reason: `as any appears near line ${anyAssertion.getStartLineNumber()}.`,
    remediation: "Replace as any with validated narrowing or a lawful type contract.",
    message: `${governedFile.repoPath} uses as any near line ${anyAssertion.getStartLineNumber()}.`,
  });
};

const scanUnknownAsChain = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  typeEscapeLawId: string,
): void => {
  const unknownAsChain = governedFile.sourceFile
    .getDescendantsOfKind(SyntaxKind.AsExpression)
    .find(
      (expression) =>
        expression.getTypeNode()?.getKind() === SyntaxKind.UnknownKeyword && Node.isAsExpression(expression.getParent()),
    );
  if (!unknownAsChain) {
    return;
  }
  pushTypeEscapeFinding({
    checkId: "code-purity/as-unknown-as",
    collector,
    governedFile,
    lawId: typeEscapeLawId,
    reason: `as unknown as appears near line ${unknownAsChain.getStartLineNumber()}.`,
    remediation: "Replace double assertion with schema validation or an explicit narrowing guard.",
    message: `${governedFile.repoPath} uses as unknown as near line ${unknownAsChain.getStartLineNumber()}.`,
  });
};

const scanAssertionEscapes = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  typeEscapeLawId: string,
): void => {
  scanAnyKeywordEscape(collector, governedFile, typeEscapeLawId);
  scanAsAnyEscape(collector, governedFile, typeEscapeLawId);
  scanUnknownAsChain(collector, governedFile, typeEscapeLawId);
};

const scanDirectiveEscapes = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  typeEscapeLawId: string,
): void => {
  for (const directive of collectDirectiveComments(governedFile)) {
    pushTypeEscapeFinding({
      checkId: "code-purity/directive-comment",
      collector,
      governedFile,
      lawId: typeEscapeLawId,
      reason: `suppression directive ${directive.text.trim()} appears near line ${directive.line}.`,
      remediation: "Repair the type or lint defect directly instead of suppressing it.",
      message: `${governedFile.repoPath} contains a suppression directive near line ${directive.line}.`,
    });
  }
};

export const scanStructuralTypeEscapes = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  typeEscapeLawId: string,
): void => {
  scanAssertionEscapes(collector, governedFile, typeEscapeLawId);
  scanDirectiveEscapes(collector, governedFile, typeEscapeLawId);
};
