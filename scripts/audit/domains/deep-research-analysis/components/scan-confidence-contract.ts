import { Node, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const confidenceRuleSnippets = [
  "Prioritize analytical content over perfect formatting.",
  "confidence may be low/medium/high, a numeric score, or a percentage; the system will normalize it.",
  "If a preferred field is unavailable, omit it instead of inventing evidence.",
] as const;

const promptNames = [
  "subQuestionAnalysisPrompt",
  "finalAdjudicationPrompt",
] as const;

const promptSpecificSnippets: Partial<Record<typeof promptNames[number], readonly string[]>> = {
  finalAdjudicationPrompt: [
    "finalVerdict should be a concise label",
  ],
};

const readPromptTextLiterals = (
  sourceFile: SourceFile,
  promptName: string,
): string => {
  const declaration = sourceFile.getVariableDeclaration(promptName);
  const initializer = declaration?.getInitializer();
  if (!initializer) return "";
  const promptTextProperty = Node.isObjectLiteralExpression(initializer)
    ? initializer.getProperty("promptText")
    : null;
  const promptTextInitializer = promptTextProperty && Node.isPropertyAssignment(promptTextProperty)
    ? promptTextProperty.getInitializer()
    : initializer;
  if (!promptTextInitializer) {
    return "";
  }
  return promptTextInitializer.getDescendants()
    .flatMap((node) => {
      if (Node.isStringLiteral(node)) {
        return [node.getLiteralValue()];
      }
      if (Node.isNoSubstitutionTemplateLiteral(node)) {
        return [node.getLiteralText()];
      }
      return [];
    })
    .join("\n");
};

export const inspectConfidenceContract = (input: {
  promptsFile: SourceFile | undefined;
  finalAdjudicationPromptFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  if (!input.promptsFile || !input.finalAdjudicationPromptFile) {
    input.findings.push(createFinding({
      checkId: "deep-research/confidence-contract",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.final-adjudication-prompt.ts",
      message: "Deep Research prompt owner files are required for confidence contract inspection.",
    }));
    return;
  }
  input.inspectedFiles.add(getRepoSourcePath(input.promptsFile));
  input.inspectedFiles.add(getRepoSourcePath(input.finalAdjudicationPromptFile));
  for (const promptName of promptNames) {
    const sourceFile = promptName === "finalAdjudicationPrompt"
      ? input.finalAdjudicationPromptFile
      : input.promptsFile;
    const promptText = readPromptTextLiterals(sourceFile, promptName);
    const requiredSnippets = [
      ...confidenceRuleSnippets,
      ...(promptSpecificSnippets[promptName] ?? []),
    ];
    if (requiredSnippets.every((snippet) => promptText.includes(snippet))) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/confidence-contract",
      lawId: input.lawId,
      filePath: getRepoSourcePath(sourceFile),
      message: `${promptName} must prioritize analytical content over exact formatting and must allow runtime confidence normalization in the default 1+N+1 flow.`,
    }));
  }
};
