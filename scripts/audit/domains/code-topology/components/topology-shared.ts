import path from "node:path";

import { fileExists, readTextFile } from "../../../core/filesystem.js";
import { pathFromRepoRoot } from "../../../core/paths.js";
import { toRelativeSourcePath } from "../../../core/ts-morph.js";
import type { SourceFile } from "ts-morph";

const LAW_ID_001 = "GRASSEYE-CODE-TOPOLOGY-001-V1";
const LAW_ID_002 = "GRASSEYE-CODE-TOPOLOGY-002-V1";
const LAW_ID_003 = "GRASSEYE-CODE-TOPOLOGY-003-V1";

const REQUIRED_DOC_PATHS = ["docs/阶段目标", "docs/TODO", "docs/Codex提示词", "docs/验收报告", "docs/归档", "docs/法案辅助文件"] as const;
const ALLOWED_DOC_DIRS = new Set(["Codex提示词", "TODO", "归档", "法案辅助文件", "阶段目标", "项目方案", "验收报告"]);
const ALLOWED_SRC_DIRS = new Set(["app", "capabilities", "features", "lib", "types"]);
const ALLOWED_FEATURE_DIRS = new Set(["comments", "product-signal", "vision"]);
const ALLOWED_LIB_DIRS = new Set(["browser", "local-ai", "local-app-shell", "local-runtime", "localization", "storage"]);
const FORBIDDEN_PLATFORM_ROOTS = new Set(["facebook", "tiktok", "social"]);
const FORBIDDEN_FUTURE_DIRS = new Set(["ads", "procurement", "supplier", "crm", "account-systems", "accounts"]);
const RUNTIME_DIRS = new Set(["screenshots", "ocr-dumps", "evidence-db", "cookies", "sessions", ".grasseye-data"]);
const STARTUP_ENTRY_PATH = "scripts/startup/launch-grasseye.mjs";
const STARTUP_HELPER_PATHS = [
  "scripts/startup/lib/dependency-check.mjs",
  "scripts/startup/lib/process-control.mjs",
  "scripts/startup/lib/health-check.mjs",
  "scripts/startup/lib/open-commander-console.mjs",
] as const;
const FORBIDDEN_STARTUP_FILENAMES = new Set(["start.sh", "run.sh", "fix-and-start.sh"]);
const ILLEGAL_LOCAL_RUNTIME_EXECUTION_FILES = new Set(["runtime-executor.ts", "runtime-bootstrap.ts", "runtime-state.ts", "runtime-step-support.ts"]);

const toLower = (value: string): string => value.toLowerCase();

function isScatteredPhaseArtifact(fileName: string): boolean {
  const normalized = toLower(fileName);
  return normalized.endsWith(".md") && ["phase", "todo", "codex", "acceptance", "report", "prompt"].some((keyword) => normalized.includes(keyword));
}

function isForbiddenTargetPath(relativePath: string | undefined, prefixes: string[]): boolean {
  return Boolean(relativePath && prefixes.some((prefix) => relativePath.startsWith(prefix)));
}

function resolveImportTarget(moduleSpecifierSourceFile: SourceFile | undefined): string | undefined {
  return moduleSpecifierSourceFile ? toRelativeSourcePath(moduleSpecifierSourceFile) : undefined;
}

function createDetail(detail: string | undefined): { detail?: string } {
  return detail ? { detail } : {};
}

async function isGitignoredRuntimeDir(relativePath: string): Promise<boolean> {
  const gitignorePath = pathFromRepoRoot(".gitignore");
  if (!(await fileExists(gitignorePath))) {
    return false;
  }

  const gitignoreText = await readTextFile(gitignorePath);
  const normalizedEntries = gitignoreText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => line.replace(/\/$/, ""));

  return normalizedEntries.includes(relativePath.replace(/\/$/, ""));
}

export const codeTopologyShared = {
  LAW_ID_001,
  LAW_ID_002,
  LAW_ID_003,
  REQUIRED_DOC_PATHS,
  ALLOWED_DOC_DIRS,
  ALLOWED_SRC_DIRS,
  ALLOWED_FEATURE_DIRS,
  ALLOWED_LIB_DIRS,
  FORBIDDEN_PLATFORM_ROOTS,
  FORBIDDEN_FUTURE_DIRS,
  RUNTIME_DIRS,
  STARTUP_ENTRY_PATH,
  STARTUP_HELPER_PATHS,
  FORBIDDEN_STARTUP_FILENAMES,
  ILLEGAL_LOCAL_RUNTIME_EXECUTION_FILES,
  isScatteredPhaseArtifact,
  isForbiddenTargetPath,
  resolveImportTarget,
  createDetail,
  isGitignoredRuntimeDir,
  path,
} as const;