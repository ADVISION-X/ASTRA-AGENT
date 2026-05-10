import { safeJsonScript } from "./render-helpers.js";

import { appRunLimitSettingsClient } from "./app-run-limit-settings-client.js";
import { commanderConsoleShellClient } from "./commander-console-shell-client.js";
import { mapLabClient } from "./map-lab-client.js";

type CommanderMacShellScriptsInput = {
  viewModel: unknown;
  appViewModel: unknown;
  pageHtmlMap: Record<string, string>;
  inspectHtmlMap: Record<string, string>;
};

export function renderCommanderMacShellScripts(input: CommanderMacShellScriptsInput): string {
  return [
    `<script>window.__grasseyeCommanderConsoleViewModel = ${safeJsonScript(input.viewModel)};</script>`,
    `<script>window.__grasseyeCommanderAppViewModel = ${safeJsonScript(input.appViewModel)};</script>`,
    `<script>window.__grasseyeCommanderConsolePageHtml = ${safeJsonScript(input.pageHtmlMap)};</script>`,
    `<script>window.__grasseyeCommanderConsoleInspectHtml = ${safeJsonScript(input.inspectHtmlMap)};</script>`,
    `<script>${commanderConsoleShellClient}</script>`,
    `<script>${mapLabClient}</script>`,
    `<script>${appRunLimitSettingsClient}</script>`,
  ].join("\n    ");
}