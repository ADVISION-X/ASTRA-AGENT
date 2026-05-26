import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const forbiddenBusinessFragments = [
  "stock",
  "crypto",
  "war",
  "military",
  "training plan",
  "investment thesis",
  "tax filing",
  "rankedConclusions",
  "finalVerdict",
] as const;

type RuntimeShellOnlyInput = {
  promptBundleShellFile: SourceFile | undefined;
  analysisSubQuestionsFile: SourceFile | undefined;
  finalAdjudicationPromptFile: SourceFile | undefined;
  htmlReportPromptFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
};

type RuntimeShellMarkerCheck = {
  sourceFile: SourceFile | undefined;
  filePath: string;
  marker: string;
  message: string;
};

const collectSourceTokens = (sourceFile: SourceFile | undefined): Set<string> => {
  if (!sourceFile) {
    return new Set<string>();
  }
  const tokens = new Set<string>();
  for (const literal of sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
    tokens.add(literal.getLiteralText());
  }
  for (const literal of sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
    tokens.add(literal.getLiteralText());
  }
  for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    tokens.add(identifier.getText());
  }
  return tokens;
};

const pushMissingRuntimeShellMarkerFinding = (
  input: RuntimeShellOnlyInput,
  check: RuntimeShellMarkerCheck,
): void => {
  const tokens = collectSourceTokens(check.sourceFile);
  if (tokens.has(check.marker)) return;
  input.findings.push(createFinding({
    checkId: "deep-research/runtime-shell-boundary",
    lawId: input.lawId,
    filePath: check.filePath,
    message: check.message,
  }));
};

const inspectPromptBundleShellMarkers = (input: RuntimeShellOnlyInput): void => {
  const checks: readonly RuntimeShellMarkerCheck[] = [
    {
      sourceFile: input.promptBundleShellFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts",
      marker: "SUB_QUESTION_ANSWER_TEXT_BEGIN",
      message: "N-stage runtime shell must require one delimited answer body.",
    },
    {
      sourceFile: input.promptBundleShellFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts",
      marker: "SUB_QUESTION_ANSWER_TEXT_END",
      message: "N-stage runtime shell must close the delimited answer body.",
    },
    {
      sourceFile: input.promptBundleShellFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts",
      marker: "Do not wrap the answer body in a JSON response envelope.",
      message: "N-stage runtime shell must forbid JSON answer envelopes for the answer body.",
    },
    {
      sourceFile: input.promptBundleShellFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts",
      marker: "SUB_QUESTION_INDEX_JSON_BEGIN",
      message: "N-stage runtime shell must keep retrieval-only index JSON separate from the answer body.",
    },
    {
      sourceFile: input.promptBundleShellFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts",
      marker: "SUB_QUESTION_INDEX_JSON_END",
      message: "N-stage runtime shell must close the retrieval-only index JSON block.",
    },
    {
      sourceFile: input.promptBundleShellFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts",
      marker: "Return one complete self-contained HTML document.",
      message: "HTML runtime shell must require one self-contained HTML document.",
    },
    {
      sourceFile: input.promptBundleShellFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts",
      marker: "Use inline CSS only.",
      message: "HTML runtime shell must require inline CSS only.",
    },
    {
      sourceFile: input.promptBundleShellFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts",
      marker: "Do not include scripts.",
      message: "HTML runtime shell must forbid scripts.",
    },
    {
      sourceFile: input.promptBundleShellFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts",
      marker: "Do not depend on external CSS, fonts, images, or network resources.",
      message: "HTML runtime shell must forbid external resources.",
    },
  ];
  for (const check of checks) {
    pushMissingRuntimeShellMarkerFinding(input, check);
  }
};

const inspectRuntimePromptShellMarkers = (input: RuntimeShellOnlyInput): void => {
  const checks: readonly RuntimeShellMarkerCheck[] = [
    {
      sourceFile: input.analysisSubQuestionsFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts",
      marker: "Runtime shell for AI-generated promptBundle.",
      message: "Sub-question runtime prompt must stay a shell around the AI-generated promptBundle.",
    },
    {
      sourceFile: input.finalAdjudicationPromptFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts",
      marker: "Runtime shell for AI-generated finalAdjudicationPromptBundle.",
      message: "Final adjudication prompt must stay a shell around the AI-generated promptBundle.",
    },
    {
      sourceFile: input.htmlReportPromptFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts",
      marker: "Runtime shell for AI-generated htmlReportPromptBundle.",
      message: "HTML report prompt must stay a shell around the AI-generated promptBundle.",
    },
  ];
  for (const check of checks) {
    pushMissingRuntimeShellMarkerFinding(input, check);
  }
};

const recordRuntimeShellInspectedFiles = (input: RuntimeShellOnlyInput): void => {
  for (const sourceFile of [
    input.promptBundleShellFile,
    input.analysisSubQuestionsFile,
    input.finalAdjudicationPromptFile,
    input.htmlReportPromptFile,
  ]) {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }
};

const inspectRuntimeShellMarkers = (input: RuntimeShellOnlyInput): void => {
  inspectPromptBundleShellMarkers(input);
  inspectRuntimePromptShellMarkers(input);
};

const inspectRuntimeShellContracts = (input: RuntimeShellOnlyInput): void => {
  for (const check of [
    {
      sourceFile: input.analysisSubQuestionsFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts",
    },
    {
      sourceFile: input.finalAdjudicationPromptFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts",
    },
    {
      sourceFile: input.htmlReportPromptFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts",
    },
  ] as const) {
    const tokens = collectSourceTokens(check.sourceFile);
    if (tokens.has("buildPromptOutputShellContract") || tokens.has("expectedOutputContract")) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/runtime-shell-boundary",
      lawId: input.lawId,
      filePath: check.filePath,
      message: `${check.filePath} must declare an explicit prompt output shell contract.`,
    }));
  }
};

const inspectRuntimeShellBusinessFragments = (input: RuntimeShellOnlyInput): void => {
  for (const check of [
    input.promptBundleShellFile,
    input.finalAdjudicationPromptFile,
    input.htmlReportPromptFile,
  ]) {
    const repoPath = check ? getRepoSourcePath(check) : "src/plugins/deep-research-analysis";
    const tokens = collectSourceTokens(check);
    const found = forbiddenBusinessFragments.filter((fragment) => tokens.has(fragment));
    if (found.length === 0) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/runtime-shell-only-business-fragment",
      lawId: input.lawId,
      filePath: repoPath,
      message: `Runtime shell contains forbidden business prompt fragment(s): ${found.join(", ")}.`,
    }));
  }
};

export const inspectRuntimeShellOnly = (input: RuntimeShellOnlyInput): void => {
  recordRuntimeShellInspectedFiles(input);
  inspectRuntimeShellMarkers(input);
  inspectRuntimeShellContracts(input);
  inspectRuntimeShellBusinessFragments(input);
};