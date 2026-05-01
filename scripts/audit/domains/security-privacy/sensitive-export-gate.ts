const SENSITIVE_EXPORT_PATTERN =
  /export\s+(const|let|var|function|class|async function)\s+(raw|stored|saved|exported)?\s*(cookies?|cookieJar|access[_-]?token|refresh[_-]?token|session[_-]?token|auth[_-]?token|password)\b/i;

export const hasSensitiveExport = (text: string): boolean => SENSITIVE_EXPORT_PATTERN.test(text);
