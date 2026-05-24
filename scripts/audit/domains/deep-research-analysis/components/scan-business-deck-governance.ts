import { type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

type BusinessDeckFiles = {
  analysisRunnerFile: SourceFile | undefined;
  schemaFile: SourceFile | undefined;
  recordsFile: SourceFile | undefined;
  deckPromptFile: SourceFile | undefined;
  pptArtifactPromptFile: SourceFile | undefined;
  deckSchemaFile: SourceFile | undefined;
  deckParserFile: SourceFile | undefined;
  deckStageFile: SourceFile | undefined;
  exportFile: SourceFile | undefined;
  businessDeckAcceptanceFile: SourceFile | undefined;
  deckSecretaryBoundaryAcceptanceFile: SourceFile | undefined;
  deckArtifactsAcceptanceFile: SourceFile | undefined;
  ciFullFile: SourceFile | undefined;
};

type BusinessDeckGovernanceInput = {
  context: InspectorContext;
  files: BusinessDeckFiles;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
};

const markInspected = (
  input: BusinessDeckGovernanceInput,
  files: readonly (SourceFile | undefined)[],
): void => {
  files.forEach((sourceFile) => {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  });
};

const addFinding = (
  input: BusinessDeckGovernanceInput,
  lawId: string,
  checkId: string,
  filePath: string,
  message: string,
): void => {
  input.findings.push(createFinding({ checkId, lawId, filePath, message }));
};

const inspectBusinessDeckFlow = (input: BusinessDeckGovernanceInput): void => {
  const lawId = selectLawId(input.context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-016-V1");
  markInspected(input, [
    input.files.analysisRunnerFile,
    input.files.schemaFile,
    input.files.recordsFile,
    input.files.deckStageFile,
    input.files.businessDeckAcceptanceFile,
  ]);
  const recordsText = input.files.recordsFile?.getFullText() ?? "";
  if (!recordsText.includes('"default_1_n_1_1"')) {
    addFinding(input, lawId, "deep-research/deck-default-flow-mode", "src/plugins/deep-research-analysis/deep-research-analysis.records.ts", "New Deep Research jobs must default to flowMode = default_1_n_1_1.");
  }
  const schemaText = input.files.schemaFile?.getFullText() ?? "";
  for (const stage of ["DECK_PPT_SEND", "DECK_PPT_CAPTURE", "DECK_PPT_ARTIFACT_DETECT", "DECK_PPT_PERSIST"] as const) {
    if (!schemaText.includes(stage)) {
      addFinding(input, lawId, "deep-research/deck-phase-stage", "src/plugins/deep-research-analysis/deep-research-analysis.schema.ts", `Deep Research schema must expose ${stage} for the business deck phase.`);
    }
  }
  if (!schemaText.includes('"deck"')) {
    addFinding(input, lawId, "deep-research/deck-interaction-phase", "src/plugins/deep-research-analysis/deep-research-analysis.schema.ts", "Deep Research interaction phases must include deck.");
  }
  const runnerText = input.files.analysisRunnerFile?.getVariableDeclaration("runAnalysisPhases")?.getInitializer()?.getText() ?? "";
  const finalReportIndex = runnerText.indexOf("runFinalReportPhase");
  const businessDeckIndex = runnerText.indexOf("runBusinessDeckPhase");
  const completeIndex = runnerText.indexOf("completeSuccessfulRun");
  if (!(finalReportIndex >= 0 && businessDeckIndex > finalReportIndex && completeIndex > businessDeckIndex)) {
    addFinding(input, lawId, "deep-research/deck-stage-order", "src/plugins/deep-research-analysis/deep-research-analysis.analysis-runner.ts", "Business deck phase must run after final adjudication and before export completion.");
  }
  if (!(input.files.ciFullFile?.getFullText() ?? "").includes("acceptance:deep-research-business-deck")) {
    addFinding(input, lawId, "deep-research/deck-flow-ci", "scripts/audit/ci-full.ts", "ci:full must execute acceptance:deep-research-business-deck.");
  }
};

const inspectBusinessDeckSecretaryBoundary = (input: BusinessDeckGovernanceInput): void => {
  const lawId = selectLawId(input.context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-021-V1");
  markInspected(input, [input.files.pptArtifactPromptFile, input.files.deckStageFile, input.files.deckSecretaryBoundaryAcceptanceFile]);
  const promptText = input.files.pptArtifactPromptFile?.getFullText() ?? "";
  for (const marker of ["You are not a researcher.", "You are not allowed to change the final judgment.", "You are not allowed to add new facts.", "Create a downloadable PowerPoint file (.pptx)."]) {
    if (!promptText.includes(marker)) {
      addFinding(input, lawId, "deep-research/deck-secretary-prompt", "src/plugins/deep-research-analysis/deep-research-analysis.ppt-artifact-prompt.ts", `Business PPT prompt must include secretary boundary marker: ${marker}.`);
    }
  }
  if (promptText.includes("Expected output contract JSON")) {
    addFinding(input, lawId, "deep-research/deck-secretary-contract-leak", "src/plugins/deep-research-analysis/deep-research-analysis.ppt-artifact-prompt.ts", "Business PPT prompt render must not append the output contract JSON into the live model prompt.");
  }
  const deckStageText = input.files.deckStageFile?.getFullText() ?? "";
  if (!deckStageText.includes("parseAndDownloadBusinessPptArtifact")) {
    addFinding(input, lawId, "deep-research/deck-source-aware-parse", "src/plugins/deep-research-analysis/deep-research-analysis.deck-stage.ts", "Business deck stage must detect and download the AI PPTX artifact.");
  }
  if (!(input.files.ciFullFile?.getFullText() ?? "").includes("acceptance:deep-research-deck-secretary-boundary")) {
    addFinding(input, lawId, "deep-research/deck-secretary-ci", "scripts/audit/ci-full.ts", "ci:full must execute acceptance:deep-research-deck-secretary-boundary.");
  }
};

const inspectBusinessDeckOutlineSchema = (input: BusinessDeckGovernanceInput): void => {
  const lawId = selectLawId(input.context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-022-V1");
  markInspected(input, [input.files.deckSchemaFile, input.files.deckParserFile]);
  const schemaText = input.files.deckSchemaFile?.getFullText() ?? "";
  for (const marker of ["bullets: z.array(z.string().trim().min(1)).min(1).max(6)", "evidenceRefs: z.array(z.string().trim().min(1))", "mustNotDrop: z.array(z.string().trim().min(1)).min(1)", "deckWarnings: z.array(z.string().trim().min(1))", "omittedItems: z.array(z.object({"]) {
    if (!schemaText.includes(marker)) {
      addFinding(input, lawId, "deep-research/deck-outline-schema", "src/plugins/deep-research-analysis/deep-research-analysis.deck-schema.ts", `Business deck schema must preserve marker: ${marker}.`);
    }
  }
  const parserText = input.files.deckParserFile?.getFullText() ?? "";
  for (const marker of ["validateDeepResearchBusinessDeckOutlineAgainstFinalReport", "rankedConclusions", "reverseConditions", "evidenceGaps", "limitations", "references", "noNewFactsAdded"]) {
    if (!parserText.includes(marker)) {
      addFinding(input, lawId, "deep-research/deck-outline-parser", "src/plugins/deep-research-analysis/deep-research-analysis.deck-parser.ts", `Business deck parser must preserve final-report truth marker: ${marker}.`);
    }
  }
};

const inspectBusinessDeckArtifactExport = (input: BusinessDeckGovernanceInput): void => {
  const lawId = selectLawId(input.context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-023-V1");
  markInspected(input, [input.files.exportFile, input.files.deckArtifactsAcceptanceFile]);
  const exportText = input.files.exportFile?.getFullText() ?? "";
  for (const marker of ['"business-deck.ai-pptx"', '"business-deck.local-pptx"', "generateDeepResearchBusinessDeckPptx", 'status: "deck_export_partial"', 'exportKind: "business-deck.local-pptx"']) {
    if (!exportText.includes(marker)) {
      addFinding(input, lawId, "deep-research/deck-artifact-export", "src/plugins/deep-research-analysis/deep-research-analysis.export.ts", `Business deck export pipeline must preserve marker: ${marker}.`);
    }
  }
  const ciText = input.files.ciFullFile?.getFullText() ?? "";
  for (const stepName of ["acceptance:deep-research-deck-artifacts", "acceptance:deep-research-deck-ui"]) {
    if (!ciText.includes(stepName)) {
      addFinding(input, lawId, "deep-research/deck-artifact-ci", "scripts/audit/ci-full.ts", `ci:full must execute ${stepName}.`);
    }
  }
};

const inspectBusinessDeckNoRejudgment = (input: BusinessDeckGovernanceInput): void => {
  const lawId = selectLawId(input.context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-024-V1");
  const deckStageText = input.files.deckStageFile?.getFullText() ?? "";
  const promptText = input.files.pptArtifactPromptFile?.getFullText() ?? "";
  if (!deckStageText.includes("renderDeepResearchBusinessPptArtifactPrompt({")) {
    addFinding(input, lawId, "deep-research/deck-render-call", "src/plugins/deep-research-analysis/deep-research-analysis.deck-stage.ts", "Business deck stage must render the secretary prompt from persisted decision inputs.");
  }
  for (const forbiddenMarker of ["unsupportedResearchExpansion", "contentRejudgment", "slideSemanticValidation"]) {
    if (!promptText.includes(forbiddenMarker)) {
      addFinding(input, lawId, "deep-research/deck-forbidden-control-field", "src/plugins/deep-research-analysis/deep-research-analysis.ppt-artifact-prompt.ts", `Business deck prompt contract must forbid ${forbiddenMarker}.`);
    }
  }
  const parserText = input.files.deckParserFile?.getFullText() ?? "";
  for (const marker of ["finalVerdictPreserved", "confidencePreserved", "directAnswerPreserved"]) {
    if (!parserText.includes(marker)) {
      addFinding(input, lawId, "deep-research/deck-no-rejudgment-guard", "src/plugins/deep-research-analysis/deep-research-analysis.deck-parser.ts", `Business deck parser must guard adjudication preservation field ${marker}.`);
    }
  }
};

export const inspectBusinessDeckGovernance = (input: BusinessDeckGovernanceInput): void => {
  inspectBusinessDeckFlow(input);
  inspectBusinessDeckSecretaryBoundary(input);
  inspectBusinessDeckOutlineSchema(input);
  inspectBusinessDeckArtifactExport(input);
  inspectBusinessDeckNoRejudgment(input);
};
