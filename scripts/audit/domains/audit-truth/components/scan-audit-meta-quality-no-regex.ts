import { Node, SyntaxKind, type Node as MorphNode } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";
import { isAuditTruthMetaQualityScopeFile } from "./audit-truth-scope.js";

const bannedMethodNames = ["exec", "match", "matchAll", "replace", "replaceAll", "search", "split", "test"] as const;
type BannedMethodName = (typeof bannedMethodNames)[number];
const bannedMethodNameSet = new Set<string>(bannedMethodNames);

const isBannedMethodName = (value: string): value is BannedMethodName => bannedMethodNameSet.has(value);

const getCandidateTypes = (node: MorphNode) => {
  const nodeType = node.getType();
  return nodeType.isUnion() ? nodeType.getUnionTypes() : [nodeType];
};

const looksLikeStringOrRegexOrUnknown = (node: MorphNode | undefined): boolean => {
  if (!node) {
    return false;
  }
  return getCandidateTypes(node).some((candidateType) => {
    if (candidateType.isAny() || candidateType.isUnknown() || candidateType.isString() || candidateType.isStringLiteral()) {
      return true;
    }
    const symbolName = candidateType.getSymbol()?.getName() ?? candidateType.getAliasSymbol()?.getName();
    return symbolName === "String" || symbolName === "RegExp";
  });
};

const resolveStringConstant = (
  node: MorphNode | undefined,
  seenSymbols: Set<string> = new Set<string>(),
): string | undefined => {
  if (!node) {
    return undefined;
  }
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralText();
  }
  if (!Node.isIdentifier(node)) {
    return undefined;
  }
  const symbol = node.getSymbol();
  const symbolKey = symbol?.getEscapedName().toString() ?? node.getText();
  if (seenSymbols.has(symbolKey)) {
    return undefined;
  }
  seenSymbols.add(symbolKey);
  const declaration = symbol?.getDeclarations()[0];
  if (!declaration || !Node.isVariableDeclaration(declaration)) {
    return undefined;
  }
  return resolveStringConstant(declaration.getInitializer(), seenSymbols);
};

const resolveBannedMethodName = (
  node: MorphNode | undefined,
  seenSymbols: Set<string> = new Set<string>(),
): BannedMethodName | undefined => {
  const literalValue = resolveStringConstant(node, seenSymbols);
  return literalValue && isBannedMethodName(literalValue) ? literalValue : undefined;
};

const resolveVariableInitializer = (
  node: MorphNode | undefined,
  seenSymbols: Set<string>,
): MorphNode | undefined => {
  if (!node || !Node.isIdentifier(node)) {
    return undefined;
  }
  const symbol = node.getSymbol();
  const symbolKey = symbol?.getEscapedName().toString() ?? node.getText();
  if (seenSymbols.has(symbolKey)) {
    return undefined;
  }
  seenSymbols.add(symbolKey);
  const declaration = symbol?.getDeclarations()[0];
  return declaration && Node.isVariableDeclaration(declaration) ? declaration.getInitializer() : undefined;
};

const resolvePrototypeMethodFromPropertyAccess = (node: MorphNode | undefined): BannedMethodName | undefined => {
  if (!node || !Node.isPropertyAccessExpression(node)) {
    return undefined;
  }
  const methodName = node.getName();
  if (!isBannedMethodName(methodName)) {
    return undefined;
  }
  const prototypeAccess = node.getExpression();
  if (!Node.isPropertyAccessExpression(prototypeAccess) || prototypeAccess.getName() !== "prototype") {
    return undefined;
  }
  const owner = prototypeAccess.getExpression();
  if (!Node.isIdentifier(owner)) {
    return undefined;
  }
  const ownerName = owner.getText();
  return ownerName === "String" || ownerName === "RegExp" ? methodName : undefined;
};

const resolvePrototypeBannedMethod = (
  node: MorphNode | undefined,
  seenSymbols: Set<string> = new Set<string>(),
): BannedMethodName | undefined => {
  const directMethod = resolvePrototypeMethodFromPropertyAccess(node);
  if (directMethod) {
    return directMethod;
  }
  const initializer = resolveVariableInitializer(node, seenSymbols);
  return initializer ? resolvePrototypeBannedMethod(initializer, seenSymbols) : undefined;
};

const isRegExpConstructorExpression = (
  node: MorphNode | undefined,
  seenSymbols: Set<string> = new Set<string>(),
): boolean => {
  if (!node) {
    return false;
  }
  if (Node.isIdentifier(node) && node.getText() === "RegExp") {
    return true;
  }
  const initializer = resolveVariableInitializer(node, seenSymbols);
  if (initializer) {
    return isRegExpConstructorExpression(initializer, seenSymbols);
  }
  return getCandidateTypes(node).some((candidateType) => {
    const symbolName = candidateType.getSymbol()?.getName() ?? candidateType.getAliasSymbol()?.getName();
    return symbolName === "RegExp" || symbolName === "RegExpConstructor";
  });
};

const pushFinding = (
  findings: InspectorFinding[],
  input: {
    checkId: string;
    evidence: string;
    filePath: string;
    lawId: string;
    message: string;
  },
): void => {
  findings.push(
    createFinding({
      checkId: input.checkId,
      evidence: input.evidence,
      filePath: input.filePath,
      lawId: input.lawId,
      message: input.message,
    }),
  );
};

const pushCallFinding = (input: {
  callText: string;
  checkId: string;
  filePath: string;
  findings: InspectorFinding[];
  lawId: string;
  message: string;
}): void => {
  pushFinding(input.findings, {
    checkId: input.checkId,
    evidence: input.callText,
    filePath: input.filePath,
    lawId: input.lawId,
    message: input.message,
  });
};

const scanRegexLiteralFindings = (input: {
  findings: InspectorFinding[];
  lawId: string;
  sourceFile: MorphNode & { getDescendantsOfKind(kind: SyntaxKind.RegularExpressionLiteral): MorphNode[] };
  sourceFilePath: string;
}): void => {
  for (const regexLiteral of input.sourceFile.getDescendantsOfKind(SyntaxKind.RegularExpressionLiteral)) {
    pushFinding(input.findings, {
      checkId: "audit-truth/meta-quality-regex-literal",
      evidence: regexLiteral.getText(),
      filePath: input.sourceFilePath,
      lawId: input.lawId,
      message: `${input.sourceFilePath} contains a regex literal inside audit meta-quality owner or proof scope.`,
    });
  }
};

const scanRegexConstructorFindings = (input: {
  findings: InspectorFinding[];
  lawId: string;
  sourceFile: MorphNode & { getDescendantsOfKind(kind: SyntaxKind.NewExpression): MorphNode[] };
  sourceFilePath: string;
}): void => {
  for (const newExpression of input.sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression)) {
    if (!isRegExpConstructorExpression(newExpression.getExpression())) {
      continue;
    }
    pushFinding(input.findings, {
      checkId: "audit-truth/meta-quality-regex-constructor",
      evidence: newExpression.getText(),
      filePath: input.sourceFilePath,
      lawId: input.lawId,
      message: `${input.sourceFilePath} constructs RegExp inside audit meta-quality owner or proof scope.`,
    });
  }
};

const scanCallExpressionFinding = (input: {
  callExpression: MorphNode & { getExpression(): MorphNode; getText(): string };
  filePath: string;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const expression = input.callExpression.getExpression();
  if (Node.isPropertyAccessExpression(expression)) {
    const methodName = expression.getName();
    if (isBannedMethodName(methodName) && looksLikeStringOrRegexOrUnknown(expression.getExpression())) {
      pushCallFinding({
        callText: input.callExpression.getText(),
        checkId: "audit-truth/meta-quality-banned-method",
        filePath: input.filePath,
        findings: input.findings,
        lawId: input.lawId,
        message: `${input.filePath} calls ${methodName} inside audit meta-quality owner or proof scope.`,
      });
      return;
    }
    if (methodName !== "call") {
      return;
    }
    const bannedPrototypeMethod = resolvePrototypeBannedMethod(expression.getExpression());
    if (!bannedPrototypeMethod) {
      return;
    }
    pushCallFinding({
      callText: input.callExpression.getText(),
      checkId: "audit-truth/meta-quality-dynamic-method-escape",
      filePath: input.filePath,
      findings: input.findings,
      lawId: input.lawId,
      message: `${input.filePath} uses ${bannedPrototypeMethod}.call(...) inside audit meta-quality owner or proof scope.`,
    });
    return;
  }
  if (!Node.isElementAccessExpression(expression)) {
    return;
  }
  const bannedMethod = resolveBannedMethodName(expression.getArgumentExpression());
  if (!bannedMethod || !looksLikeStringOrRegexOrUnknown(expression.getExpression())) {
    return;
  }
  pushCallFinding({
    callText: input.callExpression.getText(),
    checkId: "audit-truth/meta-quality-dynamic-method-escape",
    filePath: input.filePath,
    findings: input.findings,
    lawId: input.lawId,
    message: `${input.filePath} uses dynamic property ${bannedMethod} inside audit meta-quality owner or proof scope.`,
  });
};

const scanBannedCallFindings = (input: {
  findings: InspectorFinding[];
  lawId: string;
  sourceFile: MorphNode & { getDescendantsOfKind(kind: SyntaxKind.CallExpression): Array<MorphNode & { getExpression(): MorphNode; getText(): string }> };
  sourceFilePath: string;
}): void => {
  for (const callExpression of input.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    scanCallExpressionFinding({
      callExpression,
      filePath: input.sourceFilePath,
      findings: input.findings,
      lawId: input.lawId,
    });
  }
};

const scanSourceFile = (input: {
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
  sourceFile: MorphNode & { getDescendantsOfKind(kind: SyntaxKind.RegularExpressionLiteral): MorphNode[] } & { getDescendantsOfKind(kind: SyntaxKind.NewExpression): MorphNode[] } & { getDescendantsOfKind(kind: SyntaxKind.CallExpression): MorphNode[] };
  sourceFilePath: string;
}): void => {
  input.inspectedFiles.add(input.sourceFilePath);
  scanRegexLiteralFindings(input);
  scanRegexConstructorFindings(input);
  scanBannedCallFindings(input);
};

export const scanAuditMetaQualityNoRegex = (input: {
  context: InspectorContext;
  inspectedFiles: Set<string>;
  lawId: string;
}): { findings: InspectorFinding[] } => {
  const findings: InspectorFinding[] = [];
  const scopeFiles = input.context.project
    .getSourceFiles()
    .filter((sourceFile) => !sourceFile.isDeclarationFile() && isAuditTruthMetaQualityScopeFile(sourceFile));

  for (const sourceFile of scopeFiles) {
    scanSourceFile({
      findings,
      inspectedFiles: input.inspectedFiles,
      lawId: input.lawId,
      sourceFile,
      sourceFilePath: getRepoSourcePath(sourceFile),
    });
  }

  return { findings };
};