const ZOMBIE_PROTECTED_FILE_PATHS = [
  "src/muscle-memory/catalog/muscle-memory-catalog.generated.json",
] as const;

const ZOMBIE_PROTECTED_PATH_PREFIXES = [
  "scripts/audit/generated/",
  "scripts/acceptance/",
  "scripts/debug-loop/",
  "scripts/startup/",
  "src/types/",
] as const;

const ZOMBIE_PROTECTED_PATH_SEGMENTS = [
  "/shared/",
  "/ports/",
] as const;

const ZOMBIE_PROTECTED_PATH_SUFFIXES = [
  "/contract.ts",
  "/schema.ts",
  "/types.ts",
  "/index.ts",
  "/registry.ts",
  "/inspector.ts",
  "/run-inspector.ts",
  "/run-inspector-nested.ts",
  "/run-scan.ts",
  "/run-report.ts",
  "/run-single-function-inspect.ts",
  "-support.ts",
  "-gate.ts",
  "-policy.ts",
  "-state.ts",
  "-failure.ts",
  "-failure-builders.ts",
  "-failure-envelope.ts",
  "-result.ts",
  "-result-envelope.ts",
  "-resolvers.ts",
  "-recorders.ts",
  "-events.ts",
  "-controls.ts",
  "-factory.ts",
  "-catalog-port.ts",
  "schema-proof.ts",
] as const;

const ZOMBIE_DISABLED_PROMPT_CONTRACT_SUFFIX = ".disabled.prompt-contract.json" as const;

const ZOMBIE_DORMANT_ROUTE_STEP_IDS = [
  "observe-comments-entry-page-state",
  "analyze-comments-entry-target-candidate",
  "observe-comments-button",
  "normalize-comments-target",
  "click-comments-button",
  "verify-comments-open",
  "capture-comments-panel",
  "extract-visible-comments",
  "write-seeding-evidence-record",
  "finalize-seeding-evidence-packet",
  "finalize-seeding-browse-ledger",
  "capture-next-item-verification-viewport",
  "prepare-next-item-verification-ai-input",
  "verify-next-item-advanced",
] as const;

const hasPathPrefix = (relativePath: string, prefix: string): boolean => relativePath.startsWith(prefix);

const hasProtectedSegment = (relativePath: string): boolean =>
  ZOMBIE_PROTECTED_PATH_SEGMENTS.some((segment) => relativePath.includes(segment));

const hasProtectedSuffix = (relativePath: string): boolean =>
  ZOMBIE_PROTECTED_PATH_SUFFIXES.some((suffix) => relativePath.endsWith(suffix));

export const getZombieProtectedSeamForPath = (relativePath: string): string | null => {
  if (ZOMBIE_PROTECTED_FILE_PATHS.includes(relativePath as (typeof ZOMBIE_PROTECTED_FILE_PATHS)[number])) {
    return "generated-source-artifact";
  }
  if (ZOMBIE_PROTECTED_PATH_PREFIXES.some((prefix) => hasPathPrefix(relativePath, prefix))) {
    return "generated-artifact-prefix";
  }
  if (hasProtectedSegment(relativePath)) {
    return "public-support-surface";
  }
  if (hasProtectedSuffix(relativePath)) {
    return "public-surface-entrypoint";
  }
  if (relativePath.endsWith(ZOMBIE_DISABLED_PROMPT_CONTRACT_SUFFIX)) {
    return "disabled-prompt-contract";
  }
  return null;
};

export const getZombieProtectedSeamForRouteStepId = (stepId: string): string | null =>
  ZOMBIE_DORMANT_ROUTE_STEP_IDS.includes(stepId as (typeof ZOMBIE_DORMANT_ROUTE_STEP_IDS)[number])
    ? "product-discovery-route-plan.v1#inactiveStepIds"
    : null;

export const isZombieProtectedPath = (relativePath: string): boolean => getZombieProtectedSeamForPath(relativePath) !== null;

export const isZombieProtectedRouteStepId = (stepId: string): boolean => getZombieProtectedSeamForRouteStepId(stepId) !== null;