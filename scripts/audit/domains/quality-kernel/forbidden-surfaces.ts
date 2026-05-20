// Quality Kernel — forbidden surface patterns for retired/dead code anti-regression.
// HARD patterns: PASS fails if found in active production code.
// SOFT patterns: warning only — tracked but does not block PASS.

// HARD: These patterns directly re-introduce a retired system if found in active code.
// Finding any of these outside archive paths means the old system is being re-activated.
export const FORBIDDEN_ACTIVE_PATTERNS_HARD = [
  // Retired support capability systems
  "page-state-capability",
  "post-action-verification-capability",
  "visual-target-capability",
  "src/capabilities/page-state",
  "src/capabilities/post-action-verification",
  "src/capabilities/visual-target",

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

export const FORBIDDEN_ACTIVE_PATTERNS_SOFT = [] as const;

export const FORBIDDEN_GOVERNANCE_PATTERNS_HARD = [
  "compatibility",
  "backward-compatible",
  "deprecated",
  "legacy",
  "compat bridge",
  "compatBridge",
  "stub",
  "temporary",
  "transition",
  "synthetic",
  "repairMissingGridCell",
  "ArrowDown fallback",
  "abilityGroupId ??",
  "childCapabilityId ??",
  "action.abilityGroupId",
  "action.childCapabilityId",
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

export const FORBIDDEN_ATOMIC_BOUNDARY_PATTERNS_HARD = [
  "press-navigation-key",
  "ArrowDown assist",
  "scroll_next_video",
  "scroll_viewport_to_next_item",
] as const;

// Combined active retired-system list.
export const FORBIDDEN_ACTIVE_PATTERNS = FORBIDDEN_ACTIVE_PATTERNS_HARD;

// Paths that are exempt from retired surface checks (docs, archives, governance files).
export const ALLOWED_ARCHIVE_PATH_PATTERNS = [
  "docs/",
  ".github/instructions/",
  "forbidden-surfaces.ts",
  "scripts/audit/domains/quality-kernel/",
  "scripts/audit/domains/code-purity/",
  "系统调试",
] as string[];

export const RETIRED_SURFACE_SCAN_EXCLUDED_PREFIXES = [
  "src/lib/browser/",
] as string[];
