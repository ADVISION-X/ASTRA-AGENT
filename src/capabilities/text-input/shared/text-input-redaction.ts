export function buildRedactedPreview(value: string, maxPreviewChars: number): string {
  const trimmed = value.slice(0, Math.max(0, maxPreviewChars));
  return trimmed.replace(/[A-Za-z0-9]/g, "*");
}