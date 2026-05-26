import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const hasIdentifier = (sourceFile: SourceFile | undefined, value: string): boolean =>
  !!sourceFile?.getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => identifier.getText() === value);

const hasStringLiteral = (sourceFile: SourceFile | undefined, value: string): boolean =>
  !!sourceFile?.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .some((literal) => literal.getLiteralText() === value);

const hasPropertyName = (sourceFile: SourceFile | undefined, value: string): boolean =>
  !!sourceFile?.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .some((assignment) => assignment.getName() === value);

const identifierPosition = (sourceFile: SourceFile | undefined, value: string): number | null =>
  sourceFile?.getDescendantsOfKind(SyntaxKind.Identifier)
    .find((identifier) => identifier.getText() === value)
    ?.getStart() ?? null;

const pushCaptureFinding = (input: {
  findings: InspectorFinding[];
  lawId: string;
  filePath: string;
  message: string;
}): void => {
  input.findings.push(createFinding({
    checkId: "deep-research/html-artifact-capture-chain",
    lawId: input.lawId,
    filePath: input.filePath,
    message: input.message,
  }));
};

type HtmlCapturePaths = {
  capturePath: string;
  exportPath: string;
  proofPath: string;
  sharedPath: string;
};

type HtmlCaptureInspectionInput = {
  captureFile: SourceFile | undefined;
  exportFile: SourceFile | undefined;
  sharedFile: SourceFile | undefined;
  proofFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
};

const inspectCaptureMarkers = (input: HtmlCaptureInspectionInput, paths: HtmlCapturePaths): void => {
  for (const marker of ["下载 business-report.html", "下载代码文件", "chatgpt-primary-file-entry", "chatgpt-preview-download"]) {
    if (hasStringLiteral(input.captureFile, marker)) continue;
    pushCaptureFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: paths.capturePath,
      message: `HTML artifact capture must include marker ${marker}.`,
    });
  }
};

const inspectCaptureIdentifiers = (input: HtmlCaptureInspectionInput, paths: HtmlCapturePaths): void => {
  for (const identifier of [
    "captureChatGptBusinessHtmlArtifact",
    "clickPrimaryChatGptHtmlArtifactEntry",
    "clickSecondaryChatGptPreviewDownload",
    "waitForDownloadedBusinessHtml",
    "readActiveHtmlDocument",
    "reopenConversation",
  ]) {
    if (hasIdentifier(input.captureFile, identifier)) continue;
    pushCaptureFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: paths.capturePath,
      message: `HTML artifact capture is missing ${identifier}.`,
    });
  }
};

const inspectCaptureOrder = (input: HtmlCaptureInspectionInput, paths: HtmlCapturePaths): void => {
  const primaryPosition = identifierPosition(input.captureFile, "captureViaPrimaryEntry");
  const secondaryPosition = identifierPosition(input.captureFile, "captureViaSecondaryDownload");
  if (primaryPosition !== null && secondaryPosition !== null && primaryPosition <= secondaryPosition) {
    return;
  }
  pushCaptureFinding({
    findings: input.findings,
    lawId: input.lawId,
    filePath: paths.capturePath,
    message: "HTML artifact capture must try the primary ChatGPT file entry before preview download.",
  });
};

const inspectHtmlArtifactExport = (input: HtmlCaptureInspectionInput, paths: HtmlCapturePaths): void => {
  if (!hasIdentifier(input.exportFile, "isBusinessHtmlArtifactText")) {
    pushCaptureFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: paths.exportPath,
      message: "HTML report export must validate the provider HTML artifact document.",
    });
  }
  if (hasStringLiteral(input.exportFile, "inline_html_document")) {
    pushCaptureFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: paths.exportPath,
      message: "HTML report export must not keep inline_html_document source kind.",
    });
    return;
  }
  if (hasStringLiteral(input.exportFile, "html_artifact")) {
    return;
  }
  pushCaptureFinding({
    findings: input.findings,
    lawId: input.lawId,
    filePath: paths.exportPath,
    message: "HTML report export must persist the html_artifact source kind.",
  });
};

const inspectSharedRuntime = (input: HtmlCaptureInspectionInput, paths: HtmlCapturePaths): void => {
  if (hasIdentifier(input.sharedFile, "captureChatGptBusinessHtmlArtifact")) {
    return;
  }
  pushCaptureFinding({
    findings: input.findings,
    lawId: input.lawId,
    filePath: paths.sharedPath,
    message: "GPT web-chat shared runtime must call captureChatGptBusinessHtmlArtifact.",
  });
};

const inspectProofRefs = (input: HtmlCaptureInspectionInput, paths: HtmlCapturePaths): void => {
  if (hasPropertyName(input.sharedFile, "outputRefs") && hasPropertyName(input.proofFile, "outputRefs")) {
    return;
  }
  pushCaptureFinding({
    findings: input.findings,
    lawId: input.lawId,
    filePath: paths.proofPath,
    message: "Captured HTML artifact refs must flow through provider raw response and AI feed proof.",
  });
};

export const inspectHtmlArtifactCaptureChain = (input: {
  captureFile: SourceFile | undefined;
  exportFile: SourceFile | undefined;
  sharedFile: SourceFile | undefined;
  proofFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of [input.captureFile, input.exportFile, input.sharedFile, input.proofFile]) {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }

  const paths: HtmlCapturePaths = {
    capturePath: "src/capabilities/ai-input-gateway/providers/web-chat-html-artifact-capture.ts",
    exportPath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-export.ts",
    sharedPath: "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts",
    proofPath: "src/capabilities/ai-input-gateway/runtime/ai-feed-proof.ts",
  };

  inspectCaptureMarkers(input, paths);
  inspectCaptureIdentifiers(input, paths);
  inspectCaptureOrder(input, paths);
  inspectHtmlArtifactExport(input, paths);
  inspectSharedRuntime(input, paths);
  inspectProofRefs(input, paths);
};
