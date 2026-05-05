import type { Project, SourceFile } from "ts-morph";

import { validateMapPackage } from "../../../../src/map-plugins/validation/map-package-validator.js";
import { createAuditProject, getSourceFileOrThrow } from "../_shared/ast-helpers.js";
import { fileExists, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";

export const AUDIT_ROOT = "scripts/audit/domains/map-prompt-contract";
export const INSPECTOR_PATH = `${AUDIT_ROOT}/inspector.ts`;

export const REQUIRED_SOURCE_FILES = [
  "src/capabilities/ai/prompt-contracts/schema.ts",
  "src/capabilities/ai/prompt-contracts/registry.ts",
  "src/map-plugins/schema/prompt-bindings.schema.ts",
  "src/map-plugins/schema/map-plugin-manifest.schema.ts",
  "src/map-plugins/validation/map-prompt-contract-validator.ts",
  "src/map-plugins/validation/map-security-validator.ts",
  "src/map-plugins/authoring/capability-catalog/schema.ts",
  "src/map-plugins/authoring/capability-catalog/build-capability-catalog.ts",
  "src/map-plugins/authoring/capability-catalog/capability-catalog.generated.json",
  "src/map-plugins/authoring/map-authoring-request.schema.ts",
  "src/map-plugins/authoring/map-authoring-response.schema.ts",
  "src/map-plugins/authoring/map-authoring-template.ts",
  "src/map-plugins/authoring/map-authoring-prompt-builder.ts",
  "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
  "src/map-plugins/builtins/facebook-seeding-video-discovery.meta.map-package.json",
] as const;

export function createMapPromptContractAuditProject(): Project {
  return createAuditProject();
}

export function getSource(project: Project, repoRelativePath: string): SourceFile {
  return getSourceFileOrThrow(project, repoRelativePath);
}

export async function findMissingFiles(): Promise<string[]> {
  const states = await Promise.all(
    REQUIRED_SOURCE_FILES.map(async (repoRelativePath) => ({
      repoRelativePath,
      exists: await fileExists(pathFromRepoRoot(repoRelativePath)),
    })),
  );
  return states.filter((state) => !state.exists).map((state) => state.repoRelativePath);
}

export async function loadBuiltinPackage(repoRelativePath: string): Promise<{ raw: unknown; text: string; issues: ReturnType<typeof validateMapPackage>["issues"]; mapPackage: ReturnType<typeof validateMapPackage>["mapPackage"] }> {
  const text = await readTextFile(pathFromRepoRoot(repoRelativePath));
  const raw: unknown = JSON.parse(text);
  const result = validateMapPackage(raw);
  return {
    raw,
    text,
    issues: result.issues,
    mapPackage: result.mapPackage,
  };
}