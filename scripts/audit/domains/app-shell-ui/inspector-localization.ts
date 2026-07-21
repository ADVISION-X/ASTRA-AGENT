import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";

const localizationPath = "src/app/app-shell/localization.ts";
const localizationRuntimePath = "src/app/app-shell/localization-client-runtime.ts";
const appShellPath = "src/app/app-shell/app-shell.ts";
const commandBarPath = "src/app/app-shell/command-bar.ts";

const sourcePath = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const literalValues = (sourceFile: SourceFile | undefined): string[] => sourceFile
  ? [
      ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateHead).map((node) => node.getLiteralText()),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateMiddle).map((node) => node.getLiteralText()),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateTail).map((node) => node.getLiteralText()),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()),
    ]
  : [];

const hasLiteral = (sourceFile: SourceFile | undefined, token: string): boolean =>
  literalValues(sourceFile).some((value) => value.includes(token));

const requireToken = (input: {
  checkId: string;
  findings: InspectorFinding[];
  lawId: string;
  repoPath: string;
  sourceFile: SourceFile | undefined;
  token: string;
}): void => {
  if (hasLiteral(input.sourceFile, input.token)) return;
  input.findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.repoPath,
    message: `${input.repoPath} must contain App Shell localization token ${input.token}.`,
  }));
};

export const inspectAppShellLocalization = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const localization = sourcePath(context, localizationPath);
  const localizationRuntime = sourcePath(context, localizationRuntimePath);
  const appShell = sourcePath(context, appShellPath);
  const commandBar = sourcePath(context, commandBarPath);
  for (const sourceFile of [localization, localizationRuntime, appShell, commandBar]) {
    if (sourceFile) inspectedFiles.add(getRepoSourcePath(sourceFile));
  }
  for (const [repoPath, sourceFile, token, checkId] of [
    [localizationPath, localization, "supportedAppShellLocales", "app-shell-ui/localization-supported"],
    [localizationPath, localization, "defaultAppShellLocale", "app-shell-ui/localization-default"],
    [localizationPath, localization, "zh", "app-shell-ui/localization-zh"],
    [localizationPath, localization, "en", "app-shell-ui/localization-en"],
    [localizationPath, localization, "appShellZhCopy", "app-shell-ui/localization-copy"],
    [localizationPath, localization, "renderLocaleToggle", "app-shell-ui/localization-toggle"],
    [localizationPath, localization, "renderAppShellLocalizationClient", "app-shell-ui/localization-client"],
    [localizationPath, localization, "renderLocalizationClientRuntime", "app-shell-ui/localization-runtime-wiring"],
    [localizationRuntimePath, localizationRuntime, "MutationObserver", "app-shell-ui/localization-dynamic"],
    [localizationPath, localization, "grasseye-app-locale", "app-shell-ui/localization-cookie"],
    [localizationPath, localization, "locale", "app-shell-ui/localization-search-param"],
    [localizationPath, localization, "AGENT 工作台", "app-shell-ui/localization-zh-copy"],
    [appShellPath, appShell, "zh-CN", "app-shell-ui/localization-html-lang"],
    [appShellPath, appShell, "renderAppShellLocalizationClient", "app-shell-ui/localization-shell-client"],
    [commandBarPath, commandBar, "renderLocaleToggle", "app-shell-ui/localization-command-bar"],
    [commandBarPath, commandBar, "data-locale-toggle", "app-shell-ui/localization-visible-toggle"],
  ] as const) {
    requireToken({ findings, lawId, repoPath, sourceFile, token, checkId });
  }
  if (hasLiteral(localization, "localStorage") || hasLiteral(localizationRuntime, "localStorage")) {
    findings.push(createFinding({
      checkId: "app-shell-ui/localization-no-localstorage",
      lawId,
      filePath: localizationPath,
      message: "App Shell localization must not use localStorage as language truth.",
    }));
  }
};
