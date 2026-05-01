import { AUDIT_ROOT, INSPECTOR_PATH, SCORECARD_PATH } from "./constants.js";

export const REQUIRED_SOURCE_FILES = [
  "src/map-plugins/schema/platform-id.schema.ts",
  "src/map-plugins/schema/operational-map-core.schema.ts",
  "src/map-plugins/schema/task-template-package.schema.ts",
  "src/map-plugins/schema/operational-map-package.schema.ts",
  "src/map-plugins/shared/map-package-types.ts",
  "src/map-plugins/registry/active-map-registry.ts",
  "src/map-plugins/validation/map-capability-registry-validator.ts",
  "src/map-plugins/validation/map-dry-run-validator.ts",
  "src/capabilities/orchestration/schema.ts",
  "src/capabilities/orchestration/ports/orchestration-map-store-port.ts",
  "src/capabilities/orchestration/runtime/orchestration-runtime-context.ts",
  "src/capabilities/orchestration/runtime/map-selection-gate.ts",
  "src/capabilities/orchestration/runtime/orchestration-proof-builder.ts",
  "src/capabilities/orchestration/runtime/orchestration-dispatch-failure.ts",
  "src/capabilities/orchestration/runtime/orchestration-executor.ts",
  "src/features/commander-console/types.ts",
  "src/features/commander-console/task-template-registry.ts",
  "src/features/commander-console/commander-console-view-model.ts",
  "src/features/commander-console/view-helpers.ts",
  "src/features/commander-console/modules/command/AdvancedFields.ts",
  "src/features/commander-console/pages/DeveloperPage.ts",
  "src/features/commander-console/commander-console-shell-client.ts",
  "src/app/task-api-handlers.ts",
] as const;

export const REQUIRED_AUDIT_FILES = [
  `${AUDIT_ROOT}/required-shape.ts`,
  `${AUDIT_ROOT}/forbidden-shape.ts`,
  `${AUDIT_ROOT}/boundary-attack.ts`,
  `${AUDIT_ROOT}/anti-escape.ts`,
  `${AUDIT_ROOT}/negative-proof-harness.ts`,
  `${AUDIT_ROOT}/inspector.ts`,
  `${AUDIT_ROOT}/run-inspector.ts`,
  SCORECARD_PATH,
] as const;

export const LEGACY_STATIC_MAP_FILES = [
  "src/capabilities/orchestration/maps/human-review/map.ts",
  "src/capabilities/orchestration/maps/product-video-detection/map.ts",
  "src/capabilities/orchestration/maps/recovery/map.ts",
  "src/capabilities/orchestration/maps/comment-evidence/map.ts",
  "src/capabilities/orchestration/maps/browse-next-video/map.ts",
] as const;