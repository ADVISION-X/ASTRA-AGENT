import type { Project, SourceFile } from "ts-morph";

import { getDefaultMapPluginRegistry } from "../../../../src/map-plugins/registry/map-plugin-registry.js";
import { createAuditProject, getSourceFileOrThrow } from "../_shared/ast-helpers.js";
import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";

export const AUDIT_ROOT = "scripts/audit/domains/map-plugin-orchestration-integration";
export const INSPECTOR_PATH = `${AUDIT_ROOT}/inspector.ts`;
export const SCORECARD_PATH = "docs/audit/map-plugin-orchestration-integration-scorecard.md";

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
  "src/app/task-api-handlers.ts"
] as const;

export const REQUIRED_AUDIT_FILES = [
  `${AUDIT_ROOT}/ast-utils.ts`,
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

export function createIntegrationAuditProject(): Project {
  return createAuditProject();
}

export function getSource(project: Project, repoRelativePath: string): SourceFile {
  return getSourceFileOrThrow(project, repoRelativePath);
}

export async function missingFiles(paths: readonly string[]): Promise<string[]> {
  const states = await Promise.all(paths.map(async (filePath) => ({ filePath, exists: await fileExists(pathFromRepoRoot(filePath)) })));
  return states.filter((state) => !state.exists).map((state) => state.filePath);
}

export function createBootstrappedRegistry() {
  return getDefaultMapPluginRegistry();
}
