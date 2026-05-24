import {
  Node,
  SyntaxKind,
  type ObjectLiteralExpression,
  type SourceFile,
  type StringLiteral,
} from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const promptFilePath = "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-prompt.ts";
const promptsFilePath = "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts";
const acceptanceFilePath = "scripts/acceptance/deep-research-decomposition-prompt.acceptance.ts";
const qualityFilePath = "src/plugins/deep-research-analysis/deep-research-analysis.prompt-quality.ts";

const requiredPromptTerms = [
  "requiredEvidence",
  "whyItMatters",
  "decisionWeight",
  "analysisFocus",
  "omissionRisk",
  "exhaustivenessCheck",
  "qualitySelfCheck",
  "missingInfo",
  "Do not include contractId",
  "Do not include format",
] as const;

const exactRootFields = [
  "mainQuestion",
  "questionType",
  "decompositionStrategy",
  "missingInfo",
  "subQuestions",
  "exhaustivenessCheck",
  "qualitySelfCheck",
] as const;

const exactSubQuestionFields = [
  "id",
  "title",
  "questionText",
  "whyItMatters",
  "decisionWeight",
  "analysisFocus",
  "requiredEvidence",
  "scope",
  "expectedAnswerShape",
  "priority",
  "omissionRisk",
] as const;

const getObjectPropertyLiteralText = (
  objectLiteral: ObjectLiteralExpression,
  propertyName: string,
): string | null => {
  const property = objectLiteral.getProperty(propertyName);
  if (!property || !Node.isPropertyAssignment(property)) return null;
  const initializer = property.getInitializer();
  if (!initializer) return null;
  if (Node.isNoSubstitutionTemplateLiteral(initializer)) {
    return initializer.getLiteralText();
  }
  if (Node.isStringLiteral(initializer)) {
    return initializer.getLiteralValue();
  }
  return null;
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

const getPromptAssetText = (promptFile: SourceFile | undefined): string | null => {
  const declaration = promptFile?.getVariableDeclaration("DEEP_RESEARCH_DECOMPOSITION_PROMPT");
  const initializer = unwrapObjectLiteral(declaration?.getInitializer());
  if (!initializer) return null;
  return getObjectPropertyLiteralText(initializer, "text");
};

const pushFinding = (
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  checkId: string,
  message: string,
): void => {
  findings.push(createFinding({ checkId, lawId, filePath, message }));
};

const inspectPromptTerms = (
  promptText: string | null,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  if (!promptText) {
    pushFinding(findings, lawId, promptFilePath, "deep-research/decomposition-prompt-v2", "Prompt asset text must be a literal V2 prompt.");
    return;
  }
  for (const term of requiredPromptTerms) {
    if (promptText.includes(term)) continue;
    pushFinding(findings, lawId, promptFilePath, "deep-research/decomposition-prompt-v2-term", `V2 prompt is missing ${term}.`);
  }
  for (const field of exactRootFields) {
    if (promptText.includes(field)) continue;
    pushFinding(findings, lawId, promptFilePath, "deep-research/decomposition-root-fields", `V2 prompt is missing root field ${field}.`);
  }
  for (const field of exactSubQuestionFields) {
    if (promptText.includes(field)) continue;
    pushFinding(findings, lawId, promptFilePath, "deep-research/decomposition-subquestion-fields", `V2 prompt is missing subQuestion field ${field}.`);
  }
};

const inspectPromptsReuse = (
  promptsFile: SourceFile | undefined,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  if (!promptsFile) return;
  const decomposition = promptsFile.getVariableDeclaration("decompositionPrompt");
  const initializer = decomposition?.getInitializer();
  if (!initializer || !Node.isCallExpression(initializer)) {
    pushFinding(findings, lawId, promptsFilePath, "deep-research/decomposition-prompt-export", "prompts.ts must build decompositionPrompt from the unique prompt asset.");
    return;
  }
  const literalPromptText = initializer.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .some((literal: StringLiteral) => literal.getLiteralValue().length > 80);
  const usesAssetText = initializer.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((access) => access.getText() === "DEEP_RESEARCH_DECOMPOSITION_PROMPT.text");
  if (literalPromptText || !usesAssetText) {
    pushFinding(findings, lawId, promptsFilePath, "deep-research/decomposition-prompt-dual-truth", "prompts.ts must not keep a second decomposition prompt body.");
  }
  const renderFunction = promptsFile.getVariableDeclaration("renderDeepResearchDecompositionPrompt");
  const callsUniqueRenderer = renderFunction?.getInitializer()?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === "renderDecompositionPrompt") ?? false;
  if (!callsUniqueRenderer) {
    pushFinding(findings, lawId, promptsFilePath, "deep-research/decomposition-render-reuse", "renderDeepResearchDecompositionPrompt must call the unique renderDecompositionPrompt.");
  }
};

const inspectAcceptanceCoverage = (
  acceptanceFile: SourceFile | undefined,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const literals = acceptanceFile?.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .map((literal) => literal.getLiteralValue()) ?? [];
  for (const requiredFixture of ["invalid-old-decomposition-response.json", "valid-iran-war-response.json"]) {
    if (literals.includes(requiredFixture)) continue;
    pushFinding(findings, lawId, acceptanceFilePath, "deep-research/decomposition-acceptance-fixture", `Acceptance must cover ${requiredFixture}.`);
  }
};

const inspectQualityCoverage = (
  qualityFile: SourceFile | undefined,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const leakageHelper = qualityFile?.getFunction("detectFinalAdjudicationLeakage")
    ?? qualityFile?.getVariableDeclaration("detectFinalAdjudicationLeakage")
    ?? qualityFile?.getFunction("detectFinalSynthesisLeakage")
    ?? qualityFile?.getVariableDeclaration("detectFinalSynthesisLeakage");
  if (!leakageHelper) {
    pushFinding(findings, lawId, qualityFilePath, "deep-research/final-synthesis-leakage-quality", "Quality scorer must define detectFinalSynthesisLeakage.");
  }
  const scoreFunction = qualityFile?.getFunction("scoreDecompositionQuality")
    ?? qualityFile?.getVariableDeclaration("scoreDecompositionQuality");
  const callsLeakage = scoreFunction?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) =>
      Node.isIdentifier(call.getExpression())
      && ["detectFinalAdjudicationLeakage", "detectFinalSynthesisLeakage"].includes(call.getExpression().getText())) ?? false;
  if (!callsLeakage) {
    pushFinding(findings, lawId, qualityFilePath, "deep-research/final-synthesis-leakage-quality-call", "scoreDecompositionQuality must call the final-adjudication leakage detector.");
  }
};

export const inspectDecompositionPromptV2 = (input: {
  promptFile: SourceFile | undefined;
  promptsFile: SourceFile | undefined;
  acceptanceFile: SourceFile | undefined;
  qualityFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of [input.promptFile, input.promptsFile, input.acceptanceFile, input.qualityFile]) {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }
  inspectPromptTerms(getPromptAssetText(input.promptFile), input.findings, input.lawId);
  inspectPromptsReuse(input.promptsFile, input.findings, input.lawId);
  inspectAcceptanceCoverage(input.acceptanceFile, input.findings, input.lawId);
  inspectQualityCoverage(input.qualityFile, input.findings, input.lawId);
};
