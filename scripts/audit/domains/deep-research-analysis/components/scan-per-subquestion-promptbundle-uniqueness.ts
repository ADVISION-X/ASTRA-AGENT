import { Node, SyntaxKind, type CallExpression, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";
import { hasLiteralFragment, hasLiteralValue, hasPropertyAccessSegments } from "./deep-research-ast-facts.js";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const addInspectedFiles = (input: {
  analysisSubQuestionsFile: SourceFile | undefined;
  promptsFile: SourceFile | undefined;
  researchPlanPersistFile: SourceFile | undefined;
  schemaFile: SourceFile | undefined;
  researchPlanSchemaFile: SourceFile | undefined;
  inspectedFiles: Set<string>;
}): void => {
  for (const sourceFile of [
    input.analysisSubQuestionsFile,
    input.promptsFile,
    input.researchPlanPersistFile,
    input.schemaFile,
    input.researchPlanSchemaFile,
  ]) {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }
};

const inspectRuntimePromptBundlePath = (input: {
  analysisSubQuestionsFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  if (hasPropertyAccessSegments(input.analysisSubQuestionsFile, ["subQuestion", "question", "promptBundle"])) {
    return;
  }
  input.findings.push(createFinding({
    checkId: "deep-research/per-subquestion-promptbundle-runtime",
    lawId: input.lawId,
    filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts",
    message: "Sub-question analysis must consume subQuestion.question.promptBundle directly.",
  }));
};

const inspectMissingPromptBundleGuards = (input: {
  promptsFile: SourceFile | undefined;
  researchPlanPersistFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const missingTextChecks = [
    {
      sourceFile: input.promptsFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts",
      marker: "Missing promptBundle for sub-question",
      message: "Prompt rendering must fail if a sub-question promptBundle is missing.",
    },
    {
      sourceFile: input.researchPlanPersistFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.record-interaction-ops.ts",
      marker: "Missing promptBundle for sub-question",
      message: "PromptBundle export must fail if a sub-question promptBundle is missing.",
    },
  ] as const;
  for (const check of missingTextChecks) {
    if (hasLiteralFragment(check.sourceFile, check.marker)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/per-subquestion-promptbundle-guard",
      lawId: input.lawId,
      filePath: check.filePath,
      message: check.message,
    }));
  }
};

const findPromptBundleInitializer = (schemaFile: SourceFile | undefined) =>
  schemaFile?.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .find((candidate) => candidate.getName() === "promptBundle")
    ?.getInitializer();

const isPromptBundleExtendCall = (expression: CallExpression | undefined): boolean => {
  if (!expression) {
    return false;
  }
  const callee = expression.getExpression();
  if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== "extend") {
    return false;
  }
  const target = callee.getExpression();
  return Node.isIdentifier(target) && target.getText() === "DeepResearchPromptBundleSchema";
};

const inspectPromptBundleInitializer = (initializer: ReturnType<typeof findPromptBundleInitializer>): {
  hasOptionalWrapper: boolean;
  promptBundleExtendCall: CallExpression | undefined;
} => {
  if (!Node.isCallExpression(initializer)) {
    return {
      hasOptionalWrapper: false,
      promptBundleExtendCall: undefined,
    };
  }
  if (isPromptBundleExtendCall(initializer)) {
    return {
      hasOptionalWrapper: false,
      promptBundleExtendCall: initializer,
    };
  }
  const callee = initializer.getExpression();
  if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== decode("b3B0aW9uYWw=")) {
    return {
      hasOptionalWrapper: false,
      promptBundleExtendCall: undefined,
    };
  }
  const wrappedExpression = callee.getExpression();
  return {
    hasOptionalWrapper: true,
    promptBundleExtendCall: Node.isCallExpression(wrappedExpression) ? wrappedExpression : undefined,
  };
};

const inspectPersistedPromptBundleRequirement = (input: {
  schemaFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const initializer = findPromptBundleInitializer(input.schemaFile);
  const promptBundleShape = inspectPromptBundleInitializer(initializer);
  if (!isPromptBundleExtendCall(promptBundleShape.promptBundleExtendCall)) {
    input.findings.push(createFinding({
      checkId: "deep-research/per-subquestion-promptbundle-schema",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.schema.ts",
      message: "Persisted sub-question schema must include promptBundle.",
    }));
    return;
  }
  if (!promptBundleShape.hasOptionalWrapper) {
    return;
  }
  input.findings.push(createFinding({
    checkId: "deep-research/per-subquestion-promptbundle-required",
    lawId: input.lawId,
    filePath: "src/plugins/deep-research-analysis/deep-research-analysis.schema.ts",
    message: "Persisted sub-question promptBundle must be required.",
  }));
};

const inspectResearchPlanUniquenessGuards = (input: {
  researchPlanSchemaFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  for (const [marker, checkId, message] of [
    [
      "questionSpecificFocus must not be identical across every sub-question promptBundle.",
      "deep-research/per-subquestion-promptbundle-question-focus-uniqueness",
      "ResearchPlan schema must reject globally identical questionSpecificFocus across sub-question promptBundles.",
    ],
    [
      "evidenceOrReasoningNeeds must not be identical across every sub-question promptBundle.",
      "deep-research/per-subquestion-promptbundle-evidence-uniqueness",
      "ResearchPlan schema must reject globally identical evidenceOrReasoningNeeds across sub-question promptBundles.",
    ],
    [
      "requiredContent must not be identical across every sub-question promptBundle.",
      "deep-research/per-subquestion-promptbundle-required-content-uniqueness",
      "ResearchPlan schema must reject globally identical requiredContent across sub-question promptBundles.",
    ],
  ] as const) {
    if (hasLiteralValue(input.researchPlanSchemaFile, marker)) continue;
    input.findings.push(createFinding({
      checkId,
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.schema.ts",
      message,
    }));
  }
};

export const inspectPerSubQuestionPromptBundleUniqueness = (input: {
  analysisSubQuestionsFile: SourceFile | undefined;
  promptsFile: SourceFile | undefined;
  researchPlanPersistFile: SourceFile | undefined;
  schemaFile: SourceFile | undefined;
  researchPlanSchemaFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  addInspectedFiles(input);
  inspectRuntimePromptBundlePath(input);
  inspectMissingPromptBundleGuards(input);
  inspectPersistedPromptBundleRequirement(input);
  inspectResearchPlanUniquenessGuards(input);
};
