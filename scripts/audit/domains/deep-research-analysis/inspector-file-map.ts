import { type SourceFile } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

export type DeepResearchAuditFiles = {
  promptFile: SourceFile | undefined;
  parserFile: SourceFile | undefined;
  parserSupportFile: SourceFile | undefined;
  flowFile: SourceFile | undefined;
  analysisRunnerFile: SourceFile | undefined;
  queryFile: SourceFile | undefined;
  contractFile: SourceFile | undefined;
  regressionFile: SourceFile | undefined;
  promptsFile: SourceFile | undefined;
  finalAdjudicationPromptFile: SourceFile | undefined;
  resultFile: SourceFile | undefined;
  finalPackageFile: SourceFile | undefined;
  fullCaseFileSchemaFile: SourceFile | undefined;
  fullCaseFileFile: SourceFile | undefined;
  fullCaseFileRenderFile: SourceFile | undefined;
  fullCaseFileExportFile: SourceFile | undefined;
  qualityFile: SourceFile | undefined;
  schemaFile: SourceFile | undefined;
  recordsFile: SourceFile | undefined;
  recordInteractionOpsFile: SourceFile | undefined;
  htmlReportPromptFile: SourceFile | undefined;
  htmlReportStageFile: SourceFile | undefined;
  htmlReportRecordsFile: SourceFile | undefined;
  exportFile: SourceFile | undefined;
  analysisFinalizationFile: SourceFile | undefined;
  promptExchangeStageSupportFile: SourceFile | undefined;
  workbenchRoutesFile: SourceFile | undefined;
  reportViewFile: SourceFile | undefined;
  decompositionAcceptanceFile: SourceFile | undefined;
  smokeFile: SourceFile | undefined;
  htmlReportAcceptanceFile: SourceFile | undefined;
  htmlPromptBoundaryAcceptanceFile: SourceFile | undefined;
  htmlArtifactPersistAcceptanceFile: SourceFile | undefined;
  fullCaseFileAcceptanceFile: SourceFile | undefined;
  rawResponseSovereigntyAcceptanceFile: SourceFile | undefined;
  finalAdjudicationFullInputAcceptanceFile: SourceFile | undefined;
  htmlFullInputAcceptanceFile: SourceFile | undefined;
  aiHtmlDetectorFile: SourceFile | undefined;
  aiHtmlDownloadFile: SourceFile | undefined;
  recordContractsFile: SourceFile | undefined;
  clientReportSectionsFile: SourceFile | undefined;
  clientDeliverySectionsFile: SourceFile | undefined;
  ciFullFile: SourceFile | undefined;
};

const getSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

export const buildDeepResearchAuditFiles = (context: InspectorContext): DeepResearchAuditFiles => ({
  promptFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-prompt.ts"),
  parserFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-parser.ts"),
  parserSupportFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.parser-support.ts"),
  flowFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.flow.ts"),
  analysisRunnerFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.analysis-runner.ts"),
  queryFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.public-queries.ts"),
  contractFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.public-contracts.ts"),
  regressionFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.prompt-regression.ts"),
  promptsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts"),
  finalAdjudicationPromptFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.final-adjudication-prompt.ts"),
  resultFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.result.ts"),
  finalPackageFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.final-package.ts"),
  fullCaseFileSchemaFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file-schema.ts"),
  fullCaseFileFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.ts"),
  fullCaseFileRenderFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file-render.ts"),
  fullCaseFileExportFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file-export.ts"),
  qualityFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.prompt-quality.ts"),
  schemaFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.schema.ts"),
  recordsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.records.ts"),
  recordInteractionOpsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.record-interaction-ops.ts"),
  htmlReportPromptFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.ts"),
  htmlReportStageFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts"),
  htmlReportRecordsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.html-report-records.ts"),
  exportFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.export.ts"),
  analysisFinalizationFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts"),
  promptExchangeStageSupportFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.prompt-exchange-stage-support.ts"),
  workbenchRoutesFile: getSourceFile(context, "src/app/workbench-deep-research-routes.ts"),
  reportViewFile: getSourceFile(context, "src/app/workbench-deep-research-report-view.ts"),
  decompositionAcceptanceFile: getSourceFile(context, "scripts/acceptance/deep-research-decomposition-prompt.acceptance.ts"),
  smokeFile: getSourceFile(context, "scripts/acceptance/deep-research-analysis-smoke.ts"),
  htmlReportAcceptanceFile: getSourceFile(context, "scripts/acceptance/deep-research-ai-html-report.acceptance.ts"),
  htmlPromptBoundaryAcceptanceFile: getSourceFile(context, "scripts/acceptance/deep-research-html-prompt-boundary.acceptance.ts"),
  htmlArtifactPersistAcceptanceFile: getSourceFile(context, "scripts/acceptance/deep-research-html-artifact-persist.acceptance.ts"),
  fullCaseFileAcceptanceFile: getSourceFile(context, "scripts/acceptance/deep-research-full-case-file.acceptance.ts"),
  rawResponseSovereigntyAcceptanceFile: getSourceFile(context, "scripts/acceptance/deep-research-raw-response-sovereignty.acceptance.ts"),
  finalAdjudicationFullInputAcceptanceFile: getSourceFile(context, "scripts/acceptance/deep-research-final-adjudication-full-input.acceptance.ts"),
  htmlFullInputAcceptanceFile: getSourceFile(context, "scripts/acceptance/deep-research-html-full-input.acceptance.ts"),
  aiHtmlDetectorFile: getSourceFile(context, "src/capabilities/ai-input-gateway/providers/web-chat-html-artifact-detector.ts"),
  aiHtmlDownloadFile: getSourceFile(context, "src/capabilities/ai-input-gateway/providers/web-chat-html-artifact-download.ts"),
  recordContractsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts"),
  clientReportSectionsFile: getSourceFile(context, "src/app/workbench-deep-research-client-report-sections.ts"),
  clientDeliverySectionsFile: getSourceFile(context, "src/app/workbench-deep-research-client-delivery-sections.ts"),
  ciFullFile: getSourceFile(context, "scripts/audit/ci-full.ts"),
});
