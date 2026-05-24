import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

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

const buildArtifactPersistChecks = (input: {
  detectorFile: SourceFile | undefined;
  downloadFile: SourceFile | undefined;
  exportFile: SourceFile | undefined;
  recordsFile: SourceFile | undefined;
  recordContractsFile: SourceFile | undefined;
}) => {
  const detectorSymbols = new Set(input.detectorFile?.getVariableDeclarations().map((declaration) => declaration.getName()) ?? []);
  const downloadSymbols = new Set(input.downloadFile?.getVariableDeclarations().map((declaration) => declaration.getName()) ?? []);
  const joinedText = [
    input.detectorFile?.getFullText() ?? "",
    input.downloadFile?.getFullText() ?? "",
    input.exportFile?.getFullText() ?? "",
    input.recordsFile?.getFullText() ?? "",
    input.recordContractsFile?.getFullText() ?? "",
  ].join("\n");
  return [
    {
      ok: detectorSymbols.has("detectHtmlArtifactInWebChatResponse"),
      marker: "HTML artifact detector",
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-html-artifact-detector.ts",
    },
    {
      ok: detectorSymbols.has("extractRawHtmlDocumentFromWebChatResponse"),
      marker: "raw HTML extractor",
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-html-artifact-detector.ts",
    },
    {
      ok: downloadSymbols.has("downloadWebChatHtmlArtifact"),
      marker: "HTML artifact download function",
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-html-artifact-download.ts",
    },
    {
      ok: joinedText.includes("business-report.html"),
      marker: "business-report.html export kind",
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts",
    },
    {
      ok: joinedText.includes("payloadJson"),
      marker: "export payloadJson persistence",
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts",
    },
    {
      ok: joinedText.includes("business_html_artifact_missing"),
      marker: "business_html_artifact_missing failure state",
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-export.ts",
    },
    {
      ok: joinedText.includes("business_html_invalid_file"),
      marker: "business_html_invalid_file failure state",
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-export.ts",
    },
    {
      ok: joinedText.includes("business_html_persist_failed"),
      marker: "business_html_persist_failed failure state",
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-html-artifact-download.ts",
    },
    {
      ok: joinedText.includes("sourceKind"),
      marker: "sourceKind persistence",
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-records.ts",
    },
  ] as const;
};

const inspectArtifactPersistChecks = (input: {
  checks: ReturnType<typeof buildArtifactPersistChecks>;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  for (const check of input.checks) {
    if (check.ok) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/html-report-artifact-persist",
      lawId: input.lawId,
      filePath: check.filePath,
      message: `HTML report delivery must include ${check.marker}.`,
    }));
  }
};

const inspectDownloadAst = (input: {
  downloadFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const downloadCallCount = input.downloadFile?.getDescendantsOfKind(SyntaxKind.CallExpression).length ?? 0;
  if (downloadCallCount !== 0) {
    return;
  }
  input.findings.push(createFinding({
    checkId: "deep-research/html-report-download-ast",
    lawId: input.lawId,
    filePath: "src/capabilities/ai-input-gateway/providers/web-chat-html-artifact-download.ts",
    message: "HTML artifact delivery must stay AST-visible to the inspector.",
  }));
};

const inspectCiBinding = (input: {
  ciFullFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  if ((input.ciFullFile?.getFullText() ?? "").includes("acceptance:deep-research-html-artifact-persist")) {
    return;
  }
  input.findings.push(createFinding({
    checkId: "deep-research/html-report-artifact-ci",
    lawId: input.lawId,
    filePath: "scripts/audit/ci-full.ts",
    message: "ci:full must execute acceptance:deep-research-html-artifact-persist.",
  }));
};

export const inspectHtmlReportArtifactPersist = (input: {
  context: InspectorContext;
  detectorFile: SourceFile | undefined;
  downloadFile: SourceFile | undefined;
  exportFile: SourceFile | undefined;
  recordsFile: SourceFile | undefined;
  recordContractsFile: SourceFile | undefined;
  ciFullFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
}): void => {
  const lawId = selectLawId(input.context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-030-V1");
  markInspected(input.inspectedFiles, [
    input.detectorFile,
    input.downloadFile,
    input.exportFile,
    input.recordsFile,
    input.recordContractsFile,
    input.ciFullFile,
  ]);
  inspectArtifactPersistChecks({
    checks: buildArtifactPersistChecks(input),
    findings: input.findings,
    lawId,
  });
  inspectDownloadAst({
    downloadFile: input.downloadFile,
    findings: input.findings,
    lawId,
  });
  inspectCiBinding({
    ciFullFile: input.ciFullFile,
    findings: input.findings,
    lawId,
  });
};