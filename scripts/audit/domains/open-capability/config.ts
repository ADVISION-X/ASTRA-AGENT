/**
 * config.ts — Open capability inspector configuration.
 */

export const OPEN_INSPECTOR_CONFIG = {
  /** Maximum allowed source files in src/capabilities/open */
  maxOpenFiles: 14,
  /** Maximum allowed source files in scripts/audit/domains/open-capability */
  maxAuditFiles: 3,
  /** Required active children — no more, no less */
  requiredActiveChildren: [
    "open-platform-entry-once",
    "open-local-workbench-once",
  ] as const,
  /** Banned child capability IDs — must not appear anywhere in open source */
  bannedChildIds: [
    "open-facebook",
    "open-tiktok",
    "open-local-program",
  ] as const,
  /** Banned string patterns in open source files */
  bannedPatterns: [
    "pageStateHandoff",
    "pageStateRef",
    "page-state handoff",
    "raw page-state",
    "defaultTargetUrl",
    "fallbackTargetUrl",
    "fallbackUrl",
    "fallback",
    "default URL",
    "mapId",
    "runtimePlanId",
    "routePlanId",
    "activationId",
    "templateId",
    "selectedMapId",
    "bindingPackageId",
    "bindingPackageVersion",
    "selectedBindingId",
    "bindingVersion",
    "bindingSnapshotRef",
    "branchToken",
    "deterministicFlow",
    "pageReady",
    "pageCorrect",
    "feedReady",
    "semanticSuccess",
    "businessSuccess",
    "loginSemantic",
    "captchaSemantic",
    "safetySemantic",
    "feedSemantic",
    "videoSemantic",
    "commentSemantic",
  ] as const,
  /** Banned cross-boundary imports — open must not import these */
  bannedImports: [
    "capabilities/ai/",
    "capabilities/screenshot/runtime",
    "capabilities/mouse-click/runtime",
    "capabilities/geometry-guard/runtime",
    "capabilities/orchestration/runtime",
    "capabilities/forensics-persistence/runtime",
  ] as const,
  /** Required MuscleMemory action codes */
  requiredMuscleCodes: [
    "OPEN_PLATFORM_ENTRY_ONCE",
    "OPEN_LOCAL_WORKBENCH_ONCE",
  ] as const,
  /** Banned MuscleMemory action codes */
  bannedMuscleCodes: [
    "OPEN_FACEBOOK",
    "OPEN_TIKTOK",
    "OPEN_LOCAL_PROGRAM",
  ] as const,
} as const;
