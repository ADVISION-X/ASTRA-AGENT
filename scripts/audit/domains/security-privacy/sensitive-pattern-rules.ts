import type { PatternRule } from "../_shared/pattern-scan-rule.js";

export const SENSITIVE_PATTERNS: PatternRule[] = [
  {
    lawId: "GRASSEYE-SECURITY-PRIVACY-001-V1",
    severity: "error",
    pattern: /console\.(log|info|warn|error)\([^\n]*(access[_-]?token|refresh[_-]?token|session[_-]?token|auth[_-]?token|cookies?|password)/i,
    message: "Sensitive token, cookie, session, or password appears in logs.",
  },
  {
    lawId: "GRASSEYE-SECURITY-PRIVACY-001-V1",
    severity: "error",
    pattern: /export\s+(const|let|var|function|class|async function)\s+(raw|stored|saved|exported)?\s*(cookies?|cookieJar|access[_-]?token|refresh[_-]?token|session[_-]?token|auth[_-]?token|password)\b/i,
    message: "Source appears to export cookies, sessions, or tokens.",
  },
  {
    lawId: "GRASSEYE-SECURITY-PRIVACY-001-V1",
    severity: "error",
    pattern: /0\.0\.0\.0|public exposure/i,
    message: "Public exposure pattern found in source tree.",
  },
  {
    lawId: "GRASSEYE-SECURITY-PRIVACY-001-V1",
    severity: "error",
    pattern: /browserless|remote browser|stealth|anti-detect|fingerprint spoof|proxy pool/i,
    message: "Forbidden remote-browser or anti-detection pattern found in source tree.",
  },
];
