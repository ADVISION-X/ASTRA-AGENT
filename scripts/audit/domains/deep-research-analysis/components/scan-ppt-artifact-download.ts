import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

export const inspectPptArtifactDownload = (input: {
  context: InspectorContext;
  detectorFile: SourceFile | undefined;
  downloadFile: SourceFile | undefined;
  exportFile: SourceFile | undefined;
  recordContractsFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
}): void => {
  const lawId = selectLawId(input.context.planEntry.lawIds, "GRASSEYE-DEEP-RESEARCH-026-V1");
  [input.detectorFile, input.downloadFile, input.exportFile, input.recordContractsFile].forEach((sourceFile) => {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  });
  const detectorSymbols = new Set(input.detectorFile?.getVariableDeclarations().map((declaration) => declaration.getName()) ?? []);
  const downloadSymbols = new Set(input.downloadFile?.getVariableDeclarations().map((declaration) => declaration.getName()) ?? []);
  const joinedText = [
    input.detectorFile?.getFullText() ?? "",
    input.downloadFile?.getFullText() ?? "",
    input.exportFile?.getFullText() ?? "",
    input.recordContractsFile?.getFullText() ?? "",
  ].join("\n");
  const requirements = [
    { ok: detectorSymbols.has("detectPptxArtifactInWebChatResponse"), marker: "web chat artifact detector" },
    { ok: downloadSymbols.has("downloadWebChatPptxArtifact"), marker: "pptx download function" },
    { ok: joinedText.includes(".pptx"), marker: "file extension check" },
    { ok: joinedText.includes("fileSizeBytes") && joinedText.includes("stat.size"), marker: "file size check" },
    { ok: joinedText.includes("fileHash") && joinedText.includes("sha256:"), marker: "file hash persisted" },
    { ok: joinedText.includes("business-deck.ai-pptx"), marker: "exportKind business-deck.ai-pptx" },
  ];
  const astCallCount = input.downloadFile?.getDescendantsOfKind(SyntaxKind.CallExpression).length ?? 0;
  for (const requirement of requirements) {
    if (requirement.ok && astCallCount > 0) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/ppt-artifact-download",
      lawId,
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-artifact-download.ts",
      message: `PPT artifact delivery must include ${requirement.marker}.`,
    }));
  }
};
