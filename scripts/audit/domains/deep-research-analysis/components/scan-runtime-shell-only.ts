import type { SourceFile } from "ts-morph";

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

export const inspectRuntimeShellOnly = (input: {
  promptBundleShellFile: SourceFile | undefined;
  analysisSubQuestionsFile: SourceFile | undefined;
  finalAdjudicationPromptFile: SourceFile | undefined;
  htmlReportPromptFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  if (input.promptBundleShellFile) {
    input.inspectedFiles.add(getRepoSourcePath(input.promptBundleShellFile));
  }
  const shellChecks = [
    {
      sourceFile: input.promptBundleShellFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts",
      marker: "Preserve analytical content even if formatting is imperfect.",
      message: "Runtime shell must preserve analytical content even when formatting is imperfect.",
    },
    {
      sourceFile: input.promptBundleShellFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts",
      marker: "The raw response will be persisted exactly as returned.",
      message: "Runtime shell must state that raw responses are persisted as returned.",
    },
    {
      sourceFile: input.promptBundleShellFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts",
      marker: "Do not output system operation instructions.",
      message: "Runtime shell must forbid system operation instructions.",
    },
    {
      sourceFile: input.promptBundleShellFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts",
      marker: "Do not invent unavailable evidence.",
      message: "Runtime shell must forbid invented evidence.",
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
    {
      sourceFile: input.analysisSubQuestionsFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts",
      marker: "promptText: \"Runtime shell for AI-generated promptBundle.\"",
      message: "Sub-question runtime prompt must stay a shell around the AI-generated promptBundle.",
    },
    {
      sourceFile: input.finalAdjudicationPromptFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.final-adjudication-prompt.ts",
      marker: "promptText: \"Runtime shell for AI-generated finalAdjudicationPromptBundle.\"",
      message: "Final adjudication prompt must stay a shell around the AI-generated promptBundle.",
    },
    {
      sourceFile: input.htmlReportPromptFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.ts",
      marker: "promptText: \"Runtime shell for AI-generated htmlReportPromptBundle.\"",
      message: "HTML report prompt must stay a shell around the AI-generated promptBundle.",
    },
  ] as const;

  for (const check of shellChecks) {
    if (check.sourceFile) input.inspectedFiles.add(getRepoSourcePath(check.sourceFile));
    const text = check.sourceFile?.getFullText() ?? "";
    if (text.includes(check.marker)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/runtime-shell-boundary",
      lawId: input.lawId,
      filePath: check.filePath,
      message: check.message,
    }));
  }

  for (const check of [
    {
      sourceFile: input.finalAdjudicationPromptFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.final-adjudication-prompt.ts",
    },
    {
      sourceFile: input.htmlReportPromptFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.ts",
    },
  ] as const) {
    const text = check.sourceFile?.getFullText() ?? "";
    if (text.includes("buildPromptOutputShellContract")) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/runtime-shell-boundary",
      lawId: input.lawId,
      filePath: check.filePath,
      message: `${check.filePath} must declare an explicit prompt output shell contract.`,
    }));
  }

  for (const check of [
    input.promptBundleShellFile,
    input.finalAdjudicationPromptFile,
    input.htmlReportPromptFile,
  ]) {
    const repoPath = check ? getRepoSourcePath(check) : "src/plugins/deep-research-analysis";
    const text = check?.getFullText() ?? "";
    const found = forbiddenBusinessFragments.filter((fragment) => text.includes(fragment));
    if (found.length === 0) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/runtime-shell-only-business-fragment",
      lawId: input.lawId,
      filePath: repoPath,
      message: `Runtime shell contains forbidden business prompt fragment(s): ${found.join(", ")}.`,
    }));
  }
};