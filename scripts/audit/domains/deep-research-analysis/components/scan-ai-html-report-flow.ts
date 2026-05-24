import { selectLawId, createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";
import type { SourceFile } from "ts-morph";

const markInspected = (
  inspectedFiles: Set<string>,
  sourceFiles: readonly (SourceFile | undefined)[],
): void => {
  sourceFiles.forEach((sourceFile) => {
    if (sourceFile) {
      inspectedFiles.add(getRepoSourcePath(sourceFile));
    }
  });
};

const inspectRunnerOrder = (input: {
  analysisRunnerFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const runnerText = input.analysisRunnerFile?.getVariableDeclaration("runAnalysisPhases")
    ?.getInitializer()?.getText() ?? "";
  const finalReportIndex = runnerText.indexOf("runFinalReportPhase");
  const htmlReportIndex = runnerText.indexOf("runBusinessHtmlReportPhase");
  const completeIndex = runnerText.indexOf("completeSuccessfulRun");
  if (!(finalReportIndex >= 0 && htmlReportIndex > finalReportIndex && completeIndex > htmlReportIndex)) {
    input.findings.push(createFinding({
      checkId: "deep-research/ai-html-report-stage-order",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-runner.ts",
      message: "Business HTML report phase must run after final adjudication and before completion.",
    }));
  }
  if (runnerText.includes("runBusinessDeckPhase")) {
    input.findings.push(createFinding({
      checkId: "deep-research/ai-html-report-no-deck-primary",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-runner.ts",
      message: "Primary Deep Research completion must not keep runBusinessDeckPhase in the active main path.",
    }));
  }
};

const inspectStringMarkers = (input: {
  file: SourceFile | undefined;
  markers: readonly string[];
  findings: InspectorFinding[];
  lawId: string;
  checkId: string;
  filePath: string;
  messagePrefix: string;
}): void => {
  const fileText = input.file?.getFullText() ?? "";
  for (const marker of input.markers) {
    if (fileText.includes(marker)) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: input.checkId,
      lawId: input.lawId,
      filePath: input.filePath,
      message: `${input.messagePrefix} ${marker}.`,
    }));
  }
};

const inspectCiBinding = (input: {
  ciFullFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  if ((input.ciFullFile?.getFullText() ?? "").includes("acceptance:deep-research-ai-html-report")) {
    return;
  }
  input.findings.push(createFinding({
    checkId: "deep-research/ai-html-report-ci",
    lawId: input.lawId,
    filePath: "scripts/audit/ci-full.ts",
    message: "ci:full must execute acceptance:deep-research-ai-html-report.",
  }));
};

export const inspectAiHtmlReportFlow = (input: {
  context: InspectorContext;
  analysisRunnerFile: SourceFile | undefined;
  htmlReportStageFile: SourceFile | undefined;
  schemaFile: SourceFile | undefined;
  acceptanceFile: SourceFile | undefined;
  ciFullFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
}): void => {
  const lawId = selectLawId(input.context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-029-V1");
  markInspected(input.inspectedFiles, [
    input.analysisRunnerFile,
    input.htmlReportStageFile,
    input.schemaFile,
    input.acceptanceFile,
    input.ciFullFile,
  ]);

  inspectRunnerOrder({
    analysisRunnerFile: input.analysisRunnerFile,
    findings: input.findings,
    lawId,
  });
  inspectStringMarkers({
    file: input.htmlReportStageFile,
    markers: [
    "businessHtmlReportPublisherPrompt",
    "renderDeepResearchBusinessHtmlReportPrompt",
    "parseAndPersistBusinessHtmlReport",
    'promptKey: "business-html-report"',
    'send: "HTML_REPORT_SEND"',
    'capture: "HTML_REPORT_CAPTURE"',
    'parse: "HTML_REPORT_DETECT"',
    'persist: "HTML_REPORT_PERSIST"',
    ],
    findings: input.findings,
    lawId,
    checkId: "deep-research/ai-html-report-stage-marker",
    filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts",
    messagePrefix: "Business HTML report stage must include",
  });
  inspectStringMarkers({
    file: input.schemaFile,
    markers: [
    "HTML_REPORT_SEND",
    "HTML_REPORT_CAPTURE",
    "HTML_REPORT_DETECT",
    "HTML_REPORT_PERSIST",
    '"html_report"',
    ],
    findings: input.findings,
    lawId,
    checkId: "deep-research/ai-html-report-schema-marker",
    filePath: "src/plugins/deep-research-analysis/deep-research-analysis.schema.ts",
    messagePrefix: "Deep Research schema must expose",
  });
  inspectCiBinding({
    ciFullFile: input.ciFullFile,
    findings: input.findings,
    lawId,
  });
};