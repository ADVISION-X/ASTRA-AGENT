import { Node, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const confidenceRuleSnippets = [
  "Prioritize analytical content over perfect formatting.",
  "confidence may be low/medium/high, a numeric score, or a percentage; the system will normalize it.",
  "If a preferred field is unavailable, omit it instead of inventing evidence.",
] as const;

const promptSpecificSnippets: Partial<Record<typeof promptNames[number], readonly string[]>> = {
  finalSynthesisPrompt: [
    "you may omit conflictMatrix",
  ],
};

const promptNames = [
  "positiveAnalysisPrompt",
  "falsificationPrompt",
  "finalSynthesisPrompt",
] as const;

const readPromptTextLiterals = (
  sourceFile: SourceFile,
  promptName: string,
): string => {
  const declaration = sourceFile.getVariableDeclaration(promptName);
  const initializer = declaration?.getInitializer();
  if (!initializer || !Node.isCallExpression(initializer)) return "";
  return initializer.getDescendants()
    .filter((node) => Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node))
    .map((node) => Node.isStringLiteral(node) ? node.getLiteralValue() : node.getLiteralText())
    .join("\n");
};

export const inspectConfidenceContract = (input: {
  promptsFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  if (!input.promptsFile) {
    input.findings.push(createFinding({
      checkId: "deep-research/confidence-contract",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts",
      message: "Deep Research prompt file is required for confidence contract inspection.",
    }));
    return;
  }
  input.inspectedFiles.add(getRepoSourcePath(input.promptsFile));
  for (const promptName of promptNames) {
    const promptText = readPromptTextLiterals(input.promptsFile, promptName);
    const requiredSnippets = [
      ...confidenceRuleSnippets,
      ...(promptSpecificSnippets[promptName] ?? []),
    ];
    if (requiredSnippets.every((snippet) => promptText.includes(snippet))) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/confidence-contract",
      lawId: input.lawId,
      filePath: getRepoSourcePath(input.promptsFile),
      message: `${promptName} must prioritize analytical content over exact formatting and must allow runtime confidence normalization.`,
    }));
  }
};
