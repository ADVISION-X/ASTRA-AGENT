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

const hasNumericArrayLiteral = (
  sourceFile: SourceFile | undefined,
  variableName: string,
  expectedValues: readonly number[],
): boolean => {
  const declaration = sourceFile?.getVariableDeclaration(variableName);
  const rawInitializer = declaration?.getInitializer();
  const initializer = rawInitializer?.getKind() === SyntaxKind.AsExpression
    ? rawInitializer.getFirstChildByKind(SyntaxKind.ArrayLiteralExpression)
    : rawInitializer?.asKind(SyntaxKind.ArrayLiteralExpression);
  if (!initializer) return false;
  const values = initializer.getElements().map((element) => Number(element.getText().replaceAll("_", "")));
  return expectedValues.every((expectedValue, index) => values[index] === expectedValue);
};

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
  const shellPredicateMarker = "isChatGptShellHtmlDocument";
  if (!hasIdentifier(input.captureFile, shellPredicateMarker) || !hasIdentifier(input.exportFile, shellPredicateMarker)) {
    pushCaptureFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: paths.capturePath,
      message: `HTML artifact capture and export must reject ChatGPT shell documents and require business report marker ${shellPredicateMarker}.`,
    });
  }
  for (const marker of ["window.__reactroutercontext", "/cdn/assets/", "data-message-author-role"]) {
    if (hasStringLiteral(input.captureFile, marker) && hasStringLiteral(input.exportFile, marker)) continue;
    pushCaptureFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: paths.capturePath,
      message: `HTML artifact capture and export must reject ChatGPT shell documents and require business report marker ${marker}.`,
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

const inspectArtifactDownloadRetry = (input: HtmlCaptureInspectionInput, paths: HtmlCapturePaths): void => {
  const hasRetryDelays = hasNumericArrayLiteral(
    input.captureFile,
    "HTML_ARTIFACT_CAPTURE_RETRY_DELAYS_MS",
    [1_000, 2_000, 4_000, 8_000, 16_000, 30_000],
  );
  const hasRealClick = hasIdentifier(input.captureFile, "clickLocatedChatGptHtmlArtifactControl")
    && hasStringLiteral(input.captureFile, "browserViewport");
  const hasCurrentPrimaryLabel = hasIdentifier(input.captureFile, "locatePrimaryChatGptHtmlArtifactEntry")
    && hasStringLiteral(input.captureFile, "下载 HTML 报告");
  const checks = [
    {
      ok: hasIdentifier(input.captureFile, "waitBeforeHtmlArtifactRetry") && hasRetryDelays,
      message: "HTML artifact capture must use exponential retry delays while waiting for ChatGPT download readiness.",
    },
    {
      ok: hasRealClick,
      message: "HTML artifact capture must use a real browser viewport click, not only a DOM click script.",
    },
    {
      ok: hasCurrentPrimaryLabel,
      message: "HTML artifact capture must locate ChatGPT's current primary HTML report download label.",
    },
  ];
  for (const check of checks) {
    if (check.ok) continue;
    pushCaptureFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: paths.capturePath,
      message: check.message,
    });
  }
  process.stdout.write(
    `[AUDIT][deep-research-analysis][html-artifact-capture] exponentialRetry=${hasRetryDelays} realClick=${hasRealClick} currentPrimaryLabel=${hasCurrentPrimaryLabel} findings=${checks.filter((check) => !check.ok).length}\n`,
  );
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
  if (!hasIdentifier(input.sharedFile, "captureChatGptBusinessHtmlArtifact")) {
    pushCaptureFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: paths.sharedPath,
      message: "GPT web-chat shared runtime must call captureChatGptBusinessHtmlArtifact.",
    });
  }
  if (!hasIdentifier(input.sharedFile, "isBusinessHtmlReportRequest")) {
    pushCaptureFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: paths.sharedPath,
      message: "GPT web-chat shared runtime must detect governed business HTML artifact requests before allowing inline response success.",
    });
  }
  if (hasStringLiteral(input.sharedFile, "review_required: provider did not produce a business-report.html artifact.")) {
    return;
  }
  pushCaptureFinding({
    findings: input.findings,
    lawId: input.lawId,
    filePath: paths.sharedPath,
    message: "GPT web-chat shared runtime must reject business HTML report success when no business-report.html artifact was captured.",
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
    exportPath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts",
    sharedPath: "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts",
    proofPath: "src/capabilities/ai-input-gateway/runtime/ai-feed-proof.ts",
  };

  inspectCaptureMarkers(input, paths);
  inspectCaptureIdentifiers(input, paths);
  inspectCaptureOrder(input, paths);
  inspectArtifactDownloadRetry(input, paths);
  inspectHtmlArtifactExport(input, paths);
  inspectSharedRuntime(input, paths);
  inspectProofRefs(input, paths);
};
