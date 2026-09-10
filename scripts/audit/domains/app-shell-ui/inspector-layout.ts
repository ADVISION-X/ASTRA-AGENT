import { SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";

const paths = {
  appShell: "src/app/app-shell/app-shell.ts",
  client: "src/app/workbench-home-client.ts",
  home: "src/app/workbench-home-page.ts",
  inspector: "src/app/app-shell/inspector.ts",
  layout: "src/app/app-shell/app-shell-layout.ts",
  runtime: "src/app/app-shell/runtime-console.ts",
  sidebar: "src/app/app-shell/sidebar.ts",
  styles: "src/app/app-shell/app-shell-styles.ts",
  workspace: "src/app/app-shell/production-runtime-workspace.ts",
  productionClient: "src/app/workbench-production-runtime-client.ts",
} as const;

const styleModulePaths = [
  paths.styles,
  "src/app/app-shell/app-shell-core-styles.ts",
  "src/app/app-shell/app-shell-workspace-styles.ts",
  "src/app/app-shell/app-shell-inspector-console-styles.ts",
] as const;

const sourcePath = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const astText = (sourceFile: SourceFile): string => [
  ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateHead).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateMiddle).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateTail).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
    .map((node) => astIdentifierName(node))
    .filter((name): name is string => name !== undefined),
].join("\n");

const requireToken = (input: {
  checkId: string;
  findings: InspectorFinding[];
  lawId: string;
  repoPath: string;
  sourceFile: SourceFile | undefined;
  token: string;
}): void => {
  if (input.sourceFile && astText(input.sourceFile).includes(input.token)) return;
  input.findings.push(createFinding({ evidenceMode: "static.ast",
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.repoPath,
    message: `${input.repoPath} must expose ${input.token}.`,
  }));
};

const requireTokenInAny = (input: {
  checkId: string;
  findings: InspectorFinding[];
  lawId: string;
  sourceFiles: SourceFile[];
  token: string;
}): void => {
  if (input.sourceFiles.some((sourceFile) => astText(sourceFile).includes(input.token))) return;
  input.findings.push(createFinding({ evidenceMode: "static.ast",
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: paths.styles,
    message: `App Shell style modules must expose ${input.token}.`,
  }));
};

const requireNamedImport = (input: {
  findings: InspectorFinding[];
  lawId: string;
  moduleSuffix: string;
  repoPath: string;
  sourceFile: SourceFile | undefined;
  symbolName: string;
}): void => {
  const found = input.sourceFile?.getImportDeclarations().some((declaration) =>
    declaration.getModuleSpecifierValue().endsWith(input.moduleSuffix)
    && declaration.getNamedImports().some((namedImport) => namedImport.getName() === input.symbolName));
  if (found) return;
  input.findings.push(createFinding({ evidenceMode: "static.ast",
    checkId: `app-shell-ui/import-${input.symbolName}`,
    lawId: input.lawId,
    filePath: input.repoPath,
    message: `${input.repoPath} must import ${input.symbolName} from ${input.moduleSuffix}.`,
  }));
};

export const inspectAppShellLayout = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const sources = Object.fromEntries(
    Object.entries(paths).map(([name, repoPath]) => [name, sourcePath(context, repoPath)]),
  ) as Record<keyof typeof paths, SourceFile | undefined>;
  const styleFiles = styleModulePaths
    .map((repoPath) => sourcePath(context, repoPath))
    .filter((sourceFile): sourceFile is SourceFile => sourceFile !== undefined);
  for (const sourceFile of [...Object.values(sources), ...styleFiles]) {
    if (sourceFile) inspectedFiles.add(getRepoSourcePath(sourceFile));
  }
  requireNamedImport({ findings, lawId, sourceFile: sources.home, repoPath: paths.home, symbolName: "renderAppShell", moduleSuffix: "./app-shell/app-shell.js" });
  for (const [symbolName, moduleSuffix] of [
    ["renderCommandBar", "./command-bar.js"],
    ["renderSidebar", "./sidebar.js"],
    ["renderMainWorkspace", "./app-shell-layout.js"],
    ["renderInspector", "./inspector.js"],
    ["renderRuntimeConsole", "./runtime-console.js"],
  ] as const) {
    requireNamedImport({ findings, lawId, sourceFile: sources.appShell, repoPath: paths.appShell, symbolName, moduleSuffix });
  }
  for (const token of [
    "app-shell",
    "command-bar",
    "sidebar",
    "workspace",
    "inspector",
    "runtime-console",
    "status-badge",
    "detail-section",
    "empty-state",
    "loading-state",
    "error-state",
    "manual-required-state",
    "failed-state",
  ]) {
    requireTokenInAny({ findings, lawId, sourceFiles: styleFiles, token, checkId: `app-shell-ui/style-${token}` });
  }
  for (const [repoPath, sourceFile, token, checkId] of [
    [paths.appShell, sources.appShell, "data-app-shell", "app-shell-ui/root-marker"],
    [paths.layout, sources.layout, "data-workspace-page-nav", "app-shell-ui/workspace-nav"],
    [paths.layout, sources.layout, "data-workspace-surface", "app-shell-ui/workspace-surface"],
    [paths.workspace, sources.workspace, "data-skill-workspace", "app-shell-ui/production-workspace"],
    [paths.workspace, sources.workspace, "data-production-status", "app-shell-ui/production-status"],
    [paths.workspace, sources.workspace, "data-production-observation-rows", "app-shell-ui/operations-matrix"],
    [paths.inspector, sources.inspector, "data-app-shell-inspector", "app-shell-ui/right-inspector"],
    [paths.runtime, sources.runtime, "data-runtime-console", "app-shell-ui/runtime-console"],
    [paths.sidebar, sources.sidebar, "data-skill-registry", "app-shell-ui/sidebar-registry"],
    [paths.appShell, sources.appShell, "inspector-collapsed", "app-shell-ui/inspector-closed"],
    [paths.client, sources.client, "openInspector", "app-shell-ui/client-inspector"],
    [paths.client, sources.client, "resetInspector", "app-shell-ui/client-inspector-reset"],
    [paths.productionClient, sources.productionClient, "/api/production-runtime/operations-snapshot", "app-shell-ui/production-client"],
  ] as const) {
    requireToken({ findings, lawId, repoPath, sourceFile, token, checkId });
  }
};
