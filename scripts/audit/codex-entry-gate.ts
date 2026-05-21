import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot, resolveFromRepo } from "./shared/paths.js";

type GateFailure = {
  readonly path: string;
  readonly reason: string;
};

const requiredFiles = [
  "AGENTS.md",
  ".github/instructions/agent-rules/grasseye-index.instructions.md",
  ".github/instructions/agent-rules/GRASSEYE-KERNEL.instructions.md",
  ".github/instructions/agent-rules/modules/module-audit-system.instructions.md",
  ".github/instructions/agent-rules/modules/module-code-purity.instructions.md",
  ".github/instructions/agent-rules/modules/module-architecture-boundary.instructions.md",
  ".github/instructions/agent-rules/modules/module-type-safety.instructions.md",
  "scripts/audit/ci-full.ts",
  "scripts/audit/build-audit-artifacts.ts",
  "scripts/audit/core/run-generated-plan.ts",
  "scripts/audit/generated/law-registry.generated.json",
  "docs/法案辅助文件/GrassEye 执法系统施工图.md",
] as const;

const assertReadableFile = (repoPath: string): GateFailure | undefined => {
  const absolutePath = resolveFromRepo(repoPath);
  if (!existsSync(absolutePath)) {
    return { path: repoPath, reason: "missing" };
  }
  if (!statSync(absolutePath).isFile()) {
    return { path: repoPath, reason: "not a file" };
  }
  if (readFileSync(absolutePath, "utf8").trim().length === 0) {
    return { path: repoPath, reason: "empty" };
  }
  return undefined;
};

const listMarkdownFiles = (repoPath: string): string[] => {
  const absolutePath = resolveFromRepo(repoPath);
  if (!existsSync(absolutePath)) {
    return [];
  }
  return readdirSync(absolutePath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => resolve(absolutePath, entry.name));
};

const readJson = (repoPath: string): unknown => {
  const text = readFileSync(resolveFromRepo(repoPath), "utf8");
  return JSON.parse(text);
};

const hasNonEmptyArray = (value: unknown, key: string): boolean =>
  typeof value === "object" &&
  value !== null &&
  key in value &&
  Array.isArray((value as Record<string, unknown>)[key]) &&
  ((value as Record<string, unknown>)[key] as unknown[]).length > 0;

const collectFailures = (): GateFailure[] => {
  const failures = requiredFiles
    .map((repoPath) => assertReadableFile(repoPath))
    .filter((failure): failure is GateFailure => failure !== undefined);

  const moduleFiles = listMarkdownFiles(".github/instructions/agent-rules/modules");
  if (moduleFiles.length === 0) {
    failures.push({
      path: ".github/instructions/agent-rules/modules",
      reason: "no law module markdown files found",
    });
  }

  const blueprintFiles = listMarkdownFiles("docs/法案辅助文件");
  if (blueprintFiles.length === 0) {
    failures.push({
      path: "docs/法案辅助文件",
      reason: "no construction blueprint markdown files found",
    });
  }

  try {
    const registry = readJson("scripts/audit/generated/law-registry.generated.json");
    if (!hasNonEmptyArray(registry, "laws")) {
      failures.push({
        path: "scripts/audit/generated/law-registry.generated.json",
        reason: "registry has no laws array",
      });
    }
  } catch (error) {
    failures.push({
      path: "scripts/audit/generated/law-registry.generated.json",
      reason: error instanceof Error ? error.message : "invalid JSON",
    });
  }

  return failures;
};

const main = (): void => {
  const failures = collectFailures();
  if (failures.length > 0) {
    process.stderr.write("[CODEX-ENTRY-GATE][FAIL]\n");
    for (const failure of failures) {
      process.stderr.write(`- ${failure.path}: ${failure.reason}\n`);
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write("[CODEX-ENTRY-GATE][PASS]\n");
  process.stdout.write(`- repo: ${repoRoot}\n`);
  process.stdout.write("- law system, audit system, and construction blueprints are discoverable.\n");
};

main();
