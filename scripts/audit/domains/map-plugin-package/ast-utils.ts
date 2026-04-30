import type { Project, SourceFile } from "ts-morph";

import type { MapPackage } from "../../../../src/map-plugins/shared/map-package-types.js";
import { MapPackageSchema } from "../../../../src/map-plugins/schema/map-plugin-package.schema.js";
import { validateMapPackage } from "../../../../src/map-plugins/validation/map-package-validator.js";
import { createAuditProject, getSourceFileOrThrow } from "../_shared/ast-helpers.js";
import { fileExists, listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";

export const ROOT = "src/map-plugins";
export const BUILTINS_ROOT = `${ROOT}/builtins`;
export const AUDIT_ROOT = "scripts/audit/domains/map-plugin-package";
export const INSPECTOR_PATH = `${AUDIT_ROOT}/inspector.ts`;
export const SCORECARD_PATH = "docs/audit/map-plugin-package-scorecard.md";

export const BUILTIN_PACKAGE_FILES = [
  `${BUILTINS_ROOT}/tiktok-product-discovery.map-package.json`,
  `${BUILTINS_ROOT}/tiktok-comment-evidence.map-package.json`,
  `${BUILTINS_ROOT}/ai-draft-map-placeholder.map-package.json`,
] as const;

export const REQUIRED_SOURCE_FILES = [
  `${ROOT}/builtins/index.ts`,
  `${ROOT}/import/map-package-importer.ts`,
  `${ROOT}/import/map-package-activation.ts`,
  `${ROOT}/import/map-package-rollback.ts`,
  `${ROOT}/registry/active-map-registry.ts`,
  `${ROOT}/registry/map-plugin-registry.ts`,
  `${ROOT}/registry/quarantined-map-registry.ts`,
  `${ROOT}/registry/map-version-store.ts`,
  `${ROOT}/schema/map-plugin-package.schema.ts`,
  `${ROOT}/validation/map-package-validator.ts`,
  `${ROOT}/validation/map-security-validator.ts`,
  ...BUILTIN_PACKAGE_FILES,
] as const;

export const REQUIRED_AUDIT_FILES = [
  `${AUDIT_ROOT}/ast-utils.ts`,
  `${AUDIT_ROOT}/required-shape.ts`,
  `${AUDIT_ROOT}/forbidden-shape.ts`,
  `${AUDIT_ROOT}/boundary-attack.ts`,
  `${AUDIT_ROOT}/anti-escape.ts`,
  `${AUDIT_ROOT}/negative-proof-harness.ts`,
  `${AUDIT_ROOT}/scorecard-gate.ts`,
  `${AUDIT_ROOT}/run-inspector.ts`,
  INSPECTOR_PATH,
] as const;

export type BuiltinPackageRecord = {
  file: string;
  text: string;
  raw: unknown;
  mapPackage: MapPackage | null;
  parseError: string | null;
  validationIssues: ReturnType<typeof validateMapPackage>["issues"];
};

export function createMapPluginAuditProject(): Project {
  return createAuditProject();
}

export function getSource(project: Project, repoRelativePath: string): SourceFile {
  return getSourceFileOrThrow(project, repoRelativePath);
}

export async function missingFiles(paths: readonly string[]): Promise<string[]> {
  const states = await Promise.all(paths.map(async (filePath) => ({ filePath, exists: await fileExists(pathFromRepoRoot(filePath)) })));
  return states.filter((state) => !state.exists).map((state) => state.filePath);
}

export async function loadBuiltinPackageRecords(): Promise<BuiltinPackageRecord[]> {
  const records: BuiltinPackageRecord[] = [];

  for (const file of BUILTIN_PACKAGE_FILES) {
    const text = await readTextFile(pathFromRepoRoot(file));
    let raw: unknown = null;
    let parseError: string | null = null;
    let mapPackage: MapPackage | null = null;

    try {
      raw = JSON.parse(text) as unknown;
      const parsed = MapPackageSchema.safeParse(raw);
      if (parsed.success) {
        mapPackage = parsed.data;
      } else {
        parseError = parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ");
      }
    } catch (error) {
      parseError = error instanceof Error ? error.message : "JSON parse failed";
    }

    records.push({
      file,
      text,
      raw,
      mapPackage,
      parseError,
      validationIssues: raw === null ? [] : validateMapPackage(raw).issues,
    });
  }

  return records;
}

export async function listMapPluginFiles(): Promise<string[]> {
  const files = await listFilesRecursive(pathFromRepoRoot(ROOT), { extensions: [".ts", ".json"] });
  return files.map((filePath) => toRepoRelativePath(filePath));
}

export const LEGACY_MAP_IDS = [
  "product-video-detection",
  "browse-next-video",
  "comment-evidence",
  "recovery",
  "human-review",
] as const;
