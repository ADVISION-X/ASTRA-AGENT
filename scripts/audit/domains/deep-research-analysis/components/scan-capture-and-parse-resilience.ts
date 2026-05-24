import {
  Node,
  SyntaxKind,
  type ImportDeclaration,
  type PropertyAssignment,
  type SourceFile,
} from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

type InspectInput = {
  context: InspectorContext;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
};

const captureAndParseFiles = {
  webChatEvaluation: "src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts",
  webChatAnswer: "src/capabilities/ai-input-gateway/providers/web-chat-answer.ts",
  webChatAnswerSupport: "src/capabilities/ai-input-gateway/providers/web-chat-answer-support.ts",
  parserSupport: "src/plugins/deep-research-analysis/deep-research-analysis.parser-support.ts",
  parser: "src/plugins/deep-research-analysis/deep-research-analysis.parser.ts",
  promptExchangeStages: "src/plugins/deep-research-analysis/deep-research-analysis.prompt-exchange-stages.ts",
  analysisSubQuestions: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts",
  analysisFinalization: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts",
  deckStage: "src/plugins/deep-research-analysis/deep-research-analysis.deck-stage.ts",
  decompositionPhase: "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-phase.ts",
} as const;

const getSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const getSourceText = (sourceFile: SourceFile | undefined): string => sourceFile?.getFullText() ?? "";

const track = (inspectedFiles: Set<string>, sourceFile: SourceFile | undefined, repoPath: string): void => {
  if (sourceFile) {
    inspectedFiles.add(getRepoSourcePath(sourceFile));
    return;
  }
  inspectedFiles.add(repoPath);
};

const hasVariableOrFunction = (sourceFile: SourceFile | undefined, name: string): boolean =>
  Boolean(sourceFile?.getVariableDeclaration(name) || sourceFile?.getFunction(name));

const hasSourceText = (sourceFile: SourceFile | undefined, expected: string): boolean =>
  getSourceText(sourceFile).includes(expected);

const hasAllSourceText = (sourceFile: SourceFile | undefined, expected: readonly string[]): boolean =>
  expected.every((snippet) => hasSourceText(sourceFile, snippet));

const hasNamedImport = (
  sourceFile: SourceFile | undefined,
  moduleSuffix: string,
  symbolName: string,
): boolean => Boolean(sourceFile?.getImportDeclarations().some((declaration: ImportDeclaration) =>
  declaration.getModuleSpecifierValue().endsWith(moduleSuffix)
  && declaration.getNamedImports().some((namedImport) => namedImport.getName() === symbolName)));

const hasIdentifierCall = (sourceFile: SourceFile | undefined, symbolName: string): boolean =>
  Boolean(sourceFile?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === symbolName;
  }));

const hasStringLiteral = (sourceFile: SourceFile | undefined, expected: string): boolean => {
  if (!sourceFile) return false;
  return sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .some((literal) => literal.getLiteralValue() === expected)
    || sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)
      .some((literal) => literal.getLiteralText().includes(expected));
};

const parseNumericLiteralValue = (value: string): number => Number(value.split("_").join(""));

const hasMinimumTimeoutMs = (sourceFile: SourceFile | undefined, minimumMs: number): boolean => {
  if (!sourceFile) return false;
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .some((property: PropertyAssignment) => {
      if (property.getName() !== "timeoutMs") return false;
      const initializer = property.getInitializer();
      if (!initializer || !Node.isNumericLiteral(initializer)) return false;
      return parseNumericLiteralValue(initializer.getText()) >= minimumMs;
    });
};

const hasTypeAliasProperty = (
  sourceFile: SourceFile | undefined,
  typeAliasName: string,
  propertyName: string,
): boolean => {
  const typeNode = sourceFile?.getTypeAlias(typeAliasName)?.getTypeNode();
  const typeLiteral = typeNode?.asKind(SyntaxKind.TypeLiteral);
  if (!typeLiteral) return false;
  return typeLiteral.getMembers().some((member) =>
    Node.isPropertySignature(member) && member.getName() === propertyName);
};

const hasObjectLiteralArgumentProperty = (
  sourceFile: SourceFile | undefined,
  callName: string,
  propertyName: string,
): boolean => {
  if (!sourceFile) return false;
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== callName) {
      return false;
    }
    const firstArg = call.getArguments()[0];
    if (!firstArg || !Node.isObjectLiteralExpression(firstArg)) {
      return false;
    }
    return firstArg.getProperties().some((property) =>
      Node.isPropertyAssignment(property) && property.getName() === propertyName);
  });
};

const hasParserFailureGuard = (sourceFile: SourceFile | undefined): boolean => {
  if (!sourceFile) return false;
  return sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement).some((statement) => {
    const expression = statement.getExpression();
    return Node.isPrefixUnaryExpression(expression)
      && expression.getOperatorToken() === SyntaxKind.ExclamationToken
      && expression.getOperand().getText() === "isDeepResearchParserSuccess(parsed)";
  });
};

const inspectWebChatVisibleFallback = (input: InspectInput, webChatEvaluationFile: SourceFile | undefined): void => {
  if (hasAllSourceText(webChatEvaluationFile, [
    "isVisibleAssistantFallbackNode",
    "dedupeCandidates",
    "answer extracted from visible assistant fallback",
  ])) {
    return;
  }
  input.findings.push(createFinding({
    checkId: "deep-research/web-chat-visible-answer-fallback",
    lawId: input.lawId,
    filePath: captureAndParseFiles.webChatEvaluation,
    message: "Web chat DOM capture must keep a visible assistant text fallback so human-visible replies are not lost when the structured extractor misses them.",
  }));
};

const inspectWebChatActivityTimeout = (
  input: InspectInput,
  webChatAnswerFile: SourceFile | undefined,
): void => {
  if (
    hasNamedImport(webChatAnswerFile, "./web-chat-answer-support.js", "noteStableAnswerActivity")
    && hasIdentifierCall(webChatAnswerFile, "noteStableAnswerActivity")
    && hasVariableOrFunction(webChatAnswerFile, "waitForStableAnswer")
    && hasSourceText(webChatAnswerFile, "hardDeadline")
  ) {
    return;
  }
  input.findings.push(createFinding({
    checkId: "deep-research/web-chat-activity-timeout",
    lawId: input.lawId,
    filePath: captureAndParseFiles.webChatAnswer,
    message: "Web chat response waiting must extend on activity signals and keep a hard fuse instead of using one fixed wall-clock timeout as the completion decision.",
  }));
};

const inspectWebChatActivityState = (
  input: InspectInput,
  webChatAnswerSupportFile: SourceFile | undefined,
): void => {
  if (
    hasTypeAliasProperty(webChatAnswerSupportFile, "StableAnswerState", "lastActivityAt")
    && hasVariableOrFunction(webChatAnswerSupportFile, "noteStableAnswerActivity")
  ) {
    return;
  }
  input.findings.push(createFinding({
    checkId: "deep-research/web-chat-activity-state",
    lawId: input.lawId,
    filePath: captureAndParseFiles.webChatAnswerSupport,
    message: "Web chat answer support must track activity timestamps and expose noteStableAnswerActivity for activity-based waiting.",
  }));
};

const inspectParserStatusResilience = (input: InspectInput, parserSupportFile: SourceFile | undefined): void => {
  if (
    hasVariableOrFunction(parserSupportFile, "buildTextFallbackResult")
    && hasVariableOrFunction(parserSupportFile, "isDeepResearchParserSuccess")
    && hasStringLiteral(parserSupportFile, "parsed_text_fallback")
    && hasStringLiteral(parserSupportFile, "parsed_json_from_fence")
    && hasStringLiteral(parserSupportFile, "parsed_json_from_balanced_object")
    && hasStringLiteral(parserSupportFile, "failed_empty")
    && hasStringLiteral(parserSupportFile, "failed_unusable")
  ) {
    return;
  }
  input.findings.push(createFinding({
    checkId: "deep-research/parser-status-resilience",
    lawId: input.lawId,
    filePath: captureAndParseFiles.parserSupport,
    message: "Deep Research parser support must preserve JSON source provenance, distinguish empty versus unusable failures, and expose parsed_text_fallback as a lawful success state.",
  }));
};

const inspectParserTextFallbackUse = (input: InspectInput, parserFile: SourceFile | undefined): void => {
  if (
    hasVariableOrFunction(parserFile, "buildSubQuestionAnalysisTextFallbackValue")
    && hasVariableOrFunction(parserFile, "buildFinalAdjudicationTextFallbackValue")
    && hasIdentifierCall(parserFile, "buildTextFallbackResult")
  ) {
    return;
  }
  input.findings.push(createFinding({
    checkId: "deep-research/parser-text-fallback-use",
    lawId: input.lawId,
    filePath: captureAndParseFiles.parser,
    message: "Deep Research parser must convert non-empty narrative analysis and final adjudication replies into lawful text fallback records instead of hard-failing on json_parse_failed.",
  }));
};

const inspectPromptExchangeSuccessGuard = (
  input: InspectInput,
  promptExchangeStagesFile: SourceFile | undefined,
): void => {
  if (
    hasNamedImport(promptExchangeStagesFile, "./deep-research-analysis.parser.js", "isDeepResearchParserSuccess")
    && hasParserFailureGuard(promptExchangeStagesFile)
  ) {
    return;
  }
  input.findings.push(createFinding({
    checkId: "deep-research/prompt-exchange-success-guard",
    lawId: input.lawId,
    filePath: captureAndParseFiles.promptExchangeStages,
    message: "Prompt exchange stages must branch on isDeepResearchParserSuccess so new successful parse statuses are not misclassified as failures.",
  }));
};

const inspectAnalysisTimeoutAndFallbackContext = (
  input: InspectInput,
  analysisSubQuestionsFile: SourceFile | undefined,
): void => {
  if (
    hasMinimumTimeoutMs(analysisSubQuestionsFile, 600_000)
    && hasObjectLiteralArgumentProperty(analysisSubQuestionsFile, "parseDeepResearchSubQuestionAnalysisResponse", "subQuestionId")
  ) {
    return;
  }
  input.findings.push(createFinding({
    checkId: "deep-research/analysis-timeout-and-fallback-context",
    lawId: input.lawId,
    filePath: captureAndParseFiles.analysisSubQuestions,
    message: "Sub-question analysis must run with a deep-timeout budget and must pass subQuestionId into parser fallback normalization.",
  }));
};

const inspectTimeoutBudget = (input: {
  findings: InspectorFinding[];
  lawId: string;
  sourceFile: SourceFile | undefined;
  minimumMs: number;
  checkId: string;
  filePath: string;
  message: string;
}): void => {
  if (hasMinimumTimeoutMs(input.sourceFile, input.minimumMs)) {
    return;
  }
  input.findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.filePath,
    message: input.message,
  }));
};

export const inspectCaptureAndParseResilience = (input: InspectInput): void => {
  const webChatEvaluationFile = getSourceFile(input.context, captureAndParseFiles.webChatEvaluation);
  const webChatAnswerFile = getSourceFile(input.context, captureAndParseFiles.webChatAnswer);
  const webChatAnswerSupportFile = getSourceFile(input.context, captureAndParseFiles.webChatAnswerSupport);
  const parserSupportFile = getSourceFile(input.context, captureAndParseFiles.parserSupport);
  const parserFile = getSourceFile(input.context, captureAndParseFiles.parser);
  const promptExchangeStagesFile = getSourceFile(input.context, captureAndParseFiles.promptExchangeStages);
  const analysisSubQuestionsFile = getSourceFile(input.context, captureAndParseFiles.analysisSubQuestions);
  const analysisFinalizationFile = getSourceFile(input.context, captureAndParseFiles.analysisFinalization);
  const deckStageFile = getSourceFile(input.context, captureAndParseFiles.deckStage);
  const decompositionPhaseFile = getSourceFile(input.context, captureAndParseFiles.decompositionPhase);

  for (const repoPath of Object.values(captureAndParseFiles)) {
    track(input.inspectedFiles, getSourceFile(input.context, repoPath), repoPath);
  }
  inspectWebChatVisibleFallback(input, webChatEvaluationFile);
  inspectWebChatActivityTimeout(input, webChatAnswerFile);
  inspectWebChatActivityState(input, webChatAnswerSupportFile);
  inspectParserStatusResilience(input, parserSupportFile);
  inspectParserTextFallbackUse(input, parserFile);
  inspectPromptExchangeSuccessGuard(input, promptExchangeStagesFile);
  inspectAnalysisTimeoutAndFallbackContext(input, analysisSubQuestionsFile);
  inspectTimeoutBudget({
    findings: input.findings,
    lawId: input.lawId,
    sourceFile: analysisFinalizationFile,
    minimumMs: 1_200_000,
    checkId: "deep-research/final-adjudication-timeout-budget",
    filePath: captureAndParseFiles.analysisFinalization,
    message: "Final adjudication must use a long timeout budget suitable for deep reasoning instead of the short default prompt timeout.",
  });
  inspectTimeoutBudget({
    findings: input.findings,
    lawId: input.lawId,
    sourceFile: deckStageFile,
    minimumMs: 1_800_000,
    checkId: "deep-research/business-ppt-timeout-budget",
    filePath: captureAndParseFiles.deckStage,
    message: "Business PPT artifact generation must use a long timeout budget suitable for AI deck generation and download handoff.",
  });
  inspectTimeoutBudget({
    findings: input.findings,
    lawId: input.lawId,
    sourceFile: decompositionPhaseFile,
    minimumMs: 300_000,
    checkId: "deep-research/decomposition-timeout-budget",
    filePath: captureAndParseFiles.decompositionPhase,
    message: "Deep Research decomposition must keep a timeout budget above the short default boundary so complex question breakdowns are not prematurely killed.",
  });
};