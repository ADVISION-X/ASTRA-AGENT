import { Node, SyntaxKind, type ImportDeclaration, type SourceFile, type Symbol as MorphSymbol } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath, listActiveSourceFiles, listOwnerInspectorFiles } from "../../shared/source-files.js";

const privateCapabilityPathPattern = /^src\/capabilities\/[^/]+\/(runtime|children)\//u;
const bannedPathTokenPattern = /(bridge|compatibility|legacy|shadow|fallback|universal-agent|planner|next-action|action-plan|mission-loop|nerve-bus|commander-console)/u;

const isSharedLibPath = (repoPath: string): boolean =>
  repoPath.startsWith("src/lib/") && !repoPath.startsWith("src/lib/local-runtime/");

const findForbiddenTextVariableNames = (sourceFile: SourceFile): Set<string> => {
  const variableNames = new Set<string>();
  for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const initializer = declaration.getInitializer();
    if (!initializer || !Node.isCallExpression(initializer)) {
      continue;
    }
    const expression = initializer.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) {
      continue;
    }
    if (expression.getName() !== "getText" && expression.getName() !== "getFullText") {
      continue;
    }
    variableNames.add(declaration.getName());
  }
  return variableNames;
};

const hasProjectUsage = (sourceFile: SourceFile): boolean =>
  sourceFile
    .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((expression) => expression.getText() === "context.project");

const findAntiEvasionCall = (sourceFile: SourceFile): string | undefined => {
  const forbiddenNames = findForbiddenTextVariableNames(sourceFile);
  const searchCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  const matchedCall = searchCalls.find((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) {
      return false;
    }
    const searchMethod = expression.getName();
    if (searchMethod !== "includes" && searchMethod !== "match" && searchMethod !== "test") {
      return false;
    }
    const receiver = expression.getExpression();
    if (Node.isIdentifier(receiver)) {
      return forbiddenNames.has(receiver.getText());
    }
    if (!Node.isCallExpression(receiver)) {
      return false;
    }
    const receiverExpression = receiver.getExpression();
    return (
      Node.isPropertyAccessExpression(receiverExpression) &&
      (receiverExpression.getName() === "getText" || receiverExpression.getName() === "getFullText")
    );
  });
  return matchedCall?.getText();
};

const collectDirectiveComments = (sourceFile: SourceFile): { line: number; text: string }[] => {
  const seenRanges = new Set<string>();
  const directives: { line: number; text: string }[] = [];
  sourceFile.forEachDescendant((node) => {
    for (const range of [...node.getLeadingCommentRanges(), ...node.getTrailingCommentRanges()]) {
      const key = `${range.getPos()}:${range.getEnd()}`;
      if (seenRanges.has(key)) {
        continue;
      }
      seenRanges.add(key);
      const text = range.getText();
      if (!text.includes("@ts-ignore") && !text.includes("@ts-expect-error") && !text.includes("eslint-disable")) {
        continue;
      }
      directives.push({
        line: sourceFile.getLineAndColumnAtPos(range.getPos()).line,
        text,
      });
    }
  });
  return directives;
};

const resolveImportTargetPaths = (importDeclaration: ImportDeclaration): string[] => {
  const targetPaths = new Set<string>();
  const moduleSourceFile = importDeclaration.getModuleSpecifierSourceFile();
  if (moduleSourceFile) {
    targetPaths.add(getRepoSourcePath(moduleSourceFile));
  }

  const addSymbolDeclarationPaths = (symbol: MorphSymbol | undefined): void => {
    const resolvedSymbol = symbol?.getAliasedSymbol() ?? symbol;
    for (const declaration of resolvedSymbol?.getDeclarations() ?? []) {
      targetPaths.add(getRepoSourcePath(declaration.getSourceFile()));
    }
  };

  addSymbolDeclarationPaths(importDeclaration.getDefaultImport()?.getSymbol());
  addSymbolDeclarationPaths(importDeclaration.getNamespaceImport()?.getSymbol());
  for (const namedImport of importDeclaration.getNamedImports()) {
    addSymbolDeclarationPaths(namedImport.getAliasNode()?.getSymbol() ?? namedImport.getSymbol());
  }

  return [...targetPaths].sort();
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const sourceAtomicityLawId = selectLawId(context.planEntry.lawIds, "APEX-CODE-PURITY-001-V1");
  const flowPurityLawId = selectLawId(context.planEntry.lawIds, "APEX-CODE-PURITY-004-V1");
  const mediatorPurityLawId = selectLawId(context.planEntry.lawIds, "APEX-CODE-PURITY-005-V1");
  const abilityPurityLawId = selectLawId(context.planEntry.lawIds, "APEX-CODE-PURITY-006-V1");
  const typeEscapeLawId = selectLawId(context.planEntry.lawIds, "APEX-CODE-PURITY-008-V1");
  const bridgeLawId = selectLawId(context.planEntry.lawIds, "APEX-CODE-PURITY-010-V1");
  const sharedScopeLawId = selectLawId(context.planEntry.lawIds, "APEX-CODE-PURITY-011-V1");
  const auditTruthLawId = selectLawId(context.planEntry.lawIds, "APEX-CODE-PURITY-013-V1");

  const findings: ReturnType<typeof createFinding>[] = [];
  const findingKeys = new Set<string>();
  const inspectedFiles = new Set<string>();

  const pushFinding = (input: Parameters<typeof createFinding>[0]): void => {
    const key = `${input.checkId}:${input.filePath ?? ""}:${input.message}`;
    if (findingKeys.has(key)) {
      return;
    }
    findingKeys.add(key);
    findings.push(createFinding(input));
  };

  for (const sourceFile of listActiveSourceFiles(context.project)) {
    const repoPath = getRepoSourcePath(sourceFile);
    inspectedFiles.add(repoPath);

    if (bannedPathTokenPattern.test(repoPath)) {
      pushFinding({
        checkId: "code-purity/banned-active-path",
        lawId: bridgeLawId,
        filePath: repoPath,
        message: `${repoPath} contains a banned bridge/legacy/planner path token.`,
      });
    }

    const anyKeyword = sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword)[0];
    if (anyKeyword) {
      pushFinding({
        checkId: "code-purity/any-keyword",
        lawId: typeEscapeLawId,
        filePath: repoPath,
        message: `${repoPath} contains an any escape near line ${anyKeyword.getStartLineNumber()}.`,
      });
    }

    const anyAssertion = sourceFile
      .getDescendantsOfKind(SyntaxKind.AsExpression)
      .find((expression) => expression.getTypeNode()?.getKind() === SyntaxKind.AnyKeyword);
    if (anyAssertion) {
      pushFinding({
        checkId: "code-purity/as-any",
        lawId: typeEscapeLawId,
        filePath: repoPath,
        message: `${repoPath} uses as any near line ${anyAssertion.getStartLineNumber()}.`,
      });
    }

    const unknownAsChain = sourceFile
      .getDescendantsOfKind(SyntaxKind.AsExpression)
      .find(
        (expression) =>
          expression.getTypeNode()?.getKind() === SyntaxKind.UnknownKeyword && Node.isAsExpression(expression.getParent()),
      );
    if (unknownAsChain) {
      pushFinding({
        checkId: "code-purity/as-unknown-as",
        lawId: typeEscapeLawId,
        filePath: repoPath,
        message: `${repoPath} uses as unknown as near line ${unknownAsChain.getStartLineNumber()}.`,
      });
    }

    for (const directive of collectDirectiveComments(sourceFile)) {
      pushFinding({
        checkId: "code-purity/directive-comment",
        lawId: typeEscapeLawId,
        filePath: repoPath,
        evidence: directive.text.trim(),
        message: `${repoPath} contains a suppression directive near line ${directive.line}.`,
      });
    }

    const exportStar = sourceFile
      .getExportDeclarations()
      .find((declaration) => declaration.getModuleSpecifierValue() !== undefined && declaration.getNamedExports().length === 0);
    if (exportStar) {
      pushFinding({
        checkId: "code-purity/export-star",
        lawId: sourceAtomicityLawId,
        filePath: repoPath,
        message: `${repoPath} uses export * and hides ownership boundaries.`,
      });
    }

    if (sourceFile.getDefaultExportSymbol()) {
      pushFinding({
        checkId: "code-purity/default-export",
        lawId: sourceAtomicityLawId,
        filePath: repoPath,
        message: `${repoPath} uses a default export in active source.`,
      });
    }

    const requireCall = sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((callExpression) => callExpression.getExpression().getText() === "require");
    if (requireCall) {
      pushFinding({
        checkId: "code-purity/require-call",
        lawId: sourceAtomicityLawId,
        filePath: repoPath,
        message: `${repoPath} uses require instead of ESM imports.`,
      });
    }

    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const targetPaths = resolveImportTargetPaths(importDeclaration);

      if (repoPath.startsWith("src/capabilities/") && targetPaths.some((targetPath) => targetPath.startsWith("src/plugins/"))) {
        pushFinding({
          checkId: "code-purity/capability-imports-plugin",
          lawId: abilityPurityLawId,
          filePath: repoPath,
          evidence: targetPaths.join(", "),
          message: `${repoPath} resolves imports into plugin-owned code.`,
        });
      }

      if (repoPath.startsWith("src/plugins/") && targetPaths.some((targetPath) => privateCapabilityPathPattern.test(targetPath))) {
        pushFinding({
          checkId: "code-purity/plugin-private-capability-import",
          lawId: flowPurityLawId,
          filePath: repoPath,
          evidence: targetPaths.join(", "),
          message: `${repoPath} imports private ability runtime or child files instead of a public facade.`,
        });
      }

      if (
        repoPath.startsWith("src/mediator/") &&
        targetPaths.some(
          (targetPath) => targetPath.startsWith("src/lib/browser/") || privateCapabilityPathPattern.test(targetPath),
        )
      ) {
        pushFinding({
          checkId: "code-purity/mediator-runtime-import",
          lawId: mediatorPurityLawId,
          filePath: repoPath,
          evidence: targetPaths.join(", "),
          message: `${repoPath} imports browser or private runtime code across the mediator boundary.`,
        });
      }

      if (isSharedLibPath(repoPath) && targetPaths.some((targetPath) => targetPath.startsWith("src/plugins/"))) {
        pushFinding({
          checkId: "code-purity/shared-scope-plugin-import",
          lawId: sharedScopeLawId,
          filePath: repoPath,
          evidence: targetPaths.join(", "),
          message: `${repoPath} resolves imports into plugin-owned business flow code.`,
        });
      }
    }
  }

  for (const inspectorFile of listOwnerInspectorFiles(context.project)) {
    const repoPath = getRepoSourcePath(inspectorFile);
    if (!hasProjectUsage(inspectorFile)) {
      pushFinding({
        checkId: "code-purity/audit-project-usage",
        lawId: auditTruthLawId,
        filePath: repoPath,
        message: `${repoPath} does not use context.project and cannot prove AST-first enforcement.`,
      });
    }

    const antiEvasionCall = findAntiEvasionCall(inspectorFile);
    if (antiEvasionCall) {
      pushFinding({
        checkId: "code-purity/audit-anti-evasion",
        lawId: auditTruthLawId,
        filePath: repoPath,
        message: `${repoPath} uses text-search judgment ${antiEvasionCall} on ts-morph source text.`,
      });
    }
  }

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};