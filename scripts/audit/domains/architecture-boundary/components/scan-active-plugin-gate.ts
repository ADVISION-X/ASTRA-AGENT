import { existsSync, readFileSync } from "node:fs";

import { SyntaxKind } from "ts-morph";
import { z } from "zod";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { pathSegments } from "../../../shared/no-regex.js";
import { resolveFromRepo } from "../../../shared/paths.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../../shared/source-files.js";
import { collectResolvedModuleTargets } from "../../../shared/source-module-targets.js";

export const pluginStatusConfigPath = "scripts/audit/config/plugin-status.json";
const ciFullPhasePlanPath = "scripts/audit/ci-full-phase-plan.ts";

const pluginStatusEntrySchema = z.object({
  pluginId: z.string().min(1),
  status: z.enum(["active", "experimental", "parked", "archived"]),
  owner: z.string().min(1),
  phase: z.string().min(1),
  allowedEntrypoints: z.array(z.string().min(1)).min(1),
  allowedAcceptanceTests: z.array(z.string().min(1)),
  allowedNpmScripts: z.array(z.string().min(1)),
  exposureTokens: z.array(z.string().min(1)).min(1),
  lawSourceRefs: z.array(z.string().min(1)).min(1),
});

const pluginStatusConfigSchema = z.object({
  plugins: z.array(pluginStatusEntrySchema),
});

type PluginStatusEntry = z.infer<typeof pluginStatusEntrySchema>;

type PluginExposureSummary = {
  actualPluginIds: string[];
  ciFullAcceptanceScripts: string[];
  exposureFilesByPluginId: Record<string, string[]>;
  findings: InspectorFinding[];
  statusEntries: PluginStatusEntry[];
};

const isRouteExposurePath = (repoPath: string): boolean => {
  const segments = pathSegments(repoPath);
  return segments[0] === "src" && segments[1] === "app" && (segments.at(-1)?.endsWith("-routes.ts") ?? false);
};
const defaultSurfacePaths = new Set([
  "src/app/workbench-home-page.ts",
  "src/app/workbench-home-client.ts",
  "src/lib/local-runtime/workbench.ts",
  "src/lib/local-runtime/workbench-handle.ts",
]);

const resolvePluginIdFromRepoPath = (repoPath: string): string | undefined => {
  if (!repoPath.startsWith("src/plugins/")) {
    return undefined;
  }
  const segments = repoPath.split("/");
  return segments.length >= 3 ? segments[2] : undefined;
};

const readPackageScripts = (): Record<string, string> => {
  const parsed = JSON.parse(readFileSync(resolveFromRepo("package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  return parsed.scripts ?? {};
};

const loadPluginStatusEntries = (): PluginStatusEntry[] => {
  const parsed = pluginStatusConfigSchema.safeParse(
    JSON.parse(readFileSync(resolveFromRepo(pluginStatusConfigPath), "utf8")),
  );
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return parsed.data.plugins;
};

const collectActualPluginIds = (project: Parameters<typeof listActiveSourceFiles>[0]): string[] => {
  const pluginIds = new Set<string>();
  for (const sourceFile of listActiveSourceFiles(project)) {
    const pluginId = resolvePluginIdFromRepoPath(getRepoSourcePath(sourceFile));
    if (pluginId) {
      pluginIds.add(pluginId);
    }
  }
  return [...pluginIds].sort();
};

const collectExposureFilesByPluginId = (
  project: Parameters<typeof listActiveSourceFiles>[0],
  entries: readonly PluginStatusEntry[],
): Record<string, string[]> => {
  const exposures = new Map<string, Set<string>>();
  for (const entry of entries) {
    exposures.set(entry.pluginId, new Set<string>());
  }

  for (const sourceFile of listActiveSourceFiles(project)) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (
      repoPath.startsWith("src/app/")
      || repoPath.startsWith("src/lib/local-runtime/")
      || repoPath.startsWith("src/mediator/")
    ) {
      for (const target of collectResolvedModuleTargets(sourceFile)) {
        const pluginId = resolvePluginIdFromRepoPath(target.targetPath);
        if (!pluginId) {
          continue;
        }
        exposures.get(pluginId)?.add(repoPath);
      }
    }
    if (!isRouteExposurePath(repoPath)) {
      continue;
    }
    const literalValues = [
      ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue()),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((literal) => literal.getLiteralValue()),
    ];
    for (const entry of entries) {
      if (!entry.exposureTokens.some((token) => literalValues.some((value) => value.includes(token)))) {
        continue;
      }
      exposures.get(entry.pluginId)?.add(repoPath);
    }
  }

  return Object.fromEntries(
    [...exposures.entries()].map(([pluginId, files]) => [pluginId, [...files].sort()]),
  );
};

const collectCiFullAcceptanceScripts = (project: Parameters<typeof listActiveSourceFiles>[0]): string[] => {
  const sourceFile = project.getSourceFile(resolveFromRepo(ciFullPhasePlanPath));
  if (!sourceFile) {
    return [];
  }
  const scripts = new Set<string>();
  for (const literal of sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
    const value = literal.getLiteralValue();
    if (value.startsWith("acceptance:")) {
      scripts.add(value);
    }
  }
  for (const literal of sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
    const value = literal.getLiteralValue();
    if (value.startsWith("acceptance:")) {
      scripts.add(value);
    }
  }
  return [...scripts].sort();
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

const inspectPluginStatusContracts = (input: {
  ciFullAcceptanceScripts: readonly string[];
  entries: readonly PluginStatusEntry[];
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
  packageScripts: Readonly<Record<string, string>>;
}): void => {
  for (const entry of input.entries) {
    for (const lawSourceRef of entry.lawSourceRefs) {
      input.inspectedFiles.add(lawSourceRef);
      if (existsSync(resolveFromRepo(lawSourceRef))) {
        continue;
      }
      pushFinding(
        input.findings,
        input.lawId,
        pluginStatusConfigPath,
        "architecture/plugin-law-source-missing",
        `Plugin status entry ${entry.pluginId} references missing constitutional source ${lawSourceRef}.`,
        lawSourceRef,
      );
    }

    for (const npmScript of [...entry.allowedAcceptanceTests, ...entry.allowedNpmScripts]) {
      if (input.packageScripts[npmScript] !== undefined) {
        continue;
      }
      pushFinding(
        input.findings,
        input.lawId,
        pluginStatusConfigPath,
        "architecture/plugin-script-missing",
        `Plugin status entry ${entry.pluginId} requires npm script ${npmScript}, but package.json does not define it.`,
        npmScript,
      );
    }

    if (
      entry.status === "active"
      && !entry.allowedAcceptanceTests.some((scriptName) => input.ciFullAcceptanceScripts.includes(scriptName))
    ) {
      pushFinding(
        input.findings,
        input.lawId,
        pluginStatusConfigPath,
        "architecture/plugin-active-missing-ci-acceptance",
        `Active plugin ${entry.pluginId} has no allowed acceptance smoke wired into ci:full.`,
        entry.allowedAcceptanceTests.join(", "),
      );
    }
  }
};

const inspectMissingPluginStatusEntries = (input: {
  actualPluginIds: readonly string[];
  entryByPluginId: ReadonlyMap<string, PluginStatusEntry>;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  for (const pluginId of input.actualPluginIds) {
    if (input.entryByPluginId.has(pluginId)) {
      continue;
    }
    pushFinding(
      input.findings,
      input.lawId,
      pluginStatusConfigPath,
      "architecture/plugin-status-missing",
      `Active plugin root src/plugins/${pluginId} is missing from the plugin status table.`,
      pluginId,
    );
  }
};

const inspectPluginExposureEntries = (input: {
  actualPluginIds: readonly string[];
  entries: readonly PluginStatusEntry[];
  exposureFilesByPluginId: Readonly<Record<string, string[]>>;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const entry of input.entries) {
    const actualRootExists = input.actualPluginIds.includes(entry.pluginId);
    if (entry.status === "archived" && actualRootExists) {
      pushFinding(
        input.findings,
        input.lawId,
        pluginStatusConfigPath,
        "architecture/plugin-archived-root-present",
        `Archived plugin ${entry.pluginId} still exists under src/plugins/${entry.pluginId}.`,
        entry.pluginId,
      );
    }

    const exposureFiles = input.exposureFilesByPluginId[entry.pluginId] ?? [];
    for (const exposureFile of exposureFiles) {
      input.inspectedFiles.add(exposureFile);
      if (!entry.allowedEntrypoints.includes(exposureFile)) {
        pushFinding(
          input.findings,
          input.lawId,
          exposureFile,
          "architecture/plugin-entry-not-allowlisted",
          `${exposureFile} exposes plugin ${entry.pluginId}, but the plugin status table does not approve that entry surface.`,
          entry.pluginId,
        );
      }
      if (entry.status === "parked") {
        pushFinding(
          input.findings,
          input.lawId,
          exposureFile,
          "architecture/plugin-parked-exposure",
          `Parked plugin ${entry.pluginId} is still exposed through ${exposureFile}.`,
          entry.pluginId,
        );
      }
      if (entry.status === "experimental" && defaultSurfacePaths.has(exposureFile)) {
        pushFinding(
          input.findings,
          input.lawId,
          exposureFile,
          "architecture/plugin-experimental-default-exposure",
          `Experimental plugin ${entry.pluginId} is exposed through default runtime surface ${exposureFile}.`,
          entry.pluginId,
        );
      }
      if (entry.status === "archived") {
        pushFinding(
          input.findings,
          input.lawId,
          exposureFile,
          "architecture/plugin-archived-exposure",
          `Archived plugin ${entry.pluginId} is still exposed through ${exposureFile}.`,
          entry.pluginId,
        );
      }
    }
  }
};

export const inspectActivePluginGate = (input: {
  lawId: string;
  project: Parameters<typeof listActiveSourceFiles>[0];
  inspectedFiles: Set<string>;
}): PluginExposureSummary => {
  const findings: InspectorFinding[] = [];
  input.inspectedFiles.add(pluginStatusConfigPath);
  input.inspectedFiles.add(ciFullPhasePlanPath);

  const entries = loadPluginStatusEntries();
  const entryByPluginId = new Map(entries.map((entry) => [entry.pluginId, entry]));
  const packageScripts = readPackageScripts();
  const actualPluginIds = collectActualPluginIds(input.project);
  const ciFullAcceptanceScripts = collectCiFullAcceptanceScripts(input.project);
  const exposureFilesByPluginId = collectExposureFilesByPluginId(input.project, entries);

  inspectPluginStatusContracts({
    ciFullAcceptanceScripts,
    entries,
    findings,
    inspectedFiles: input.inspectedFiles,
    lawId: input.lawId,
    packageScripts,
  });
  inspectMissingPluginStatusEntries({
    actualPluginIds,
    entryByPluginId,
    findings,
    lawId: input.lawId,
  });
  inspectPluginExposureEntries({
    actualPluginIds,
    entries,
    exposureFilesByPluginId,
    findings,
    inspectedFiles: input.inspectedFiles,
    lawId: input.lawId,
  });

  return {
    actualPluginIds,
    ciFullAcceptanceScripts,
    exposureFilesByPluginId,
    findings,
    statusEntries: entries,
  };
};
