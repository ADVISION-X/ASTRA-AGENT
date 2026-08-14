import { SyntaxKind, type SourceFile } from "ts-morph";

import { astExpressionPath, astIdentifierName } from "../../../shared/ast-node-identity.js";
import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

type InputAttachmentEveryAiFeedInspectionInput = {
  schemaFile: SourceFile | undefined;
  analysisSubQuestionsFile: SourceFile | undefined;
  finalizationFile: SourceFile | undefined;
  htmlReportStageFile: SourceFile | undefined;
  fullCaseFileFile: SourceFile | undefined;
  routesFile: SourceFile | undefined;
  panelFile: SourceFile | undefined;
  clientBootFile: SourceFile | undefined;
  workbenchFile: SourceFile | undefined;
  workbenchInputAttachmentsFile: SourceFile | undefined;
  acceptanceFile: SourceFile | undefined;
  ciAcceptanceBindingsFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
};

const hasIdentifier = (sourceFile: SourceFile | undefined, value: string): boolean =>
  Boolean(sourceFile?.getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => astIdentifierName(identifier) === value));

const hasStringLiteral = (sourceFile: SourceFile | undefined, value: string): boolean =>
  Boolean(sourceFile?.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralValue() === value));

const hasLiteralContaining = (sourceFile: SourceFile | undefined, value: string): boolean => {
  const stringLiterals = sourceFile?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue()) ?? [];
  const templateLiterals = sourceFile?.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((literal) => literal.getLiteralText()) ?? [];
  const templateParts = [
    ...(sourceFile?.getDescendantsOfKind(SyntaxKind.TemplateHead) ?? []),
    ...(sourceFile?.getDescendantsOfKind(SyntaxKind.TemplateMiddle) ?? []),
    ...(sourceFile?.getDescendantsOfKind(SyntaxKind.TemplateTail) ?? []),
  ].map((literal) => literal.getLiteralText());
  return [...stringLiterals, ...templateLiterals, ...templateParts].some((literalValue) => literalValue.includes(value));
};

const countCallExpressions = (sourceFile: SourceFile | undefined, callName: string): number =>
  sourceFile?.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => (
    astExpressionPath(callExpression.getExpression()) === callName
  )).length ?? 0;

const markInspected = (
  inspectedFiles: Set<string>,
  sourceFile: SourceFile | undefined,
): void => {
  if (sourceFile) inspectedFiles.add(getRepoSourcePath(sourceFile));
};

const pushFinding = (
  input: InputAttachmentEveryAiFeedInspectionInput,
  filePath: string,
  message: string,
): void => {
  input.findings.push(createFinding({
    checkId: "deep-research/input-attachment-every-ai-feed",
    lawId: input.lawId,
    filePath,
    message,
  }));
};

const markAllInspectedFiles = (input: InputAttachmentEveryAiFeedInspectionInput): void => {
  [
    input.schemaFile,
    input.analysisSubQuestionsFile,
    input.finalizationFile,
    input.htmlReportStageFile,
    input.fullCaseFileFile,
    input.routesFile,
    input.panelFile,
    input.clientBootFile,
    input.workbenchFile,
    input.workbenchInputAttachmentsFile,
    input.acceptanceFile,
    input.ciAcceptanceBindingsFile,
  ].forEach((sourceFile) => markInspected(input.inspectedFiles, sourceFile));
};

const inspectAttachmentSchemaAndCaseFile = (input: InputAttachmentEveryAiFeedInspectionInput): void => {
  if (
    !hasIdentifier(input.schemaFile, "DeepResearchInputAttachmentSchema")
    || !hasIdentifier(input.schemaFile, "fileHash")
    || !hasIdentifier(input.schemaFile, "fileSizeBytes")
    || !hasIdentifier(input.schemaFile, "sourceKind")
  ) {
    pushFinding(input, "src/plugins/deep-research-analysis/deep-research-analysis.schema.ts", "Deep Research input attachment schema must preserve local file manifest fields.");
  }

  if (!hasIdentifier(input.fullCaseFileFile, "inputAttachments") || !hasIdentifier(input.fullCaseFileFile, "DeepResearchInputAttachmentSchema")) {
    pushFinding(input, "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.ts", "Full Case File must include an inputAttachments manifest.");
  }
};

const inspectAttachmentAiFeeds = (input: InputAttachmentEveryAiFeedInspectionInput): void => {
  const subQuestionRefCount = countCallExpressions(input.analysisSubQuestionsFile, "buildDeepResearchGatewayInputRefs");
  if (subQuestionRefCount < 2 || !hasIdentifier(input.analysisSubQuestionsFile, "inputAttachments")) {
    pushFinding(input, "src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts", "Decomposition and every sub-question AI feed must build input refs with inputAttachments.");
  }
  if (!hasIdentifier(input.finalizationFile, "buildDeepResearchGatewayInputRefs") || !hasIdentifier(input.finalizationFile, "inputAttachments")) {
    pushFinding(input, "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts", "Final adjudication AI feed must include Deep Research inputAttachments.");
  }
  if (!hasIdentifier(input.htmlReportStageFile, "buildDeepResearchGatewayInputRefs") || !hasIdentifier(input.htmlReportStageFile, "inputAttachments")) {
    pushFinding(input, "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts", "HTML report AI feed must include Deep Research inputAttachments.");
  }
};

const inspectAttachmentAppIntake = (input: InputAttachmentEveryAiFeedInspectionInput): void => {
  if (!hasLiteralContaining(input.routesFile, "/api/deep-research-analysis/input-attachments") || !hasIdentifier(input.routesFile, "stageDeepResearchAnalysisInputAttachments")) {
    pushFinding(input, "src/app/workbench-deep-research-routes.ts", "Workbench route must stage app-selected local files through the Deep Research attachment endpoint.");
  }
  if (!hasLiteralContaining(input.panelFile, "deep-research-input-attachment-picker") || !hasLiteralContaining(input.panelFile, "data-deep-research-attachment-list")) {
    pushFinding(input, "src/app/workbench-deep-research-panel.ts", "Deep Research panel must expose local file attachment controls.");
  }
  if (!hasIdentifier(input.clientBootFile, "stageDeepResearchInputAttachmentFiles") || !hasIdentifier(input.clientBootFile, "handleDeepResearchAttachmentPaste")) {
    pushFinding(input, "src/app/workbench-deep-research-client-boot.ts", "Deep Research client boot must stage picker/drop/paste local files before job creation.");
  }
  if (!hasIdentifier(input.workbenchFile, "buildDeepResearchAttachmentStagingHandle")) {
    pushFinding(input, "src/lib/local-runtime/workbench-deep-research-handle.ts", "The Deep Research Workbench handle owner must wire attachment staging.");
  }
  if (!hasIdentifier(input.workbenchInputAttachmentsFile, "stageDeepResearchAttachmentFile") || !hasIdentifier(input.workbenchInputAttachmentsFile, "sourceKind")) {
    pushFinding(input, "src/lib/local-runtime/workbench-deep-research-input-attachments.ts", "Local runtime must persist staged Deep Research attachment files with manifest metadata.");
  }
};

const inspectAttachmentAcceptance = (input: InputAttachmentEveryAiFeedInspectionInput): void => {
  if (!hasStringLiteral(input.acceptanceFile, "acceptance-input-attachment")) {
    pushFinding(input, "scripts/acceptance/deep-research-input-attachments.acceptance.ts", "Deep Research input attachment acceptance must assert Full Case File attachment manifest persistence.");
  }
  if (!hasStringLiteral(input.ciAcceptanceBindingsFile, "scripts/acceptance/deep-research-input-attachments.acceptance.ts")) {
    pushFinding(input, "scripts/audit/ci-acceptance-law-bindings.ts", "ci:full must bind the Deep Research input attachment physical acceptance leaf.");
  }
};

export const inspectInputAttachmentEveryAiFeed = (input: InputAttachmentEveryAiFeedInspectionInput): void => {
  markAllInspectedFiles(input);
  inspectAttachmentSchemaAndCaseFile(input);
  inspectAttachmentAiFeeds(input);
  inspectAttachmentAppIntake(input);
  inspectAttachmentAcceptance(input);
};
