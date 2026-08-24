import { existsSync, readFileSync } from "node:fs";

import { SyntaxKind } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { pathSegments } from "../../../shared/no-regex.js";
import { resolveFromRepo } from "../../../shared/paths.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../../shared/source-files.js";
import { collectResolvedModuleTargets } from "../../../shared/source-module-targets.js";

export const architectureLawPath = ".github/instructions/agent-rules/基础法案.md";

export type ActivePluginContract = Readonly<{
  pluginId: string;
  status: "active";
  owner: string;
  phase: string;
  mediatorRoute: string;
  mediatorBindings: readonly Readonly<{
    routeExport: string;
    schemaExport: string;
    taskExport: string;
  }>[];
  allowedEntrypoints: readonly string[];
  allowedAcceptanceTests: readonly string[];
  allowedNpmScripts: readonly string[];
  exposureTokens: readonly string[];
  lawSourceRefs: readonly string[];
}>;

type PluginExposureSummary = {
  actualPluginIds: string[];
  governedAcceptanceScripts: string[];
  exposureFilesByPluginId: Record<string, string[]>;
  findings: InspectorFinding[];
  activeContracts: ActivePluginContract[];
};

const activePluginContracts: ActivePluginContract[] = [{
  pluginId: "xuanxue-ai-production",
  status: "active",
  owner: "xuanxue-ai-production",
  phase: "production",
  mediatorRoute: "src/mediator/xuanxue-ai-production-route.ts",
  mediatorBindings: [{
    routeExport: "runXuanxueAiProductionRoute",
    schemaExport: "XuanxueAiProductionOrderSchema",
    taskExport: "createXuanxueAiProductionOrder",
  }],
  allowedEntrypoints: [
    "src/app/workbench-xuanxue-ai-production-routes.ts",
    "src/lib/local-runtime/workbench-handle.ts",
    "src/lib/local-runtime/workbench-xuanxue-ai-production-handle.ts",
    "src/lib/local-runtime/workbench.ts",
    "src/mediator/xuanxue-ai-production-route.ts",
  ],
  allowedAcceptanceTests: ["acceptance:xuanxue-ai-production"],
  allowedNpmScripts: ["audit:xuanxue-ai-production:enforce"],
  exposureTokens: ["xuanxue-ai-production"],
  lawSourceRefs: [architectureLawPath],
}];

const isRouteExposurePath = (repoPath: string): boolean => {
  const segments = pathSegments(repoPath);
  return segments[0] === "src" && segments[1] === "app" && (segments.at(-1)?.endsWith("-routes.ts") ?? false);
};

const resolvePluginIdFromRepoPath = (repoPath: string): string | undefined => {
  if (!repoPath.startsWith("src/plugins/")) return undefined;
  const segments = repoPath.split("/");
  return segments.length >= 3 ? segments[2] : undefined;
};

const readPackageScripts = (): Record<string, string> => {
  const parsed = JSON.parse(readFileSync(resolveFromRepo("package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  return parsed.scripts ?? {};
};

const collectActualPluginIds = (project: Parameters<typeof listActiveSourceFiles>[0]): string[] => {
  const pluginIds = new Set<string>();
  for (const sourceFile of listActiveSourceFiles(project)) {
    const pluginId = resolvePluginIdFromRepoPath(getRepoSourcePath(sourceFile));
    if (pluginId) pluginIds.add(pluginId);
  }
  return [...pluginIds].sort();
};

const collectExposureFilesByPluginId = (
  project: Parameters<typeof listActiveSourceFiles>[0],
  entries: readonly ActivePluginContract[],
): Record<string, string[]> => {
  const exposures = new Map(entries.map((entry) => [entry.pluginId, new Set<string>()]));
  for (const sourceFile of listActiveSourceFiles(project)) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (repoPath.startsWith("src/app/")
      || repoPath.startsWith("src/lib/local-runtime/")
      || repoPath.startsWith("src/mediator/")) {
      for (const target of collectResolvedModuleTargets(sourceFile)) {
        const pluginId = resolvePluginIdFromRepoPath(target.targetPath);
        if (pluginId) exposures.get(pluginId)?.add(repoPath);
      }
    }
    if (!isRouteExposurePath(repoPath)) continue;
    const literals = [
      ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue()),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((literal) => literal.getLiteralValue()),
    ];
    for (const entry of entries) {
      if (entry.exposureTokens.some((token) => literals.some((value) => value.includes(token)))) {
        exposures.get(entry.pluginId)?.add(repoPath);
      }
    }
  }
  return Object.fromEntries(
    [...exposures.entries()].map(([pluginId, files]) => [pluginId, [...files].sort()]),
  );
};

const pushFinding = (
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  checkId: string,
  message: string,
  evidence?: string,
): void => {
  findings.push(createFinding({ checkId, lawId, filePath, evidence, message }));
};

const inspectActiveContracts = (input: {
  actualPluginIds: readonly string[];
  entries: readonly ActivePluginContract[];
  exposureFilesByPluginId: Readonly<Record<string, string[]>>;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
  packageScripts: Readonly<Record<string, string>> | null;
}): void => {
  const expectedIds = new Set(input.entries.map((entry) => entry.pluginId));
  for (const pluginId of input.actualPluginIds) {
    if (expectedIds.has(pluginId)) continue;
    pushFinding(input.findings, input.lawId, `src/plugins/${pluginId}`, "architecture/second-active-plugin",
      `Only xuanxue-ai-production may remain as an active business plugin; found ${pluginId}.`, pluginId);
  }
  for (const entry of input.entries) {
    for (const lawSourceRef of entry.lawSourceRefs) {
      input.inspectedFiles.add(lawSourceRef);
      if (!existsSync(resolveFromRepo(lawSourceRef))) {
        pushFinding(input.findings, input.lawId, lawSourceRef, "architecture/plugin-law-source-missing",
          `Active plugin ${entry.pluginId} references missing law source ${lawSourceRef}.`);
      }
    }
    if (!input.actualPluginIds.includes(entry.pluginId)) {
      pushFinding(input.findings, input.lawId, `src/plugins/${entry.pluginId}`, "architecture/active-plugin-root-missing",
        `The sole active plugin ${entry.pluginId} is missing.`);
    }
    for (const npmScript of input.packageScripts ? [...entry.allowedAcceptanceTests, ...entry.allowedNpmScripts] : []) {
      if (input.packageScripts?.[npmScript] === undefined) {
        pushFinding(input.findings, input.lawId, "package.json", "architecture/plugin-script-missing",
          `Active plugin ${entry.pluginId} requires npm script ${npmScript}.`, npmScript);
      }
    }
    for (const exposureFile of input.exposureFilesByPluginId[entry.pluginId] ?? []) {
      input.inspectedFiles.add(exposureFile);
      if (!entry.allowedEntrypoints.includes(exposureFile)) {
        pushFinding(input.findings, input.lawId, exposureFile, "architecture/plugin-entry-not-authorized",
          `${exposureFile} exposes ${entry.pluginId} outside its current single-line architecture.`, entry.pluginId);
      }
    }
  }
};

export const inspectActivePluginGate = (input: {
  lawId: string;
  project: Parameters<typeof listActiveSourceFiles>[0];
  inspectedFiles: Set<string>;
  targetPaths: readonly string[];
}): PluginExposureSummary => {
  const findings: InspectorFinding[] = [];
  const entries = [...activePluginContracts];
  const packageScripts = input.targetPaths.includes("package.json") ? readPackageScripts() : null;
  if(packageScripts)input.inspectedFiles.add("package.json");
  const actualPluginIds = collectActualPluginIds(input.project);
  const exposureFilesByPluginId = collectExposureFilesByPluginId(input.project, entries);
  inspectActiveContracts({
    actualPluginIds,
    entries,
    exposureFilesByPluginId,
    findings,
    inspectedFiles: input.inspectedFiles,
    lawId: input.lawId,
    packageScripts,
  });
  const governedAcceptanceScripts = entries.flatMap((entry) => entry.allowedAcceptanceTests)
    .filter((scriptName) => packageScripts?.[scriptName] !== undefined)
    .sort();
  return {
    actualPluginIds,
    governedAcceptanceScripts,
    exposureFilesByPluginId,
    findings,
    activeContracts: entries,
  };
};
