export const ROOT = "src/capabilities/page-state";
export const AUDIT_ROOT = "scripts/audit/domains/page-state-capability";

export const CHILDREN = [
  "observe-login-surface",
  "observe-safety-surface",
  "observe-feed-surface",
  "observe-video-surface",
  "observe-comment-panel-surface",
  "observe-modal-overlay-surface",
  "observe-page-abnormality-surface",
  "observe-platform-surface",
] as const;

export const CANONICAL_FILES = [
  `${ROOT}/ability-group.ts`,
  `${ROOT}/contract.ts`,
  `${ROOT}/schema.ts`,
  `${ROOT}/registry.ts`,
  `${ROOT}/index.ts`,
  `${ROOT}/runtime/page-state-child-contract.ts`,
  `${ROOT}/runtime/page-state-clock.ts`,
  `${ROOT}/runtime/page-state-executor.ts`,
  `${ROOT}/runtime/page-state-runtime-context.ts`,
  `${ROOT}/runtime/page-state-result-builders.ts`,
  `${ROOT}/runtime/page-state-runtime-proof-builder.ts`,
  `${ROOT}/children/page-state-observation-child.ts`,
  `${ROOT}/ports/page-state-clock-port.ts`,
  `${ROOT}/ports/page-state-profile-port.ts`,
  `${ROOT}/shared/page-state-observation.ts`,
  `${ROOT}/shared/page-state-profile.ts`,
  `${ROOT}/shared/page-state-types.ts`,
] as const;