import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { toRepoPath } from "../../shared/paths.js";
import { inspectDownloadStepRecurrenceGuards } from "./inspector-download-row-guards.js";

type DownloadFlowInspectionInput = {
  file: SourceFile | null;
  pageStateFile: SourceFile | null;
  findings: InspectorFinding[];
  lawIds: { evidence: string; owner: string; artifact: string };
  ownerRoot: string;
  downloadFlowPath: string;
  downloadPageStatePath: string;
  evidenceStepIds: readonly string[];
};

const stringLiteralValues = (file: SourceFile): Set<string> =>
  new Set([
    ...file.getDescendantsOfKind(SyntaxKind.StringLiteral).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((item) => item.getLiteralText()),
  ]);

const addFinding = (
  findings: InspectorFinding[],
  input: {
    checkId: string;
    filePath: string;
    lawId: string;
    message: string;
  },
): void => {
  findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.filePath,
    message: input.message,
  }));
};

const inspectDownloadOwner = (
  input: DownloadFlowInspectionInput & { file: SourceFile },
): void => {
  const { file, findings, lawIds } = input;
  const repoPath = toRepoPath(file.getFilePath());
  if (!repoPath.startsWith(input.ownerRoot)) {
    addFinding(findings, {
      checkId: "amazon-invoice-upload/download-flow-owner",
      lawId: lawIds.owner,
      filePath: repoPath,
      message: "Download flow must live under src/plugins/amazon-invoice-upload.",
    });
  }
};

const inspectDownloadStepIds = (
  input: DownloadFlowInspectionInput,
  values: Set<string>,
): void => {
  for (const stepId of input.evidenceStepIds) {
    if (!values.has(stepId)) {
      addFinding(input.findings, {
        checkId: "amazon-invoice-upload/download-flow-step-id",
        lawId: input.lawIds.evidence,
        filePath: input.downloadFlowPath,
        message: `Download flow must cite Evidence Map step ${stepId}.`,
      });
    }
  }
};

const inspectDownloadStaticContracts = (
  input: DownloadFlowInspectionInput & { file: SourceFile },
  values: Set<string>,
  pageStateValues: Set<string>,
): void => {
  const { file, pageStateFile, findings, lawIds } = input;
  const calls = file.getDescendantsOfKind(SyntaxKind.CallExpression);
  if (!calls.some((call) => Node.isIdentifier(call.getExpression())
    && astIdentifierName(call.getExpression()) === "recordAmazonDomStepTrace")) {
    addFinding(findings, {
      checkId: "amazon-invoice-upload/download-flow-dom-trace",
      lawId: lawIds.evidence,
      filePath: input.downloadFlowPath,
      message: "Download flow must call recordAmazonDomStepTrace.",
    });
  }
  if (!values.has("manual_required")) {
    addFinding(findings, {
      checkId: "amazon-invoice-upload/download-flow-manual-required",
      lawId: lawIds.evidence,
      filePath: input.downloadFlowPath,
      message: "Download flow must expose manual_required gates.",
    });
  }
  if (!values.has("Latest row is not proven to be the current requested CSV report.")) {
    addFinding(findings, {
      checkId: "amazon-invoice-upload/current-request-row-gate",
      lawId: lawIds.evidence,
      filePath: input.downloadFlowPath,
      message: "Download flow must reject rows that are not proven to be the current requested CSV report.",
    });
  }
  if (!values.has("进行中") && !pageStateValues.has("进行中")) {
    addFinding(findings, {
      checkId: "amazon-invoice-upload/current-request-in-progress-gate",
      lawId: lawIds.evidence,
      filePath: pageStateFile ? input.downloadPageStatePath : input.downloadFlowPath,
      message: "Download flow must observe the current requested row entering 进行中 before waiting for 下载.",
    });
  }
  if (values.has("documentId")) {
    addFinding(findings, {
      checkId: "amazon-invoice-upload/no-document-id-log",
      lawId: lawIds.artifact,
      filePath: input.downloadFlowPath,
      message: "Download flow must not persist or log Amazon download documentId.",
    });
  }
};

export const inspectDownloadFlow = (input: DownloadFlowInspectionInput): void => {
  const { file, pageStateFile, findings, lawIds } = input;
  if (!file) return;
  const values = stringLiteralValues(file);
  const pageStateValues = pageStateFile ? stringLiteralValues(pageStateFile) : new Set<string>();
  inspectDownloadOwner({ ...input, file });
  inspectDownloadStepIds(input, values);
  inspectDownloadStaticContracts({ ...input, file }, values, pageStateValues);
  inspectDownloadStepRecurrenceGuards(
    file,
    pageStateFile,
    findings,
    lawIds.evidence,
    input.downloadFlowPath,
    input.downloadPageStatePath,
  );
};
