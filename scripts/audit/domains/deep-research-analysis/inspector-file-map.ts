import { type SourceFile } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

export type DeepResearchAuditFiles = {
  promptFile: SourceFile | undefined;
  parserFile: SourceFile | undefined;
  flowFile: SourceFile | undefined;
  analysisRunnerFile: SourceFile | undefined;
  queryFile: SourceFile | undefined;
  contractFile: SourceFile | undefined;
  regressionFile: SourceFile | undefined;
  promptsFile: SourceFile | undefined;
  qualityFile: SourceFile | undefined;
  schemaFile: SourceFile | undefined;
  recordsFile: SourceFile | undefined;
  deckPromptFile: SourceFile | undefined;
  pptArtifactPromptFile: SourceFile | undefined;
  deckSchemaFile: SourceFile | undefined;
  deckParserFile: SourceFile | undefined;
  deckStageFile: SourceFile | undefined;
  exportFile: SourceFile | undefined;
  decompositionAcceptanceFile: SourceFile | undefined;
  smokeFile: SourceFile | undefined;
  businessDeckAcceptanceFile: SourceFile | undefined;
  deckSecretaryBoundaryAcceptanceFile: SourceFile | undefined;
  deckArtifactsAcceptanceFile: SourceFile | undefined;
  aiPptDetectorFile: SourceFile | undefined;
  aiPptDownloadFile: SourceFile | undefined;
  recordContractsFile: SourceFile | undefined;
  clientReportSectionsFile: SourceFile | undefined;
  ciFullFile: SourceFile | undefined;
};

const getSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

export const buildDeepResearchAuditFiles = (context: InspectorContext): DeepResearchAuditFiles => ({
  promptFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-prompt.ts"),
  parserFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-parser.ts"),
  flowFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.flow.ts"),
  analysisRunnerFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.analysis-runner.ts"),
  queryFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.public-queries.ts"),
  contractFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.public-contracts.ts"),
  regressionFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.prompt-regression.ts"),
  promptsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts"),
  qualityFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.prompt-quality.ts"),
  schemaFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.schema.ts"),
  recordsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.records.ts"),
  deckPromptFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.deck-prompt.ts"),
  pptArtifactPromptFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.ppt-artifact-prompt.ts"),
  deckSchemaFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.deck-schema.ts"),
  deckParserFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.deck-parser.ts"),
  deckStageFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.deck-stage.ts"),
  exportFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.export.ts"),
  decompositionAcceptanceFile: getSourceFile(context, "scripts/acceptance/deep-research-decomposition-prompt.acceptance.ts"),
  smokeFile: getSourceFile(context, "scripts/acceptance/deep-research-analysis-smoke.ts"),
  businessDeckAcceptanceFile: getSourceFile(context, "scripts/acceptance/deep-research-business-deck.acceptance.ts"),
  deckSecretaryBoundaryAcceptanceFile: getSourceFile(context, "scripts/acceptance/deep-research-deck-secretary-boundary.acceptance.ts"),
  deckArtifactsAcceptanceFile: getSourceFile(context, "scripts/acceptance/deep-research-deck-artifacts.acceptance.ts"),
  aiPptDetectorFile: getSourceFile(context, "src/capabilities/ai-input-gateway/providers/web-chat-artifact-detector.ts"),
  aiPptDownloadFile: getSourceFile(context, "src/capabilities/ai-input-gateway/providers/web-chat-artifact-download.ts"),
  recordContractsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts"),
  clientReportSectionsFile: getSourceFile(context, "src/app/workbench-deep-research-client-report-sections.ts"),
  ciFullFile: getSourceFile(context, "scripts/audit/ci-full.ts"),
});
