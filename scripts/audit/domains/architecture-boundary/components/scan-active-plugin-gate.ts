import { readFileSync } from "node:fs";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../../shared/source-files.js";
import { collectResolvedModuleTargets } from "../../../shared/source-module-targets.js";

const catalogPath = "src/lib/local-runtime/production/catalog.ts";
const architectureAcceptanceScript = "acceptance:architecture-boundary";

const pluginIdFromSourcePath = (repoPath: string): string | undefined => {
  if (!repoPath.startsWith("src/plugins/")) return undefined;
  return repoPath.split("/")[2];
};

const catalogPluginIds = (
  project: Parameters<typeof listActiveSourceFiles>[0],
): readonly string[] => {
  const catalog = project.getSourceFiles().find((file) => getRepoSourcePath(file) === catalogPath);
  return [...new Set(catalog?.getImportDeclarations()
    .map((declaration) => declaration.getModuleSpecifierValue())
    .filter((specifier) => specifier.startsWith("../../../plugins/"))
    .map((specifier) => specifier.slice("../../../plugins/".length).split("/")[0])
    .filter((pluginId): pluginId is string => Boolean(pluginId)) ?? [])].sort();
};

const sourcePluginIds = (
  project: Parameters<typeof listActiveSourceFiles>[0],
): readonly string[] => [...new Set(listActiveSourceFiles(project)
  .map((file) => pluginIdFromSourcePath(getRepoSourcePath(file)))
  .filter((pluginId): pluginId is string => Boolean(pluginId)))].sort();

const push = (input: {
  checkId: string;
  evidence?: string;
  filePath: string;
  findings: InspectorFinding[];
  lawId: string;
  message: string;
}): void => {
  input.findings.push(createFinding({
    evidenceMode: "static.dependency",
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.filePath,
    evidence: input.evidence,
    message: input.message,
  }));
};

const inspectCatalogBijection = (input: {
  catalogIds: readonly string[];
  findings: InspectorFinding[];
  lawId: string;
  sourceIds: readonly string[];
}): void => {
  for (const pluginId of input.sourceIds.filter((id) => !input.catalogIds.includes(id))) {
    push({ findings: input.findings, lawId: input.lawId, filePath: `src/plugins/${pluginId}`,
      evidence: pluginId, checkId: "architecture/second-active-plugin",
      message: `Product Plugin ${pluginId} exists outside the unique Catalog.` });
  }
  for (const pluginId of input.catalogIds.filter((id) => !input.sourceIds.includes(id))) {
    push({ findings: input.findings, lawId: input.lawId, filePath: `src/plugins/${pluginId}`,
      evidence: pluginId, checkId: "architecture/active-plugin-root-missing",
      message: `Catalog-declared Product Plugin ${pluginId} has no source root.` });
  }
};

const inspectDirectPluginImports = (input: {
  findings: InspectorFinding[];
  lawId: string;
  project: Parameters<typeof listActiveSourceFiles>[0];
}): void => {
  for (const file of listActiveSourceFiles(input.project)) {
    const repoPath = getRepoSourcePath(file);
    if (repoPath === catalogPath || repoPath.startsWith("src/plugins/")) continue;
    for (const target of collectResolvedModuleTargets(file)) {
      const pluginId = pluginIdFromSourcePath(target.targetPath);
      if (!pluginId) continue;
      push({ findings: input.findings, lawId: input.lawId, filePath: repoPath,
        evidence: target.targetPath, checkId: "architecture/plugin-entry-not-authorized",
        message: `${repoPath} imports Product Plugin ${pluginId} outside the unique Catalog.` });
    }
  }
};

export const inspectActivePluginGate = (input: {
  lawId: string;
  project: Parameters<typeof listActiveSourceFiles>[0];
  inspectedFiles: Set<string>;
  targetPaths: readonly string[];
}): Readonly<{ findings: InspectorFinding[] }> => {
  const findings: InspectorFinding[] = [];
  const catalogIds = catalogPluginIds(input.project);
  inspectCatalogBijection({ catalogIds, sourceIds: sourcePluginIds(input.project), findings, lawId: input.lawId });
  inspectDirectPluginImports({ project: input.project, findings, lawId: input.lawId });
  input.inspectedFiles.add(catalogPath);
  if (input.targetPaths.includes("package.json")) {
    input.inspectedFiles.add("package.json");
    const scripts = (JSON.parse(readFileSync(resolveFromRepo("package.json"), "utf8")) as {
      scripts?: Readonly<Record<string, string>>;
    }).scripts ?? {};
    if (!scripts[architectureAcceptanceScript]) {
      push({ findings, lawId: input.lawId, filePath: "package.json",
        evidence: architectureAcceptanceScript, checkId: "architecture/plugin-script-missing",
        message: `The native Architecture acceptance command ${architectureAcceptanceScript} is missing.` });
    }
  }
  return { findings };
};
