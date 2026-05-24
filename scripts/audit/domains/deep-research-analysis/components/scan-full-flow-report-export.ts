import { existsSync, readFileSync } from "node:fs";

import {
  Node,
  SyntaxKind,
  type ArrayLiteralExpression,
  type CallExpression,
  type ObjectLiteralExpression,
  type SourceFile,
  type VariableDeclaration,
} from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type {
  InspectorContext,
  InspectorFinding,
} from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";
import { inspectBusinessDeckNoTextCeiling } from "./scan-business-deck-no-text-ceiling.js";

const recordContractsPath = "src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts";
const recordInteractionOpsPath = "src/plugins/deep-research-analysis/deep-research-analysis.record-interaction-ops.ts";
const exportOwnerPath = "src/plugins/deep-research-analysis/deep-research-analysis.export.ts";
const exportMarkdownPath = "src/plugins/deep-research-analysis/deep-research-analysis.export-markdown.ts";
const acceptancePath = "scripts/acceptance/deep-research-report-export.acceptance.ts";
const ciFullPath = "scripts/audit/ci-full.ts";
const packageJsonPath = "package.json";

const getSourceFile = (
  context: InspectorContext,
  repoPath: string,
): SourceFile | undefined => context.project.getSourceFile(resolveFromRepo(repoPath));

const getArrowInitializer = (sourceFile: SourceFile, variableName: string) => {
  const declaration = sourceFile.getVariableDeclaration(variableName);
  const initializer = declaration?.getInitializer();
  return initializer && Node.isArrowFunction(initializer) ? initializer : null;
};

const getFirstObjectLiteral = (
  declaration: VariableDeclaration | undefined,
): ObjectLiteralExpression | null =>
  declaration?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression) ?? null;

const getEnumValues = (
  sourceFile: SourceFile,
  variableName: string,
): string[] => {
  const declaration = sourceFile.getVariableDeclaration(variableName);
  const arrayLiteral = declaration
    ?.getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression)[0] as ArrayLiteralExpression | undefined;
  if (!arrayLiteral) {
    return [];
  }
  return arrayLiteral.getElements().flatMap((element) =>
    Node.isStringLiteral(element) ? [element.getLiteralValue()] : [],
  );
};

const hasStringLiteral = (sourceFile: SourceFile, expected: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .some((literal) => literal.getLiteralValue() === expected);

const getObjectLiteralArgument = (
  callExpression: CallExpression | undefined,
): ObjectLiteralExpression | null => {
  const firstArgument = callExpression?.getArguments()[0];
  return firstArgument && Node.isObjectLiteralExpression(firstArgument)
    ? firstArgument
    : null;
};

const inspectRenderedPromptSchema = (input: {
  context: InspectorContext;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  const sourceFile = getSourceFile(input.context, recordContractsPath);
  input.inspectedFiles.add(recordContractsPath);
  if (!sourceFile) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-record-contracts-file",
      lawId: input.lawId,
      filePath: recordContractsPath,
      message: "Deep Research record contracts file must exist for full-flow report export.",
    }));
    return;
  }
  const schemaObject = getFirstObjectLiteral(sourceFile.getVariableDeclaration("ResearchInteractionSchema"));
  const hasRenderedPromptProperty = schemaObject
    ?.getProperties()
    .some((property) => Node.isPropertyAssignment(property) && property.getName() === "renderedPromptText");
  if (!hasRenderedPromptProperty) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-rendered-prompt-schema",
      lawId: input.lawId,
      filePath: recordContractsPath,
      message: "ResearchInteractionSchema must persist renderedPromptText.",
    }));
  }

  const exportKinds = getEnumValues(sourceFile, "ResearchExportKindSchema");
  const markdownKinds = exportKinds.filter((value) => value.endsWith(".md"));
  if (markdownKinds.length !== 1 || markdownKinds[0] !== "final-report.md") {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-single-human-report-kind",
      lawId: input.lawId,
      filePath: recordContractsPath,
      message: "ResearchExportKindSchema must expose exactly one human-readable report kind: final-report.md.",
    }));
  }
  const requiredMachineArtifacts = [
    "decision-package.json",
    "business-deck-outline.json",
    "business-deck.pptx",
    "evidence-index.json",
  ] as const;
  const missingMachineArtifact = requiredMachineArtifacts.find((artifact) => !exportKinds.includes(artifact));
  if (missingMachineArtifact) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-machine-artifacts",
      lawId: input.lawId,
      filePath: recordContractsPath,
      message: `ResearchExportKindSchema must expose ${missingMachineArtifact}.`,
    }));
  }
};

const inspectRenderedPromptPersistence = (input: {
  context: InspectorContext;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  const sourceFile = getSourceFile(input.context, recordInteractionOpsPath);
  input.inspectedFiles.add(recordInteractionOpsPath);
  if (!sourceFile) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-record-ops-file",
      lawId: input.lawId,
      filePath: recordInteractionOpsPath,
      message: "Deep Research interaction record ops file must exist for full-flow report export.",
    }));
    return;
  }
  const createInteraction = getArrowInitializer(sourceFile, "createInteraction");
  const hasRenderedPromptSql = hasStringLiteral(sourceFile, "rendered_prompt_text");
  const usesInputRenderedPrompt = createInteraction?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((expression) => expression.getText() === "input.renderedPromptText") ?? false;
  if (!hasRenderedPromptSql || !usesInputRenderedPrompt) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-record-ops-persist",
      lawId: input.lawId,
      filePath: recordInteractionOpsPath,
      message: "createInteraction must persist renderedPromptText into research_interactions.",
    }));
  }
};

const inspectExportOwner = (input: {
  context: InspectorContext;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  const sourceFile = getSourceFile(input.context, exportOwnerPath);
  input.inspectedFiles.add(exportOwnerPath);
  if (!sourceFile) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-owner-file",
      lawId: input.lawId,
      filePath: exportOwnerPath,
      message: "Deep Research export owner file must exist.",
    }));
    return;
  }

  const loadPersistedState = getArrowInitializer(sourceFile, "loadPersistedExportState");
  const requiredStoreCalls = [
    "store.getJob",
    "store.listInteractions",
    "store.listSubQuestions",
    "store.listAnswers",
    "store.getLatestFinalReport",
  ] as const;
  const hasPersistedStateCalls = requiredStoreCalls.every((callText) =>
    loadPersistedState?.getDescendantsOfKind(SyntaxKind.CallExpression)
      .some((call) => call.getExpression().getText() === callText),
  );
  if (!hasPersistedStateCalls) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-load-persisted-state",
      lawId: input.lawId,
      filePath: exportOwnerPath,
      message: "loadPersistedExportState must load job, interactions, subQuestions, answers, and finalReportRecord from persisted records.",
    }));
  }

  const exportOwner = getArrowInitializer(sourceFile, "exportDeepResearchArtifacts");
  const reportBuilderCall = exportOwner?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => call.getExpression().getText() === "buildDeepResearchFullFlowReportMarkdown");
  const reportBuilderArgument = getObjectLiteralArgument(reportBuilderCall);
  const requiredBuilderFields = ["finalPackage", "finalReport", "persisted"] as const;
  const hasBuilderFields = requiredBuilderFields.every((field) =>
    reportBuilderArgument?.getProperties().some((property) =>
      Node.isPropertyAssignment(property) && property.getName() === field,
    ),
  );
  if (!hasBuilderFields) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-builder-input",
      lawId: input.lawId,
      filePath: exportOwnerPath,
      message: "exportDeepResearchArtifacts must build final-report.md from finalPackage, finalReport, and persisted export state.",
    }));
  }
};

const inspectMarkdownPersistedState = (input: {
  sourceFile: SourceFile;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const persistedStateType = input.sourceFile.getTypeAlias("DeepResearchPersistedExportState");
  const persistedStateFields = ["job", "finalReportRecord", "interactions", "subQuestions", "answers"] as const;
  const hasPersistedStateFields = persistedStateFields.every((field) =>
    persistedStateType?.getDescendantsOfKind(SyntaxKind.PropertySignature)
      .some((property) => property.getName() === field),
  );
  if (!hasPersistedStateFields) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-markdown-persisted-state",
      lawId: input.lawId,
      filePath: exportMarkdownPath,
      message: "Full-flow report renderer must receive persisted job, interactions, subQuestions, answers, and finalReportRecord.",
    }));
  }
};

const inspectMarkdownSections = (input: {
  sourceFile: SourceFile;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const requiredLiterals = [
    "# Deep Research Full Flow Report",
    "## Stage Overview",
    "## Stage 1: Decomposition",
    "## Analysis Coverage",
    "### Prompt",
    "### AI Raw Response",
    "### Independent Analysis",
    "Final Adjudication",
    "## Evidence Index",
  ] as const;
  const missingLiteral = requiredLiterals.find((literal) => !hasStringLiteral(input.sourceFile, literal));
  if (missingLiteral) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-markdown-sections",
      lawId: input.lawId,
      filePath: exportMarkdownPath,
      message: `Full-flow report renderer is missing required section literal ${missingLiteral}.`,
    }));
  }
  if (hasStringLiteral(input.sourceFile, "# Deep Research Final Report")) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-no-summary-only-heading",
      lawId: input.lawId,
      filePath: exportMarkdownPath,
      message: "Full-flow report renderer must not keep the old summary-only heading.",
    }));
  }
};

const inspectMarkdownBuilderCalls = (input: {
  sourceFile: SourceFile;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const renderer = getArrowInitializer(input.sourceFile, "buildDeepResearchFullFlowReportMarkdown");
  const fullFlowSectionBuilder = getArrowInitializer(input.sourceFile, "buildFullFlowReportSections");
  const subQuestionSectionBuilder = getArrowInitializer(input.sourceFile, "buildSubQuestionSections");
  const requiredBuilderCalls = [
    "buildStageOverviewRows",
    "buildDecompositionSection",
    "buildCoverageSection",
    "buildFinalStageSection",
    "buildEvidenceIndexTable",
  ] as const;
  const hasCoreBuilderCalls = requiredBuilderCalls.every((callText) =>
    renderer?.getDescendantsOfKind(SyntaxKind.CallExpression)
      .some((call) => call.getExpression().getText() === callText),
  );
  const hasSubQuestionBuilders = ["buildDefaultSubQuestionSection", "buildLegacySubQuestionSection"].every((identifier) =>
    renderer?.getDescendantsOfKind(SyntaxKind.Identifier)
      .some((node) => node.getText() === identifier),
  );
  const hasComposedSectionBuilder = renderer?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => call.getExpression().getText() === "buildFullFlowReportSections") ?? false;
  const helperCoversCoreBuilders = requiredBuilderCalls.every((callText) =>
    fullFlowSectionBuilder?.getDescendantsOfKind(SyntaxKind.CallExpression)
      .some((call) => call.getExpression().getText() === callText),
  );
  const helperCoversSubQuestionBuilders = ["buildDefaultSubQuestionSection", "buildLegacySubQuestionSection"].every((identifier) =>
    subQuestionSectionBuilder?.getDescendantsOfKind(SyntaxKind.Identifier)
      .some((node) => node.getText() === identifier),
  );
  const hasDirectFullFlowConstruction = hasCoreBuilderCalls && hasSubQuestionBuilders;
  const hasHelperFullFlowConstruction = hasComposedSectionBuilder
    && helperCoversCoreBuilders
    && helperCoversSubQuestionBuilders;
  if (!hasDirectFullFlowConstruction && !hasHelperFullFlowConstruction) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-no-summary-only-builder",
      lawId: input.lawId,
      filePath: exportMarkdownPath,
      message: "Full-flow report renderer must build stage overview, analysis coverage, decomposition, default and legacy sub-question stages, final adjudication, and evidence index instead of summary-only markdown.",
    }));
  }
};

const inspectMarkdownRenderer = (input: {
  context: InspectorContext;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  const sourceFile = getSourceFile(input.context, exportMarkdownPath);
  input.inspectedFiles.add(exportMarkdownPath);
  if (!sourceFile) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-markdown-file",
      lawId: input.lawId,
      filePath: exportMarkdownPath,
      message: "Deep Research full-flow markdown renderer file must exist.",
    }));
    return;
  }
  inspectMarkdownPersistedState({ sourceFile, findings: input.findings, lawId: input.lawId });
  inspectMarkdownSections({ sourceFile, findings: input.findings, lawId: input.lawId });
  inspectMarkdownBuilderCalls({ sourceFile, findings: input.findings, lawId: input.lawId });
};

const inspectAcceptanceScriptRegistration = (input: {
  ciFullFile: SourceFile | undefined;
  packageJson: { scripts?: Record<string, string> };
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  if (!input.packageJson.scripts?.["acceptance:deep-research-report-export"]) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-package-script",
      lawId: input.lawId,
      filePath: packageJsonPath,
      message: "package.json must expose acceptance:deep-research-report-export.",
    }));
  }
  if (!input.ciFullFile || !hasStringLiteral(input.ciFullFile, "acceptance:deep-research-report-export")) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-ci-full",
      lawId: input.lawId,
      filePath: ciFullPath,
      message: "ci-full.ts must execute acceptance:deep-research-report-export.",
    }));
  }
};

const inspectAcceptanceFile = (input: {
  acceptanceFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  if (!input.acceptanceFile) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-acceptance-load",
      lawId: input.lawId,
      filePath: acceptancePath,
      message: "Full-flow report export acceptance must load in the audit project.",
    }));
    return;
  }
  const acceptanceFile = input.acceptanceFile;
  input.inspectedFiles.add(getRepoSourcePath(acceptanceFile));
  const requiredSymbols = [
    "createDeepResearchRecordStore",
    "buildDeepResearchFinalPackage",
    "exportDeepResearchArtifacts",
  ] as const;
  const missingSymbol = requiredSymbols.find((symbol) =>
    !acceptanceFile.getDescendantsOfKind(SyntaxKind.Identifier)
      .some((identifier) => identifier.getText() === symbol),
  );
  if (missingSymbol) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-acceptance-symbols",
      lawId: input.lawId,
      filePath: acceptancePath,
      message: `Full-flow report export acceptance must exercise real Deep Research surface ${missingSymbol}.`,
    }));
  }
  const requiredAssertions = [
    "# Deep Research Full Flow Report",
    "## Stage 1: Decomposition",
    "## Analysis Coverage",
    "## Final Adjudication",
    "## Evidence Index",
  ] as const;
  const missingAssertion = requiredAssertions.find((text) => !hasStringLiteral(acceptanceFile, text));
  if (missingAssertion) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-acceptance-assertions",
      lawId: input.lawId,
      filePath: acceptancePath,
      message: `Full-flow report export acceptance must assert ${missingAssertion}.`,
    }));
  }
};

const inspectAcceptanceAndCi = (input: {
  context: InspectorContext;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  input.inspectedFiles.add(acceptancePath);
  input.inspectedFiles.add(ciFullPath);
  input.inspectedFiles.add(packageJsonPath);

  if (!existsSync(resolveFromRepo(acceptancePath))) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-export-acceptance-file",
      lawId: input.lawId,
      filePath: acceptancePath,
      message: "scripts/acceptance/deep-research-report-export.acceptance.ts must exist.",
    }));
    return;
  }

  const acceptanceFile = getSourceFile(input.context, acceptancePath);
  const ciFullFile = getSourceFile(input.context, ciFullPath);
  const packageJson = JSON.parse(readFileSync(resolveFromRepo(packageJsonPath), "utf8")) as {
    scripts?: Record<string, string>;
  };
  inspectAcceptanceScriptRegistration({
    ciFullFile,
    packageJson,
    findings: input.findings,
    lawId: input.lawId,
  });
  inspectAcceptanceFile({
    acceptanceFile,
    findings: input.findings,
    inspectedFiles: input.inspectedFiles,
    lawId: input.lawId,
  });
};

export const inspectFullFlowReportExport = (input: {
  context: InspectorContext;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
  deckTextCeilingLawId: string;
}): void => {
  inspectRenderedPromptSchema(input);
  inspectRenderedPromptPersistence(input);
  inspectExportOwner(input);
  inspectBusinessDeckNoTextCeiling({
    deckStageFile: getSourceFile(input.context, "src/plugins/deep-research-analysis/deep-research-analysis.deck-stage.ts"),
    findings: input.findings,
    inspectedFiles: input.inspectedFiles,
    lawId: input.deckTextCeilingLawId,
  });
  inspectMarkdownRenderer(input);
  inspectAcceptanceAndCi(input);
};
