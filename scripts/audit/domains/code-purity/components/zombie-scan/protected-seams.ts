const ZOMBIE_PROTECTED_FILE_PATHS = [
  "scripts/audit/build-audit-artifacts-cli.ts",
  "scripts/audit/ci-full.ts",
  "src/muscle-memory/generated-catalog.json",
] as const;

const ZOMBIE_PACKAGE_SCRIPT_ENTRYPOINTS = [
  "scripts/copy-runtime-assets.mjs",
  "src/app/server.ts",
] as const;

const ZOMBIE_PROTECTED_PATH_PREFIXES = [
  "scripts/audit/generated/",
  "scripts/acceptance/",
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

type ProtectedPathRule = {
  seam: string;
  matches: (relativePath: string) => boolean;
};

const hasPathPrefix = (relativePath: string, prefix: string): boolean => relativePath.startsWith(prefix);

const hasProtectedSegment = (relativePath: string): boolean =>
  ZOMBIE_PROTECTED_PATH_SEGMENTS.some((segment) => relativePath.includes(segment));

const hasProtectedSuffix = (relativePath: string): boolean =>
  ZOMBIE_PROTECTED_PATH_SUFFIXES.some((suffix) => relativePath.endsWith(suffix));

const ZOMBIE_PROTECTED_PATH_RULES: ProtectedPathRule[] = [
  {
    seam: "package-script-entrypoint",
    matches: (relativePath) => ZOMBIE_PACKAGE_SCRIPT_ENTRYPOINTS.includes(relativePath as (typeof ZOMBIE_PACKAGE_SCRIPT_ENTRYPOINTS)[number]),
  },
  {
    seam: "generated-source-artifact",
    matches: (relativePath) => ZOMBIE_PROTECTED_FILE_PATHS.includes(relativePath as (typeof ZOMBIE_PROTECTED_FILE_PATHS)[number]),
  },
  {
    seam: "generated-artifact-prefix",
    matches: (relativePath) => ZOMBIE_PROTECTED_PATH_PREFIXES.some((prefix) => hasPathPrefix(relativePath, prefix)),
  },
  {
    seam: "public-support-surface",
    matches: (relativePath) => hasProtectedSegment(relativePath),
  },
  {
    seam: "public-surface-entrypoint",
    matches: (relativePath) => hasProtectedSuffix(relativePath),
  },
  {
    seam: "disabled-prompt-contract",
    matches: (relativePath) => relativePath.endsWith(ZOMBIE_DISABLED_PROMPT_CONTRACT_SUFFIX),
  },
];

export const getZombieProtectedSeamForPath = (relativePath: string): string | null => {
  return ZOMBIE_PROTECTED_PATH_RULES.find((rule) => rule.matches(relativePath))?.seam ?? null;
};

export const getZombieProtectedSeamForRouteStepId = (stepId: string): string | null =>
  ZOMBIE_DORMANT_ROUTE_STEP_IDS.includes(stepId as (typeof ZOMBIE_DORMANT_ROUTE_STEP_IDS)[number])
    ? "product-discovery-route-plan.v1#inactiveStepIds"
    : null;

export const isZombieProtectedPath = (relativePath: string): boolean => getZombieProtectedSeamForPath(relativePath) !== null;

export const isZombieProtectedRouteStepId = (stepId: string): boolean => getZombieProtectedSeamForRouteStepId(stepId) !== null;