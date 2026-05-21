import { fileURLToPath } from "node:url";
import { relative, resolve } from "node:path";

const currentFile = fileURLToPath(import.meta.url);

export const repoRoot = resolve(currentFile, "../../../..");
export const auditRoot = resolve(repoRoot, "scripts/audit");
export const generatedDir = resolve(auditRoot, "generated");
export const lawModulesDir = resolve(repoRoot, ".github/instructions/agent-rules/modules");

export const toRepoPath = (absolutePath: string): string =>
  relative(repoRoot, absolutePath).split("\\").join("/");

export const resolveFromRepo = (...segments: readonly string[]): string =>
  resolve(repoRoot, ...segments);