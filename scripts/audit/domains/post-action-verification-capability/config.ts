export const LAW_IDS = {
  PUBLIC: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V2",
  BOUNDARY: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-002-V2",
  SCHEMA: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V2",
  SHAPE: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V2",
  RESULT: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-005-V2",
  PROOF: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-006-V2",
  CHILDREN: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-007-V2",
  PACKAGE: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-008-V2",
} as const;

export const PATHS = {
  ROOT: "src/capabilities/post-action-verification",
  ABILITY_GROUP: "src/capabilities/post-action-verification/ability-group.ts",
  CONTRACT: "src/capabilities/post-action-verification/contract.ts",
  SCHEMA: "src/capabilities/post-action-verification/schema.ts",
  DECISION_GATE: "src/capabilities/post-action-verification/runtime/post-action-decision-gate.ts",
  REGISTRY: "src/capabilities/post-action-verification/registry.ts",
  EXECUTOR: "src/capabilities/post-action-verification/runtime/post-action-verification-executor.ts",
  RUNTIME_CONTEXT: "src/capabilities/post-action-verification/runtime/post-action-verification-runtime-context.ts",
  RESULT_BUILDER: "src/capabilities/post-action-verification/runtime/post-action-result-builders.ts",
  PROOF_BUILDER: "src/capabilities/post-action-verification/runtime/post-action-runtime-proof-builder.ts",
  OBSERVATION_CHILD: "src/capabilities/post-action-verification/children/post-action-observation-child.ts",
  CLOCK: "src/capabilities/post-action-verification/ports/post-action-verification-clock-port.ts",
} as const;

export const CHILDREN = [
  "observe-page-open-attempt",
  "observe-comments-panel-open-attempt",
  "observe-comments-panel-close-attempt",
  "observe-not-interested-attempt",
  "observe-target-state-transition",
  "verify-action-result",
] as const;

export const CANONICAL_FILES = [
  PATHS.ABILITY_GROUP,
  PATHS.CONTRACT,
  PATHS.SCHEMA,
  PATHS.REGISTRY,
  `${PATHS.ROOT}/index.ts`,
  PATHS.DECISION_GATE,
  PATHS.EXECUTOR,
  PATHS.RUNTIME_CONTEXT,
  PATHS.RESULT_BUILDER,
  PATHS.PROOF_BUILDER,
  PATHS.OBSERVATION_CHILD,
  `${PATHS.ROOT}/ports/post-action-evidence-read-port.ts`,
  `${PATHS.ROOT}/ports/post-action-verification-clock-port.ts`,
  `${PATHS.ROOT}/shared/post-action-evidence.ts`,
  `${PATHS.ROOT}/shared/post-action-observation.ts`,
  `${PATHS.ROOT}/shared/post-action-policy.ts`,
  `${PATHS.ROOT}/shared/post-action-proof.ts`,
  `${PATHS.ROOT}/shared/post-action-result.ts`,
  `${PATHS.ROOT}/shared/post-action-types.ts`,
  `${PATHS.ROOT}/shared/post-action-url.ts`,
] as const;
