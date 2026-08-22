import { SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";

const sourcePath = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const astText = (sourceFile: SourceFile): string => [
  ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateHead).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateMiddle).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateTail).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).flatMap((node) => {
    const name = astIdentifierName(node);
    return name === undefined ? [] : [name];
  }),
].join("\n");

const requireAstToken = (input: {
  findings: InspectorFinding[];
  lawId: string;
  sourceFile: SourceFile | undefined;
  repoPath: string;
  token: string;
  checkId: string;
}): void => {
  if (input.sourceFile && astText(input.sourceFile).includes(input.token)) {
    return;
  }
  input.findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.repoPath,
    message: `${input.repoPath} must expose ${input.token}.`,
  }));
};

const requireAstTokenInAny = (input: {
  findings: InspectorFinding[];
  lawId: string;
  sourceFiles: SourceFile[];
  repoPath: string;
  token: string;
  checkId: string;
}): void => {
  if (input.sourceFiles.some((sourceFile) => astText(sourceFile).includes(input.token))) {
    return;
  }
  input.findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.repoPath,
    message: `App Shell style modules must expose ${input.token}.`,
  }));
};

const requireNamedImport = (input: {
  findings: InspectorFinding[];
  lawId: string;
  sourceFile: SourceFile | undefined;
  repoPath: string;
  symbolName: string;
  moduleSuffix: string;
  checkId: string;
}): void => {
  const found = input.sourceFile?.getImportDeclarations().some((declaration) =>
    declaration.getModuleSpecifierValue().endsWith(input.moduleSuffix)
    && declaration.getNamedImports().some((namedImport) => namedImport.getName() === input.symbolName),
  );
  if (found) return;
  input.findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.repoPath,
    message: `${input.repoPath} must import ${input.symbolName} from ${input.moduleSuffix}.`,
  }));
};

const paths = {
  amazonHistory: "src/app/skills/amazon-product-mining/amazon-product-mining-keyword-history.ts",
  amazonWorkspace: "src/app/skills/amazon-product-mining/amazon-product-mining-workspace.ts",
  appShell: "src/app/app-shell/app-shell.ts",
  client: "src/app/workbench-home-client.ts",
  home: "src/app/workbench-home-page.ts",
  inspector: "src/app/app-shell/inspector.ts",
  layout: "src/app/app-shell/app-shell-layout.ts",
  runtime: "src/app/app-shell/runtime-console.ts",
  sidebar: "src/app/app-shell/sidebar.ts",
  styles: "src/app/app-shell/app-shell-styles.ts",
} as const;

const styleModulePaths = [
  paths.styles,
  "src/app/app-shell/app-shell-core-styles.ts",
  "src/app/app-shell/app-shell-workspace-styles.ts",
  "src/app/app-shell/app-shell-inspector-console-styles.ts",
] as const;

const workspaceModulePaths = [
  paths.layout,
  paths.amazonWorkspace,
  "src/app/skills/media-optimizer/media-optimizer-workspace.ts",
  "src/app/app-shell/amazon-invoice-workspace.ts",
  "src/app/app-shell/xuanxue-ai-production-workspace.ts",
] as const;

type AppShellLayoutSources = {
  amazonHistory: SourceFile | undefined;
  amazonWorkspace: SourceFile | undefined;
  appShell: SourceFile | undefined;
  client: SourceFile | undefined;
  home: SourceFile | undefined;
  inspector: SourceFile | undefined;
  layout: SourceFile | undefined;
  runtime: SourceFile | undefined;
  sidebar: SourceFile | undefined;
  styleFiles: SourceFile[];
  workspaceFiles: SourceFile[];
};

const loadAppShellLayoutSources = (context: InspectorContext): AppShellLayoutSources => ({
  amazonHistory: sourcePath(context, paths.amazonHistory),
  amazonWorkspace: sourcePath(context, paths.amazonWorkspace),
  appShell: sourcePath(context, paths.appShell),
  client: sourcePath(context, paths.client),
  home: sourcePath(context, paths.home),
  inspector: sourcePath(context, paths.inspector),
  layout: sourcePath(context, paths.layout),
  runtime: sourcePath(context, paths.runtime),
  sidebar: sourcePath(context, paths.sidebar),
  styleFiles: styleModulePaths
    .map((repoPath) => sourcePath(context, repoPath))
    .filter((sourceFile): sourceFile is SourceFile => sourceFile !== undefined),
  workspaceFiles: workspaceModulePaths
    .map((repoPath) => sourcePath(context, repoPath))
    .filter((sourceFile): sourceFile is SourceFile => sourceFile !== undefined),
});

const trackAppShellLayoutSources = (
  inspectedFiles: Set<string>,
  sources: AppShellLayoutSources,
): void => {
  for (const sourceFile of Object.values(sources).flat()) {
    if (sourceFile) inspectedFiles.add(getRepoSourcePath(sourceFile));
  }
};

const inspectLayoutImports = (
  findings: InspectorFinding[],
  lawId: string,
  sources: AppShellLayoutSources,
): void => {
  requireNamedImport({ findings, lawId, sourceFile: sources.home, repoPath: paths.home, symbolName: "renderAppShell", moduleSuffix: "./app-shell/app-shell.js", checkId: "app-shell-ui/home-renders-app-shell" });
  requireNamedImport({ findings, lawId, sourceFile: sources.appShell, repoPath: paths.appShell, symbolName: "renderCommandBar", moduleSuffix: "./command-bar.js", checkId: "app-shell-ui/command-bar-import" });
  requireNamedImport({ findings, lawId, sourceFile: sources.appShell, repoPath: paths.appShell, symbolName: "renderSidebar", moduleSuffix: "./sidebar.js", checkId: "app-shell-ui/sidebar-import" });
  requireNamedImport({ findings, lawId, sourceFile: sources.appShell, repoPath: paths.appShell, symbolName: "renderMainWorkspace", moduleSuffix: "./app-shell-layout.js", checkId: "app-shell-ui/workspace-import" });
  requireNamedImport({ findings, lawId, sourceFile: sources.appShell, repoPath: paths.appShell, symbolName: "renderInspector", moduleSuffix: "./inspector.js", checkId: "app-shell-ui/inspector-import" });
  requireNamedImport({ findings, lawId, sourceFile: sources.appShell, repoPath: paths.appShell, symbolName: "renderRuntimeConsole", moduleSuffix: "./runtime-console.js", checkId: "app-shell-ui/runtime-console-import" });
};

const inspectStyleTokens = (
  findings: InspectorFinding[],
  lawId: string,
  styleFiles: SourceFile[],
): void => {
  for (const [token, checkId] of [
    ["app-shell", "app-shell-ui/style-app-shell"],
    ["command-bar", "app-shell-ui/style-command-bar"],
    ["sidebar", "app-shell-ui/style-sidebar"],
    ["workspace", "app-shell-ui/style-workspace"],
    ["inspector", "app-shell-ui/style-inspector"],
    ["runtime-console", "app-shell-ui/style-runtime-console"],
    ["status-badge", "app-shell-ui/style-status-badge"],
    ["decision-badge", "app-shell-ui/style-decision-badge"],
    ["detail-section", "app-shell-ui/style-detail-section"],
    ["empty-state", "app-shell-ui/style-empty-state"],
    ["loading-state", "app-shell-ui/style-loading-state"],
    ["error-state", "app-shell-ui/style-error-state"],
    ["manual-required-state", "app-shell-ui/style-manual-required-state"],
    ["failed-state", "app-shell-ui/style-failed-state"],
  ] as const) {
    requireAstTokenInAny({ findings, lawId, repoPath: paths.styles, sourceFiles: styleFiles, token, checkId });
  }
};

const inspectStructureTokens = (
  findings: InspectorFinding[],
  lawId: string,
  sources: AppShellLayoutSources,
): void => {
  requireAstTokenInAny({
    findings,
    lawId,
    sourceFiles: sources.workspaceFiles,
    repoPath: paths.layout,
    token: "data-skill-workspace",
    checkId: "app-shell-ui/skill-workspace",
  });
  for (const [repoPath, sourceFile, token, checkId] of [
    [paths.appShell, sources.appShell, "data-app-shell", "app-shell-ui/root-marker"],
    [paths.layout, sources.layout, "data-workspace-page-nav", "app-shell-ui/secondary-level2-page-nav"],
    [paths.layout, sources.layout, "data-workspace-surface", "app-shell-ui/secondary-level2-surfaces"],
    [paths.inspector, sources.inspector, "data-app-shell-inspector", "app-shell-ui/right-inspector"],
    [paths.runtime, sources.runtime, "data-runtime-console", "app-shell-ui/runtime-console"],
    [paths.sidebar, sources.sidebar, "data-skill-registry", "app-shell-ui/sidebar-registry"],
    [paths.amazonWorkspace, sources.amazonWorkspace, "Amazon Product Mining", "app-shell-ui/amazon-workspace"],
    [paths.amazonWorkspace, sources.amazonWorkspace, "data-amazon-product-mining-page-nav", "app-shell-ui/amazon-level2-page-nav"],
    [paths.amazonWorkspace, sources.amazonWorkspace, 'data-amazon-product-mining-surface="history"', "app-shell-ui/amazon-level2-history-surface"],
    [paths.amazonWorkspace, sources.amazonWorkspace, 'data-amazon-product-mining-surface="publish"', "app-shell-ui/amazon-level2-publish-surface"],
    [paths.amazonWorkspace, sources.amazonWorkspace, 'data-amazon-product-mining-surface="latest"', "app-shell-ui/amazon-level2-latest-surface"],
    [paths.amazonHistory, sources.amazonHistory, "Keyword Opportunity Review History", "app-shell-ui/keyword-history"],
    [paths.amazonHistory, sources.amazonHistory, "data-amazon-product-mining-review-filter", "app-shell-ui/decision-filter"],
    [paths.amazonHistory, sources.amazonHistory, "data-amazon-product-mining-review-keyword-filter", "app-shell-ui/keyword-filter"],
    [paths.amazonHistory, sources.amazonHistory, "data-amazon-product-mining-review-marketplace-filter", "app-shell-ui/marketplace-filter"],
    [paths.amazonHistory, sources.amazonHistory, "data-amazon-product-mining-review-empty-panel", "app-shell-ui/amazon-empty-history-panel"],
    [paths.amazonHistory, sources.amazonHistory, "data-amazon-product-mining-review-table-shell", "app-shell-ui/amazon-history-table-visibility"],
    [paths.appShell, sources.appShell, "inspector-collapsed", "app-shell-ui/inspector-closed-by-default"],
    [paths.client, sources.client, "openInspector", "app-shell-ui/client-inspector"],
    [paths.client, sources.client, "resetInspectorForSkill", "app-shell-ui/client-inspector-reset"],
    [paths.client, sources.client, 'document.body.classList.remove("inspector-collapsed")', "app-shell-ui/client-inspector-expands-on-detail"],
    [paths.client, sources.client, "showWorkspacePage", "app-shell-ui/client-secondary-page-switch"],
  ] as const) {
    requireAstToken({ findings, lawId, repoPath, sourceFile, token, checkId });
  }
};

export const inspectAppShellLayout = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const sources = loadAppShellLayoutSources(context);
  trackAppShellLayoutSources(inspectedFiles, sources);
  inspectLayoutImports(findings, lawId, sources);
  inspectStyleTokens(findings, lawId, sources.styleFiles);
  inspectStructureTokens(findings, lawId, sources);
};
