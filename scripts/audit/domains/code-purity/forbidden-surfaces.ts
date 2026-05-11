// Code Purity — forbidden retired surface patterns.
// HARD: any match in active source = FAIL (retired system re-activation risk).
// These are string patterns to search for in non-comment production code.

export const FORBIDDEN_ACTIVE_PATTERNS_HARD = [
  // Retired page-state / PAV capability systems
  "page-state-capability",
  "post-action-verification-capability",
  "src/capabilities/page-state",
  "src/capabilities/post-action-verification",

  // Retired AI provider system
  "future-api-ai",
  "paid-analysis-ai",
  "paid-vision-ai",
  "local-vision-ai",
  "local-text-ai",
  "local-ocr-ai",
  "internal-schema-validator",
  "providerRouter",
  "prompt-registry",
  "role-controls",
  "cloudFallback",
  "paidProvider",
  "futureProvider",

  // Retired screenshot children
  "prepare-visual-mission-input",
  "optimize-lossless",
  "capture-desktop-screen",
  "visual-mission-output-schema",

  // Retired open children
  "open-facebook",
  "open-tiktok",
  "open-local-program",

  // Retired commander read-model children
  "show-audit-summary",
  "show-browse-ledger",
  "show-capability-health",
  "show-capability-roster",
  "show-evidence-packets",
  "show-failed-records",
  "show-review-queue",
  "show-runtime-proof-timeline",
  "inspect-record-detail",

  // Retired forensics children
  "write-product-lead-record",
  "write-structured-action-log",
  "write-ai-result-record",
  "finalize-browse-ledger",
  "finalize-evidence-packet",
  "update-runtime-snapshot",
] as const;

// Paths that are exempt from retired-surface checks (docs, archives, governance files).
export const ALLOWED_ARCHIVE_PATH_PATTERNS = [
  "docs/",
  ".github/instructions/",
  "forbidden-surfaces.ts",
  "scripts/audit/domains/quality-kernel/",
  "scripts/audit/domains/code-purity/",
  "系统调试",
] as string[];

// Source prefixes excluded from retired-surface scanning.
// e.g. src/lib/browser/ uses primitive operation names that happen to contain
// substrings that would otherwise match retired pattern names.
export const RETIRED_SURFACE_SCAN_EXCLUDED_PREFIXES = [
  "src/lib/browser/",
] as string[];
