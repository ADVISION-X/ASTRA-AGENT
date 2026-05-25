const isHtmlDocumentText = (value: string): boolean => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (!/(?:<!DOCTYPE html\b|<html\b)/iu.test(trimmed)) {
    return false;
  }
  if (!/<body\b/iu.test(trimmed)) {
    return false;
  }
  return /<\/html>/iu.test(trimmed) || /<\/body>/iu.test(trimmed);
};

const unwrapHtmlCodeFence = (rawText: string): string | null => {
  const fenceMatch = rawText.match(/```(?:html)?\s*([\s\S]*?)\s*```/iu);
  if (!fenceMatch?.[1]) {
    return null;
  }
  const candidate = fenceMatch[1].trim();
  return isHtmlDocumentText(candidate) ? candidate : null;
};

export const extractInlineHtmlDocumentFromWebChatResponse = (
  rawText: string,
): string | null => {
  const fencedDocument = unwrapHtmlCodeFence(rawText);
  if (fencedDocument) {
    return fencedDocument;
  }
  const normalizedText = rawText.trim();
  return isHtmlDocumentText(normalizedText) ? normalizedText : null;
};
