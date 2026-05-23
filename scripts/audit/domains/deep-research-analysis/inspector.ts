import { existsSync, readFileSync } from "node:fs";

import {
  Node,
  Project,
  SyntaxKind,
  type CallExpression,
  type ExportDeclaration,
  type Identifier,
  type ImportDeclaration,
  type ObjectLiteralExpression,
  type PropertyAccessExpression,
  type SourceFile,
  type StringLiteral,
  type Symbol,
  type TypeChecker,
  type VariableDeclaration,
} from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { inspectSmokeAcceptance } from "./inspector-smoke.js";
import { inspectDecompositionPromptV2 } from "./components/scan-decomposition-prompt-v2.js";
import { inspectSubQuestionPersistenceIdentity } from "./components/scan-sub-question-persistence-identity.js";
import { inspectWebChatProviderHandoff } from "./components/scan-web-chat-provider-handoff.js";

const requiredFiles = [
  "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-prompt.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-contracts.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-schema.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-parser.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-hash.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-quality.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-regression.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.flow.ts",
  "scripts/acceptance/deep-research-decomposition-prompt.acceptance.ts",
  "scripts/acceptance/deep-research-analysis-smoke.ts",
] as const;

const forbiddenRuntimeFields = [
  "nextAction",
  "actionPlan",
  "browserCommand",
  "selector",
  "coordinate",
  "workflow",
  "multiStepPlan",
  "runNext",
] as const;

const promptTextAllowedFiles = new Set([
  "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-prompt.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-regression.ts",
]);

const decompositionAuditFiles = new Set([
  "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-prompt.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-schema.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-parser.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-contracts.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-quality.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-regression.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-hash.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.flow.ts",
]);

const getSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const track = (inspectedFiles: Set<string>, sourceFile: SourceFile | undefined): void => {
  if (sourceFile) inspectedFiles.add(getRepoSourcePath(sourceFile));
};

const getObjectPropertyText = (objectLiteral: ObjectLiteralExpression, propertyName: string): string | null => {
  const property = objectLiteral.getProperty(propertyName);
  if (!property || !Node.isPropertyAssignment(property)) return null;
  const initializer = property.getInitializer();
  if (initializer && Node.isStringLiteral(initializer)) return initializer.getLiteralValue();
  return initializer?.getText() ?? null;
};

const unwrapObjectLiteral = (initializer: Node | undefined): ObjectLiteralExpression | null => {
  if (!initializer) return null;
  if (Node.isObjectLiteralExpression(initializer)) return initializer;
  if (Node.isAsExpression(initializer)) {
    const expression = initializer.getExpression();
    return Node.isObjectLiteralExpression(expression) ? expression : null;
  }
  return null;
};

const countAstCoverageNodes = (project: Project, sourceFile: SourceFile): number => {
  const checker: TypeChecker = project.getTypeChecker();
  const imports: ImportDeclaration[] = sourceFile.getImportDeclarations();
  const exports: ExportDeclaration[] = sourceFile.getExportDeclarations();
  const variables: VariableDeclaration[] = sourceFile.getVariableDeclarations();
  const calls: CallExpression[] = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  const properties: PropertyAccessExpression[] = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
  const strings: StringLiteral[] = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral);
  const identifiers: Identifier[] = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);
  const resolvedSymbols: Symbol[] = identifiers
    .map((identifier) => checker.getSymbolAtLocation(identifier))
    .filter((symbol): symbol is Symbol => Boolean(symbol));
  return imports.length
    + exports.length
    + variables.length
    + calls.length
    + properties.length
    + strings.length
    + identifiers.length
    + resolvedSymbols.length;
};

const inspectRequiredFiles = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const repoPath of requiredFiles) {
    inspectedFiles.add(repoPath);
    if (existsSync(resolveFromRepo(repoPath))) continue;
    findings.push(createFinding({
      checkId: "deep-research/required-file",
      lawId,
      filePath: repoPath,
      message: `${repoPath} is required by the decomposition prompt asset contract.`,
    }));
  }
};

const inspectPromptAsset = (
  sourceFile: SourceFile | undefined,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  if (!sourceFile) {
    findings.push(createFinding({
      checkId: "deep-research/prompt-asset",
      lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-prompt.ts",
      message: "DEEP_RESEARCH_DECOMPOSITION_PROMPT must be an object literal prompt asset.",
    }));
    return;
  }
  const declaration = sourceFile.getVariableDeclaration("DEEP_RESEARCH_DECOMPOSITION_PROMPT");
  const initializer = unwrapObjectLiteral(declaration?.getInitializer());
  if (!initializer) {
    findings.push(createFinding({
      checkId: "deep-research/prompt-asset",
      lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-prompt.ts",
      message: "DEEP_RESEARCH_DECOMPOSITION_PROMPT must be an object literal prompt asset.",
    }));
    return;
  }
  const repoPath = getRepoSourcePath(sourceFile);
  const requiredProperties = ["promptId", "promptVersion", "phase", "outputContractId", "text"];
  for (const propertyName of requiredProperties) {
    if (initializer.getProperty(propertyName)) continue;
    findings.push(createFinding({
      checkId: "deep-research/prompt-asset-property",
      lawId,
      filePath: repoPath,
      message: `Prompt asset is missing ${propertyName}.`,
    }));
  }
  if (getObjectPropertyText(initializer, "phase") !== "decompose") {
    findings.push(createFinding({
      checkId: "deep-research/prompt-asset-phase",
      lawId,
      filePath: repoPath,
      message: "DEEP_RESEARCH_DECOMPOSITION_PROMPT.phase must equal decompose.",
    }));
  }
  if (!sourceFile.getFunction("renderDecompositionPrompt") && !sourceFile.getVariableDeclaration("renderDecompositionPrompt")) {
    findings.push(createFinding({
      checkId: "deep-research/render-function",
      lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-prompt.ts",
      message: "renderDecompositionPrompt must be exported from the lawful prompt file.",
    }));
  }
};

const inspectPromptScatter = (
  sourceFiles: readonly SourceFile[],
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const sourceFile of sourceFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (promptTextAllowedFiles.has(repoPath)) continue;
    const longString = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral)
      .find((literal: StringLiteral) =>
        literal.getLiteralValue().length > 300
        && /you are|return one json|expected output contract/iu.test(literal.getLiteralValue()),
      );
    const longTemplate = sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)
      .find((literal) =>
        literal.getLiteralText().length > 300
        && /you are|return one json|expected output contract/iu.test(literal.getLiteralText()),
      );
    if (!longString && !longTemplate) continue;
    findings.push(createFinding({
      checkId: "deep-research/prompt-scatter",
      lawId,
      filePath: repoPath,
      message: "Long prompt-like strings must stay in prompt asset files.",
    }));
  }
};

const inspectForbiddenRuntimeFields = (
  sourceFiles: readonly SourceFile[],
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const sourceFile of sourceFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (promptTextAllowedFiles.has(repoPath) || repoPath.includes("acceptance")) continue;
    const forbidden = new Set<string>();
    sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).forEach((identifier) => {
      if (forbiddenRuntimeFields.some((field) => field === identifier.getText())) {
        forbidden.add(identifier.getText());
      }
    });
    sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).forEach((literal) => {
      if (forbiddenRuntimeFields.some((field) => field === literal.getLiteralValue())) {
        forbidden.add(literal.getLiteralValue());
      }
    });
    if (forbidden.size === 0) continue;
    findings.push(createFinding({
      checkId: "deep-research/forbidden-runtime-field",
      lawId,
      filePath: repoPath,
      message: `Forbidden AI control field appears in active runtime surface: ${[...forbidden].join(", ")}.`,
    }));
  }
};

const hasImportedSymbol = (sourceFile: SourceFile, symbolName: string, moduleSuffix: string): boolean =>
  sourceFile.getImportDeclarations().some((declaration: ImportDeclaration) =>
    declaration.getModuleSpecifierValue().endsWith(moduleSuffix)
    && declaration.getNamedImports().some((namedImport) => namedImport.getName() === symbolName),
  );

const hasCallExpression = (sourceFile: SourceFile, symbolName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((call: CallExpression) => {
    const expression = call.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === symbolName;
  });

const inspectFlowIntegration = (
  flowFile: SourceFile | undefined,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  if (!flowFile) return;
  const requirements = [
    {
      symbolName: "renderDecompositionPrompt",
      moduleSuffix: "deep-research-analysis.decomposition-prompt.js",
      checkId: "deep-research/flow-render-symbol",
    },
    {
      symbolName: "parseDecompositionResponse",
      moduleSuffix: "deep-research-analysis.decomposition-parser.js",
      checkId: "deep-research/flow-parser-symbol",
    },
    {
      symbolName: "scoreDecompositionQuality",
      moduleSuffix: "deep-research-analysis.prompt-quality.js",
      checkId: "deep-research/flow-quality-symbol",
    },
    {
      symbolName: "buildDeepResearchPromptHash",
      moduleSuffix: "deep-research-analysis.prompt-hash.js",
      checkId: "deep-research/flow-hash-symbol",
    },
  ];
  for (const requirement of requirements) {
    if (hasImportedSymbol(flowFile, requirement.symbolName, requirement.moduleSuffix)
      && hasCallExpression(flowFile, requirement.symbolName)) continue;
    findings.push(createFinding({
      checkId: requirement.checkId,
      lawId,
      filePath: getRepoSourcePath(flowFile),
      message: `Flow must import and call lawful symbol ${requirement.symbolName}.`,
    }));
  }
  for (const requiredIdentifier of ["promptHash", "rawResponseHash"]) {
    if (flowFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === requiredIdentifier)) continue;
    findings.push(createFinding({
      checkId: "deep-research/flow-hash-persist",
      lawId,
      filePath: getRepoSourcePath(flowFile),
      message: `Flow must preserve ${requiredIdentifier}.`,
    }));
  }
};

const inspectParserHonesty = (
  parserFile: SourceFile | undefined,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  if (!parserFile) return;
  const dishonestCatch = parserFile.getDescendantsOfKind(SyntaxKind.CatchClause).some((clause) =>
    clause.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralValue() === "parsed"),
  );
  if (dishonestCatch) {
    findings.push(createFinding({
      checkId: "deep-research/parser-catch-success",
      lawId,
      filePath: getRepoSourcePath(parserFile),
      message: "Parser must not label catch-path parse results as parsed.",
    }));
  }
};

const inspectAntiEvasion = (
  sourceFiles: readonly SourceFile[],
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const sourceFile of sourceFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!decompositionAuditFiles.has(repoPath)) continue;
    const hasAny = sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword).length > 0;
    const hasDynamicImport = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
      .some((call) => call.getExpression().getKind() === SyntaxKind.ImportKeyword);
    const hasBracketAccess = sourceFile.getDescendantsOfKind(SyntaxKind.ElementAccessExpression).length > 0;
    if (!hasAny && !hasDynamicImport && !hasBracketAccess) continue;
    findings.push(createFinding({
      checkId: "deep-research/anti-evasion",
      lawId,
      filePath: repoPath,
      message: "Deep research decomposition files must not use any, dynamic import, or bracket property access.",
    }));
  }
};

const inspectRegressionFixtures = (
  regressionFile: SourceFile | undefined,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  if (!regressionFile) return;
  const fixtureVariable = regressionFile.getVariableDeclaration("DEEP_RESEARCH_DECOMPOSITION_REGRESSION_FIXTURES");
  const initializer = fixtureVariable?.getInitializer();
  if (!initializer || !Node.isArrayLiteralExpression(initializer) || initializer.getElements().length < 10) {
    findings.push(createFinding({
      checkId: "deep-research/regression-fixtures",
      lawId,
      filePath: getRepoSourcePath(regressionFile),
      message: "Regression fixture set must contain at least 10 fixtures.",
    }));
  }
};

type DeepResearchAuditFiles = {
  promptFile: SourceFile | undefined;
  parserFile: SourceFile | undefined;
  flowFile: SourceFile | undefined;
  regressionFile: SourceFile | undefined;
  promptsFile: SourceFile | undefined;
  qualityFile: SourceFile | undefined;
  decompositionAcceptanceFile: SourceFile | undefined;
  smokeFile: SourceFile | undefined;
  ciFullFile: SourceFile | undefined;
};

const inspectDeepResearchStaticRules = (input: {
  context: InspectorContext;
  sourceFiles: readonly SourceFile[];
  files: DeepResearchAuditFiles;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
  captureLawId: string;
  smokeLawId: string;
}): void => {
  inspectPromptAsset(input.files.promptFile, input.findings, input.lawId);
  inspectPromptScatter(input.sourceFiles, input.findings, input.lawId);
  inspectForbiddenRuntimeFields(input.sourceFiles, input.findings, input.lawId);
  inspectFlowIntegration(input.files.flowFile, input.findings, input.lawId);
  inspectParserHonesty(input.files.parserFile, input.findings, input.lawId);
  inspectAntiEvasion(input.sourceFiles, input.findings, input.lawId);
  inspectRegressionFixtures(input.files.regressionFile, input.findings, input.lawId);
  inspectWebChatProviderHandoff({
    context: input.context,
    findings: input.findings,
    inspectedFiles: input.inspectedFiles,
    lawId: input.captureLawId,
  });
  inspectSubQuestionPersistenceIdentity({
    context: input.context,
    findings: input.findings,
    inspectedFiles: input.inspectedFiles,
    lawId: input.captureLawId,
  });
  inspectDecompositionPromptV2({
    promptFile: input.files.promptFile,
    promptsFile: input.files.promptsFile,
    acceptanceFile: input.files.decompositionAcceptanceFile,
    qualityFile: input.files.qualityFile,
    findings: input.findings,
    inspectedFiles: input.inspectedFiles,
    lawId: input.lawId,
  });
  inspectSmokeAcceptance({
    smokeFile: input.files.smokeFile,
    ciFullFile: input.files.ciFullFile,
    findings: input.findings,
    inspectedFiles: input.inspectedFiles,
    lawId: input.smokeLawId,
    hasAstCoverage: input.files.smokeFile
      ? countAstCoverageNodes(input.files.smokeFile.getProject(), input.files.smokeFile) > 0
      : false,
  });
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-001-V1");
  const captureLawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-003-V1");
  const smokeLawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-013-V1");
  const findings: InspectorFinding[] = [];
  const inspectedFiles = new Set<string>();
  const sourceFiles = context.project.getSourceFiles("src/plugins/deep-research-analysis/**/*.ts");
  sourceFiles.forEach((sourceFile) => inspectedFiles.add(getRepoSourcePath(sourceFile)));

  inspectRequiredFiles(findings, inspectedFiles, lawId);
  const files: DeepResearchAuditFiles = {
    promptFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-prompt.ts"),
    parserFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-parser.ts"),
    flowFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.flow.ts"),
    regressionFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.prompt-regression.ts"),
    promptsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts"),
    qualityFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.prompt-quality.ts"),
    decompositionAcceptanceFile: getSourceFile(context, "scripts/acceptance/deep-research-decomposition-prompt.acceptance.ts"),
    smokeFile: getSourceFile(context, "scripts/acceptance/deep-research-analysis-smoke.ts"),
    ciFullFile: getSourceFile(context, "scripts/audit/ci-full.ts"),
  };
  Object.values(files)
    .forEach((sourceFile) => track(inspectedFiles, sourceFile));
  const astCoverageCount = files.flowFile ? countAstCoverageNodes(context.project, files.flowFile) : 0;

  inspectDeepResearchStaticRules({
    context,
    sourceFiles,
    files,
    findings,
    inspectedFiles,
    lawId,
    captureLawId,
    smokeLawId,
  });
  if (astCoverageCount === 0) {
    findings.push(createFinding({
      checkId: "deep-research/ast-coverage",
      lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.flow.ts",
      message: "Inspector must exercise ts-morph AST and symbol surfaces for the flow file.",
    }));
  }

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};
