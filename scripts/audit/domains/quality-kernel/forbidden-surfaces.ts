// Quality Kernel — forbidden surface patterns for retired/dead code anti-regression.
// HARD patterns: PASS fails if found in active production code.
// SOFT patterns: warning only — tracked but does not block PASS.

// HARD: These patterns directly re-introduce a retired system if found in active code.
// Finding any of these outside archive paths means the old system is being re-activated.
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

// SOFT: Old field names and types that should be cleaned up but don't directly
// re-introduce a retired system. These are reported as warnings only.
export const FORBIDDEN_ACTIVE_PATTERNS_SOFT = [
  "RuntimePlan",
  "runtimePlanId",
  "routePlanId",
  "selectedMapId",
  "activationId",
  "templateId",
  "bindingPackageId",
  "bindingPackageVersion",
  "selectedBindingId",
  "bindingVersion",
  "bindingSnapshotRef",
  "branchToken",
  "deterministicFlowPlan",
  "pageStateHandoffRef",
  "pageStateRef",
  "postActionVerification",
  "pageReady",
  "pageCorrect",
  "feedReady",
  "actionVerified",
  "semanticSuccess",
  "BrowseLedger",
  "ProductLead",
  "StructuredActionLog",
  "evidence-store",
  "forensics-record-storage",
] as const;

// Keep combined list for backward compat
export const FORBIDDEN_ACTIVE_PATTERNS = FORBIDDEN_ACTIVE_PATTERNS_HARD;

// Paths that are exempt from retired surface checks (docs, archives, governance files).
export const ALLOWED_ARCHIVE_PATH_PATTERNS = [
  "docs/",
  ".github/instructions/",
  "forbidden-surfaces.ts",
  "scripts/audit/domains/quality-kernel/",
  "系统调试",
] as string[];

// Paths to exclude from retired surface scanning for specific reasons:
// - src/lib/browser/ uses "paste-text", "replace-input", "commit-input", "press-navigation-key"
//   as legitimate browser primitive operation names (not retired child capability IDs).
export const RETIRED_SURFACE_SCAN_EXCLUDED_PREFIXES = [
  "src/lib/browser/",
] as string[];
