export type WebChatArtifactCandidate = {
  artifactName: string;
  artifactMimeType: string;
  sourcePath: string;
};

const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const stripWrapper = (value: string): string =>
  value.trim().replace(/^["'<(]+|[.,;"')>]+$/gu, "");

const readJsonCandidate = (rawText: string): WebChatArtifactCandidate | null => {
  try {
    const parsed = JSON.parse(rawText) as { pptxArtifactPath?: unknown; artifactPath?: unknown; filePath?: unknown };
    const source = [parsed.pptxArtifactPath, parsed.artifactPath, parsed.filePath]
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);
    return source ? buildWebChatArtifactCandidate(source) : null;
  } catch {
    return null;
  }
};

export const buildWebChatArtifactCandidate = (sourcePath: string): WebChatArtifactCandidate => {
  const normalizedSourcePath = stripWrapper(sourcePath.replace(/^file:\/\//u, ""));
  return {
    artifactName: normalizedSourcePath.split(/[\\/]/u).pop() ?? "business-deck.pptx",
    artifactMimeType: PPTX_MIME,
    sourcePath: normalizedSourcePath,
  };
};

export const detectPptxArtifactInWebChatResponse = (
  rawText: string,
): WebChatArtifactCandidate | null => {
  const jsonCandidate = readJsonCandidate(rawText);
  if (jsonCandidate) return jsonCandidate;
  const markerMatch = rawText.match(/(?:PPTX_ARTIFACT_PATH|pptxArtifactPath|artifactPath)\s*[:=]\s*([^\n\r]+)/iu);
  if (markerMatch?.[1]) return buildWebChatArtifactCandidate(markerMatch[1]);
  const pathMatch = rawText.match(/(?:file:\/\/)?(?:[A-Za-z]:)?[^\s"'<>]+\.pptx\b/iu);
  return pathMatch?.[0] ? buildWebChatArtifactCandidate(pathMatch[0]) : null;
};
