import { existsSync, globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createFinding, selectLawId } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import type { GovernedFile } from "./code-purity-governed-files.js";

type StaticMode = "static.ast" | "static.config" | "static.filesystem" | "static.json" | "static.yaml";
const finding = (lawId: string, evidenceMode: StaticMode, filePath: string, checkId: string,
  message: string): InspectorFinding => createFinding({
  evidenceMode, lawId, clauseId: `${lawId.toLowerCase()}-mode-native`, filePath, checkId, message,
});
const readPackage = (context: InspectorContext): { scripts?: Record<string, unknown>; workspaces?: unknown } =>
  JSON.parse(readFileSync(resolve(context.sealedRoot, "package.json"), "utf8")) as {
    scripts?: Record<string, unknown>;
    workspaces?: unknown;
  };

export const scanOwnerAstRoles = (
  governedFiles: readonly GovernedFile[], lawIds: readonly string[],
): InspectorFinding[] => {
  const lawId = selectLawId(lawIds, "LAW-CODE-PURITY-002-V1");
  return governedFiles.filter((file) => file.owner === "unknown").map((file) => finding(
    lawId, "static.ast", file.repoPath, "code-purity/unowned-ast-role",
    `${file.repoPath} has no semantic Owner for its active syntax tree.`,
  ));
};

export const scanOwnerFilesystemAuthority = (
  governedFiles: readonly GovernedFile[], lawIds: readonly string[],
): InspectorFinding[] => {
  const lawId = selectLawId(lawIds, "LAW-CODE-PURITY-002-V1");
  const banned = ["bridge", "compatibility", "legacy", "shadow", "fallback", "planner", "workflow"];
  return governedFiles.flatMap((file) => {
    const token = banned.find((candidate) => file.repoPath.toLowerCase().split(/[/_.-]/u).includes(candidate));
    return file.owner === "unknown" || token ? [finding(
      lawId, "static.filesystem", file.repoPath, "code-purity/filesystem-owner-authority",
      file.owner === "unknown" ? `${file.repoPath} has no filesystem Owner.`
        : `${file.repoPath} retains banned second-path token ${token}.`,
    )] : [];
  });
};

export const scanOwnerConfiguration = (
  context: InspectorContext, lawIds: readonly string[],
): InspectorFinding[] => {
  const lawId = selectLawId(lawIds, "LAW-CODE-PURITY-002-V1");
  const pkg = readPackage(context);
  const findings: InspectorFinding[] = [];
  if (pkg.workspaces !== undefined) findings.push(finding(lawId, "static.config", "package.json",
    "code-purity/second-workspace-owner", "package.json must not declare a second workspace ownership root."));
  for (const [name, value] of Object.entries(pkg.scripts ?? {})) {
    if (typeof value !== "string" || !value.trim() || /(?:^|\s)\.\.\//u.test(value)) findings.push(finding(
      lawId, "static.config", "package.json", "code-purity/script-owner-boundary",
      `Script ${name} must remain a non-empty repository-local command.`,
    ));
  }
  return findings;
};

export const scanOwnerJsonAuthority = (
  context: InspectorContext, lawIds: readonly string[],
): InspectorFinding[] => {
  const lawId = selectLawId(lawIds, "LAW-CODE-PURITY-002-V1");
  const scripts = readPackage(context).scripts;
  if (!scripts || Array.isArray(scripts) || typeof scripts !== "object") return [finding(
    lawId, "static.json", "package.json", "code-purity/json-script-registry",
    "package.json scripts must remain one object-owned command registry.",
  )];
  return Object.entries(scripts).flatMap(([name, value]) => typeof value === "string"
    && !/(?:^|\s)(?:npm|pnpm)\s+(?:--prefix|--workspace)\b/u.test(value) ? [] : [finding(
      lawId, "static.json", "package.json", "code-purity/json-cross-owner-command",
      `Script ${name} must not route into a second package owner.`,
    )]);
};

export const scanOwnerYamlAuthority = (
  context: InspectorContext, lawIds: readonly string[],
): InspectorFinding[] => {
  const lawId = selectLawId(lawIds, "LAW-CODE-PURITY-002-V1");
  const repoPath = "pnpm-workspace.yaml";
  const source = readFileSync(resolve(context.sealedRoot, repoPath), "utf8");
  const topLevel = source.split(/\r?\n/u).filter((line) => /^[A-Za-z][A-Za-z0-9_-]*:/u.test(line))
    .map((line) => line.slice(0, line.indexOf(":")));
  return JSON.stringify(topLevel) === JSON.stringify(["allowBuilds"]) ? [] : [finding(
    lawId, "static.yaml", repoPath, "code-purity/yaml-workspace-authority",
    "pnpm-workspace.yaml may expose only the governed allowBuilds map and no second package root.",
  )];
};

const commandSourcePaths = (command: string): string[] => command.split(/\s+/u)
  .map((token) => token.replace(/^["']|["',]$/gu, ""))
  .filter((token) => /^(?:scripts|src)\/.+\.(?:[cm]?js|tsx?)$/u.test(token));

const configuredEntrypointExists = (root: string, repoPath: string): boolean =>
  repoPath.includes("*")
    ? globSync(repoPath, { cwd: root }).length > 0
    : existsSync(resolve(root, repoPath));

export const scanConfiguredEntrypointLiveness = (
  context: InspectorContext, lawIds: readonly string[],
): InspectorFinding[] => {
  const lawId = selectLawId(lawIds, "LAW-CODE-PURITY-003-V1");
  return Object.entries(readPackage(context).scripts ?? {}).flatMap(([name, value]) => {
    if (typeof value !== "string") return [finding(lawId, "static.config", "package.json",
      "code-purity/config-entrypoint-type", `Script ${name} has no executable string entrypoint.`)];
    return commandSourcePaths(value).filter((repoPath) => !configuredEntrypointExists(context.sealedRoot, repoPath))
      .map((repoPath) => finding(lawId, "static.config", "package.json",
        "code-purity/config-zombie-entrypoint", `Script ${name} points to missing source entrypoint ${repoPath}.`));
  });
};

export const scanJsonRegistryLiveness = (
  context: InspectorContext, lawIds: readonly string[],
): InspectorFinding[] => {
  const lawId = selectLawId(lawIds, "LAW-CODE-PURITY-003-V1");
  const scripts = readPackage(context).scripts ?? {};
  const required = new Map([
    ["quality:check", "scripts/audit/governance.ts"],
    ["acceptance:code-purity-zombie-deep", "scripts/acceptance/code-purity-zombie-deep.acceptance.ts"],
  ]);
  return [...required].flatMap(([name, target]) => typeof scripts[name] === "string"
    && scripts[name]!.includes(target) ? [] : [finding(lawId, "static.json", "package.json",
      "code-purity/json-live-registry", `Script registry entry ${name} must resolve directly to ${target}.`)]);
};
