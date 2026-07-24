import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";
import { hasIdentifierName, hasLiteralFragment, hasPropertyAccessSegments } from "./deep-research-ast-facts.js";

const hasIdentifier = (sourceFile: SourceFile | undefined, name: string): boolean =>
  hasIdentifierName(sourceFile, name);

type PromptBundleSovereigntyInput = {
  researchPlanSchemaFile: SourceFile | undefined;
  decompositionPromptFile: SourceFile | undefined;
  analysisSubQuestionsFile: SourceFile | undefined;
  finalizationFile: SourceFile | undefined;
  htmlReportStageFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
};

const inspectPromptBundleSchema = (input: PromptBundleSovereigntyInput): void => {
  const schemaChecks = [
    "promptBundle",
    "finalAdjudicationPromptBundle",
    "htmlReportPromptBundle",
    "everySubQuestionHasPromptBundle",
    "promptBundlesAreQuestionSpecific",
    "noGenericUniversalPromptBundle",
    "finalPromptBundleIsQuestionSpecific",
    "htmlPromptBundleIsQuestionSpecific",
    "runtimeWillOnlyAddShellConstraints",
  ];
  const missingSchemaIdentifiers = schemaChecks.filter((identifier) => !hasIdentifier(input.researchPlanSchemaFile, identifier));
  if (missingSchemaIdentifiers.length > 0) {
    input.findings.push(createFinding({
      checkId: "deep-research/promptbundle-sovereignty-schema",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.schema.ts",
      message: `ResearchPlan schema is missing promptBundle sovereignty marker(s): ${missingSchemaIdentifiers.join(", ")}.`,
    }));
  }
};

const inspectPromptBundlePromptMarkers = (input: PromptBundleSovereigntyInput): void => {
  const requiredPromptMarkers = [
    "Each subQuestion.promptBundle is the only business analysis instruction for that sub-question.",
    "The runtime will not write a replacement prompt later.",
    "The promptBundle may ask for output structures suitable for the question, but the runtime will not add business fields later.",
  ];
  const missingPromptMarkers = requiredPromptMarkers.filter((marker) =>
    !hasLiteralFragment(input.decompositionPromptFile, marker));
  if (missingPromptMarkers.length > 0) {
    input.findings.push(createFinding({
      checkId: "deep-research/promptbundle-sovereignty-prompt",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts",
      message: `Decomposition prompt is missing promptBundle sovereignty marker(s): ${missingPromptMarkers.join(", ")}.`,
    }));
  }
};

const inspectPromptBundleRuntimeChecks = (input: PromptBundleSovereigntyInput): void => {
  const runtimeChecks = [
    {
      ok: hasPropertyAccessSegments(input.analysisSubQuestionsFile, ["subQuestion", "question", "promptBundle"])
        && hasIdentifier(input.analysisSubQuestionsFile, "renderSubQuestionAnalysisFromPromptBundle"),
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts",
      message: "N-stage analysis must render directly from subQuestion.question.promptBundle.",
    },
    {
      ok: hasPropertyAccessSegments(input.finalizationFile, ["fullCaseFile", "researchPlan", "finalAdjudicationPromptBundle"]),
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts",
      message: "Final adjudication stage must consume fullCaseFile.researchPlan.finalAdjudicationPromptBundle.",
    },
    {
      ok: hasPropertyAccessSegments(input.htmlReportStageFile, ["input", "fullCaseFile", "researchPlan", "htmlReportPromptBundle"]),
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts",
      message: "HTML report stage must consume input.fullCaseFile.researchPlan.htmlReportPromptBundle.",
    },
  ] as const;
  for (const check of runtimeChecks) {
    if (check.ok) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/prompt-bundle-sovereignty-runtime",
      lawId: input.lawId,
      filePath: check.filePath,
      message: check.message,
    }));
  }
};

export const inspectPromptBundleSovereignty = (input: PromptBundleSovereigntyInput): void => {
  for (const sourceFile of [
    input.researchPlanSchemaFile,
    input.decompositionPromptFile,
    input.analysisSubQuestionsFile,
    input.finalizationFile,
    input.htmlReportStageFile,
  ]) {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }
  inspectPromptBundleSchema(input);
  inspectPromptBundlePromptMarkers(input);
  inspectPromptBundleRuntimeChecks(input);
};
