import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { inspectDeletedNonPrimaryPaths } from "./components/scan-deleted-non-primary-paths.js";
import { inspectAnalysisOutputCleanliness } from "./components/scan-analysis-output-cleanliness.js";
import { inspectFinalAdjudicationPromptBundleInput } from "./components/scan-final-adjudication-promptbundle-input.js";
import { inspectFinalAdjudicationRawSovereignty } from "./components/scan-final-adjudication-raw-sovereignty.js";
import { inspectFormatShellBoundary } from "./components/scan-format-shell-boundary.js";
import { inspectFullCaseFileSovereignty } from "./components/scan-full-case-file-sovereignty.js";
import {
  inspectHtmlArtifactCaptureChain,
  inspectHtmlReportPromptBundleInput,
  inspectHtmlUsesRawFinalAnswer,
} from "./components/html-owner-inspectors.js";
import { inspectNoSystemGeneratedConfidence } from "./components/scan-no-system-generated-confidence.js";
import { inspectPerSubQuestionPromptBundleUniqueness } from "./components/scan-per-subquestion-promptbundle-uniqueness.js";
import { inspectPromptBundleBusinessSovereignty } from "./components/scan-promptbundle-business-sovereignty.js";
import { inspectPromptBundleFieldConsistency } from "./components/scan-promptbundle-field-consistency.js";
import { inspectPromptBundleSovereignty } from "./components/scan-prompt-bundle-sovereignty.js";
import { inspectRawInteractionPersistence } from "./components/scan-raw-interaction-persistence.js";
import { inspectRuntimeShellOnly } from "./components/scan-runtime-shell-only.js";
import { inspectSinglePathVocabulary } from "./components/scan-single-path-vocabulary.js";
import { inspectSingleChainSovereignty } from "./components/scan-single-chain-sovereignty.js";
import { inspectSourceParseDiagnostics } from "./components/scan-source-parse-diagnostics.js";

const requiredFiles = [
  "src/plugins/deep-research-analysis/deep-research-analysis.analysis-runner.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.structured-index.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file-render.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file-export.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.final-adjudication-prompt.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.export.ts",
] as const;

const requiredAuditComponentFiles = [
  "scripts/audit/domains/deep-research-analysis/components/scan-source-parse-diagnostics.ts",
  "scripts/audit/domains/deep-research-analysis/components/scan-analysis-output-cleanliness.ts",
  "scripts/audit/domains/deep-research-analysis/components/scan-html-artifact-capture-chain.ts",
] as const;

const getSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolve(resolveFromRepo(repoPath)));

type DeepResearchInspectionState = {
  context: InspectorContext;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  sourceFiles: SourceFile[];
  surfaceFiles: SourceFile[];
  acceptanceFiles: SourceFile[];
  auditComponentFiles: SourceFile[];
};

const inspectRequiredFiles = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const repoPath of requiredFiles) {
    inspectedFiles.add(repoPath);
    if (existsSync(resolveFromRepo(repoPath))) continue;
    findings.push(createFinding({
      checkId: "deep-research/required-file",
      lawId,
      filePath: repoPath,
      message: `${repoPath} is required for the single Deep Research main flow.`,
    }));
  }
};

const inspectRequiredAuditComponentFiles = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const repoPath of requiredAuditComponentFiles) {
    inspectedFiles.add(repoPath);
    if (existsSync(resolveFromRepo(repoPath))) continue;
    findings.push(createFinding({
      checkId: "deep-research/required-audit-component",
      lawId,
      filePath: repoPath,
      message: `${repoPath} is required to enforce Deep Research AST parse diagnostics.`,
    }));
  }
};

const createInspectionState = (context: InspectorContext): DeepResearchInspectionState => ({
  context,
  findings: [],
  inspectedFiles: new Set<string>(),
  sourceFiles: context.project.getSourceFiles("src/plugins/deep-research-analysis/**/*.ts"),
  surfaceFiles: [
    ...context.project.getSourceFiles("src/app/workbench-deep-research*.ts"),
    ...context.project.getSourceFiles("src/lib/local-runtime/workbench*.ts"),
  ],
  acceptanceFiles: context.project.getSourceFiles("scripts/acceptance/deep-research-*.ts"),
  auditComponentFiles: context.project.getSourceFiles("scripts/audit/domains/deep-research-analysis/components/*.ts"),
});

const inspectFlowStructure = (state: DeepResearchInspectionState): void => {
  const { context, findings, inspectedFiles, sourceFiles, surfaceFiles, acceptanceFiles, auditComponentFiles } = state;
  const lawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-001-V1");
  [...sourceFiles, ...surfaceFiles].forEach((sourceFile) => inspectedFiles.add(getRepoSourcePath(sourceFile)));
  inspectRequiredFiles(findings, inspectedFiles, lawId);
  inspectRequiredAuditComponentFiles(findings, inspectedFiles, lawId);
  const parseDiagnosticScan = inspectSourceParseDiagnostics({
    sourceFiles: [...sourceFiles, ...surfaceFiles],
    findings,
    inspectedFiles,
    lawId,
  });
  process.stdout.write(
    `[AUDIT][deep-research-analysis][ast-parse] files=${parseDiagnosticScan.scannedFileCount} diagnostics=${parseDiagnosticScan.diagnosticCount}\n`,
  );
  inspectSingleChainSovereignty({
    analysisRunnerFile: getSourceFile(context, requiredFiles[0]),
    sourceFiles,
    routesFile: getSourceFile(context, "src/app/workbench-deep-research-routes.ts"),
    workbenchHandleFile: getSourceFile(context, "src/lib/local-runtime/workbench-handle.ts"),
    publicFacadeFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.public.ts"),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-038-V1"),
  });
  inspectDeletedNonPrimaryPaths({
    sourceFiles: [...sourceFiles, ...surfaceFiles],
    acceptanceFiles,
    auditComponentFiles,
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-047-V1"),
  });
  inspectFinalAdjudicationRawSovereignty({
    resultFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.result.ts"),
    parserFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.parser.ts"),
    finalizationFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts"),
    recordContractsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts"),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-050-V1"),
  });
  inspectNoSystemGeneratedConfidence({
    sourceFiles,
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-050-V1"),
  });
  inspectFullCaseFileSovereignty({
    finalAdjudicationPromptFile: getSourceFile(context, requiredFiles[5]),
    htmlReportPromptFile: getSourceFile(context, requiredFiles[6]),
    fullCaseFileFile: getSourceFile(context, requiredFiles[2]),
    exportFile: getSourceFile(context, requiredFiles[7]),
    recordContractsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts"),
    recordInteractionOpsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.record-interaction-ops.ts"),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-040-V1"),
  });
  inspectRawInteractionPersistence({
    fullCaseFileSchemaFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file-schema.ts"),
    fullCaseFileFile: getSourceFile(context, requiredFiles[2]),
    fullCaseFileRenderFile: getSourceFile(context, requiredFiles[3]),
    recordContractsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts"),
    recordInteractionOpsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.record-interaction-ops.ts"),
    promptExchangeStageSupportFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.prompt-exchange-stage-support.ts"),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-046-V1"),
  });
};

const inspectBoundaryInputs = (state: DeepResearchInspectionState): void => {
  const { context, findings, inspectedFiles, sourceFiles, surfaceFiles, acceptanceFiles, auditComponentFiles } = state;
  inspectFinalAdjudicationPromptBundleInput({
    finalizationFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts"),
    finalAdjudicationPromptFile: getSourceFile(context, requiredFiles[5]),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-046-V1"),
  });
  inspectHtmlReportPromptBundleInput({
    htmlReportStageFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts"),
    htmlReportPromptFile: getSourceFile(context, requiredFiles[6]),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-046-V1"),
  });
  inspectFormatShellBoundary({
    promptBundleShellFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts"),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-049-V1"),
  });
  inspectHtmlUsesRawFinalAnswer({
    htmlReportPromptFile: getSourceFile(context, requiredFiles[6]),
    htmlReportStageFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts"),
    promptBundleRenderFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-render.ts"),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-050-V1"),
  });
  inspectHtmlArtifactCaptureChain({
    captureFile: getSourceFile(context, "src/capabilities/ai-input-gateway/providers/web-chat-html-artifact-capture.ts"),
    exportFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.html-report-export.ts"),
    sharedFile: getSourceFile(context, "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts"),
    proofFile: getSourceFile(context, "src/capabilities/ai-input-gateway/runtime/ai-feed-proof.ts"),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-041-V1"),
  });
  const cleanOutputScan = inspectAnalysisOutputCleanliness({
    promptBundleShellFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts"),
    analysisSubQuestionsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts"),
    parserFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.parser.ts"),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-044-V1"),
  });
  process.stdout.write(
    `[AUDIT][deep-research-analysis][analysis-clean-output] format=${cleanOutputScan.analysisContractFormat ?? "missing"} findings=${cleanOutputScan.findingCount}\n`,
  );
  inspectSinglePathVocabulary({
    sourceFiles: [...sourceFiles, ...surfaceFiles, ...acceptanceFiles, ...auditComponentFiles],
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-042-V1"),
  });
};

const inspectPromptBundlePolicies = (state: DeepResearchInspectionState): void => {
  const { context, findings, inspectedFiles } = state;
  inspectPromptBundleSovereignty({
    researchPlanSchemaFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.research-plan-schema.ts"),
    decompositionPromptFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-prompt.ts"),
    analysisSubQuestionsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts"),
    finalizationFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts"),
    htmlReportStageFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts"),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-045-V1"),
  });
  inspectPromptBundleFieldConsistency({
    sourceFiles: [
      getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-schema.ts"),
      getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.research-plan-schema.ts"),
      getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-prompt.ts"),
      getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-parser.ts"),
    ].filter((sourceFile): sourceFile is SourceFile => !!sourceFile),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-051-V1"),
  });
  inspectPromptBundleBusinessSovereignty({
    promptBundleRenderFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-render.ts"),
    analysisSubQuestionsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts"),
    finalizationFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts"),
    htmlReportStageFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts"),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-048-V1"),
  });
};

const inspectRuntimeShellPolicies = (state: DeepResearchInspectionState): void => {
  const { context, findings, inspectedFiles } = state;
  inspectPerSubQuestionPromptBundleUniqueness({
    analysisSubQuestionsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts"),
    promptsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts"),
    researchPlanPersistFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.research-plan-persist.ts"),
    schemaFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.schema.ts"),
    researchPlanSchemaFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.research-plan-schema.ts"),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-043-V1"),
  });
  inspectRuntimeShellOnly({
    promptBundleShellFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts"),
    analysisSubQuestionsFile: getSourceFile(context, "src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts"),
    finalAdjudicationPromptFile: getSourceFile(context, requiredFiles[5]),
    htmlReportPromptFile: getSourceFile(context, requiredFiles[6]),
    findings,
    inspectedFiles,
    lawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-044-V1"),
  });
};

const inspectPromptAndInputBoundaries = (state: DeepResearchInspectionState): void => {
  inspectBoundaryInputs(state);
  inspectPromptBundlePolicies(state);
  inspectRuntimeShellPolicies(state);
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const state = createInspectionState(context);
  inspectFlowStructure(state);
  inspectPromptAndInputBoundaries(state);
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings: state.findings,
    inspectedFiles: [...state.inspectedFiles].sort(),
  };
};
