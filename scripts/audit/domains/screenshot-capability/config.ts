export const LAW_IDS = {
  PUBLIC: "GRASSEYE-SCREENSHOT-CAPABILITY-001-V1",
  BOUNDARY: "GRASSEYE-SCREENSHOT-CAPABILITY-002-V1",
  SCHEMA: "GRASSEYE-SCREENSHOT-CAPABILITY-003-V1",
  SHAPE: "GRASSEYE-SCREENSHOT-CAPABILITY-004-V1",
} as const;

export const PATHS = {
  ROOT: "src/capabilities/screenshot",
  AUDIT_ROOT: "scripts/audit/domains/screenshot-capability",
  ABILITY_GROUP: "src/capabilities/screenshot/ability-group.ts",
  CONTRACT: "src/capabilities/screenshot/contract.ts",
  SCHEMA: "src/capabilities/screenshot/schema.ts",
  REGISTRY: "src/capabilities/screenshot/registry.ts",
  INDEX: "src/capabilities/screenshot/index.ts",
  EXECUTOR: "src/capabilities/screenshot/runtime/screenshot-executor.ts",
  CAPTURE_RUNNER: "src/capabilities/screenshot/runtime/capture-runner.ts",
  OUTPUT_BOUNDARY_GATE: "src/capabilities/screenshot/runtime/screenshot-output-boundary-gate.ts",
  PROOF_BUILDER: "src/capabilities/screenshot/runtime/screenshot-proof-builder.ts",
  RESULT_BUILDER: "src/capabilities/screenshot/runtime/screenshot-result-builder.ts",
  DISPATCH_FAILURE: "src/capabilities/screenshot/runtime/screenshot-dispatch-failure.ts",
} as const;

export const CHILDREN = [
  "capture-browser-viewport",
  "capture-desktop-screen",
  "capture-region",
  "optimize-lossless",
  "prepare-ai-input",
] as const;

export const CANONICAL_FILES = [
  `${PATHS.ROOT}/ability-group.ts`,
  `${PATHS.ROOT}/contract.ts`,
  `${PATHS.ROOT}/schema.ts`,
  `${PATHS.ROOT}/registry.ts`,
  `${PATHS.ROOT}/index.ts`,
  `${PATHS.ROOT}/adapters/index.ts`,
  `${PATHS.ROOT}/runtime/screenshot-executor.ts`,
  `${PATHS.ROOT}/runtime/screenshot-runtime-context.ts`,
  `${PATHS.ROOT}/runtime/screenshot-child-contract.ts`,
  `${PATHS.ROOT}/runtime/screenshot-input-gate.ts`,
  `${PATHS.ROOT}/runtime/screenshot-payload-budget-gate.ts`,
  `${PATHS.ROOT}/runtime/screenshot-source-gate.ts`,
  `${PATHS.ROOT}/runtime/browser-session-gate.ts`,
  `${PATHS.ROOT}/runtime/page-state-handoff-gate.ts`,
  `${PATHS.ROOT}/runtime/privacy-policy-gate.ts`,
  `${PATHS.ROOT}/runtime/region-proof-gate.ts`,
  `${PATHS.ROOT}/runtime/capture-runner.ts`,
  `${PATHS.ROOT}/runtime/image-processing-runner.ts`,
  `${PATHS.ROOT}/runtime/artifact-storage-gate.ts`,
  `${PATHS.ROOT}/runtime/screenshot-output-boundary-gate.ts`,
  `${PATHS.ROOT}/runtime/screenshot-result-builder.ts`,
  `${PATHS.ROOT}/runtime/screenshot-proof-builder.ts`,
  `${PATHS.ROOT}/runtime/screenshot-dispatch-failure.ts`,
  `${PATHS.ROOT}/runtime/screenshot-idempotency.ts`,
  `${PATHS.ROOT}/runtime/screenshot-clock.ts`,
  `${PATHS.ROOT}/ports/screenshot-capture-port.ts`,
  `${PATHS.ROOT}/ports/screenshot-artifact-port.ts`,
  `${PATHS.ROOT}/ports/screenshot-clock-port.ts`,
  `${PATHS.ROOT}/ports/screenshot-image-processing-port.ts`,
  `${PATHS.ROOT}/shared/screenshot-types.ts`,
  `${PATHS.ROOT}/shared/screenshot-policy.ts`,
  `${PATHS.ROOT}/shared/screenshot-result.ts`,
  `${PATHS.ROOT}/shared/screenshot-proof.ts`,
  `${PATHS.ROOT}/shared/screenshot-failure.ts`,
  `${PATHS.ROOT}/shared/screenshot-artifact.ts`,
  `${PATHS.ROOT}/shared/screenshot-scale-mapping.ts`,
] as const;

export const PUBLIC_INDEX_ALLOWED_SPECIFIERS = ["./ability-group.js", "./contract.js", "./schema.js", "./registry.js"] as const;

export const FORBIDDEN_CAPABILITY_MARKERS = [
  "/capabilities/ai/",
  "/capabilities/mouse-click/",
  "/capabilities/mouse-scroll/",
  "/capabilities/geometry-guard/",
  "/capabilities/forensics-persistence/",
  "/capabilities/open/children/",
  "/capabilities/open/runtime/",
] as const;