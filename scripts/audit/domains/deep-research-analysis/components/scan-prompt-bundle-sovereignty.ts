import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const hasIdentifier = (sourceFile: SourceFile | undefined, name: string): boolean =>
  !!sourceFile?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === name);

const hasPropertyAccessPath = (sourceFile: SourceFile | undefined, path: string): boolean =>
  !!sourceFile?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((expression) => expression.getText() === path);

const stringLiteralValues = (sourceFile: SourceFile): string[] => [
  ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((literal) => literal.getLiteralText()),
];

const fixedBusinessPromptFragments = [
  "You are an independent research analyst",
  "Preferred fields:",
  "Required structure:",
  "rankedConclusions",
  "finalVerdict",
  "strongConclusions",
  "conditionalConclusions",
] as const;

const inspectPlanSchema = (input: {
  researchPlanSchemaFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const filePath = "src/plugins/deep-research-analysis/deep-research-analysis.research-plan-schema.ts";
  const requiredIdentifiers = [
    "promptBundle",
    "finalAdjudicationPromptBundle",
    "htmlReportPromptBundle",
  ];
  for (const identifier of requiredIdentifiers) {
    if (hasIdentifier(input.researchPlanSchemaFile, identifier)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/prompt-bundle-plan-schema",
      lawId: input.lawId,
      filePath,
      message: `ResearchPlan schema must include ${identifier}.`,
    }));
  }
};

const inspectRuntimeUsage = (input: {
  analysisSubQuestionsFile: SourceFile | undefined;
  finalizationFile: SourceFile | undefined;
  htmlReportStageFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const checks = [
    {
      ok: hasPropertyAccessPath(input.analysisSubQuestionsFile, "subQuestion.question.promptBundle"),
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts",
      message: "N-stage analysis must use the exact sub-question promptBundle.",
    },
    {
      ok: hasPropertyAccessPath(input.finalizationFile, "fullCaseFile.researchPlan.finalAdjudicationPromptBundle"),
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts",
      message: "Final adjudication must use finalAdjudicationPromptBundle from the ResearchPlan.",
    },
    {
      ok: hasPropertyAccessPath(input.htmlReportStageFile, "input.fullCaseFile.researchPlan.htmlReportPromptBundle"),
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts",
      message: "HTML report stage must use htmlReportPromptBundle from the ResearchPlan.",
    },
  ];
  for (const check of checks) {
    if (check.ok) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/prompt-bundle-runtime-usage",
      lawId: input.lawId,
      filePath: check.filePath,
      message: check.message,
    }));
  }
};

const inspectNoFixedBusinessPromptFragments = (input: {
  promptFiles: readonly SourceFile[];
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  for (const sourceFile of input.promptFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    const values = stringLiteralValues(sourceFile);
    const found = fixedBusinessPromptFragments.filter((fragment) =>
      values.some((value) => value.includes(fragment)),
    );
    if (found.length === 0) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/no-fixed-business-prompts",
      lawId: input.lawId,
      filePath: repoPath,
      message: `Runtime prompt source contains fixed business prompt fragment(s): ${found.join(", ")}.`,
    }));
  }
};

export const inspectPromptBundleSovereignty = (input: {
  sourceFiles: readonly SourceFile[];
  researchPlanSchemaFile: SourceFile | undefined;
  analysisSubQuestionsFile: SourceFile | undefined;
  finalizationFile: SourceFile | undefined;
  htmlReportStageFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of input.sourceFiles) {
    input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }
  inspectPlanSchema(input);
  inspectRuntimeUsage(input);
  inspectNoFixedBusinessPromptFragments({
    promptFiles: input.sourceFiles.filter((sourceFile) =>
      getRepoSourcePath(sourceFile).includes("prompt"),
    ),
    findings: input.findings,
    lawId: input.lawId,
  });
};
