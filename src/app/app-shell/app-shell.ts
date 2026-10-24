import { renderWorkbenchHomeClient } from "../workbench-home-client.js";
import { renderWorkbenchHomeStyles } from "../workbench-home-styles.js";
import { renderProductionRuntimeClient } from "../workbench-production-runtime-client.js";
import { renderCommandBar } from "./command-bar.js";
import { renderInspector } from "./inspector.js";
import { renderAppShellLocalizationClient } from "./localization.js";
import { renderMainWorkspace } from "./app-shell-layout.js";
import { renderRuntimeConsole } from "./runtime-console.js";
import { renderSidebar } from "./sidebar.js";

export const renderAppShell = (): string => `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GrassEye AGENT Workbench</title>
  <style>${renderWorkbenchHomeStyles()}</style>
</head>
<body class="inspector-collapsed" data-active-skill="production-runtime">
  <a class="skip-link" href="#workspace-main">Skip to workspace</a>
  <div class="app-shell" data-workbench-shell data-app-shell>
    ${renderCommandBar()}
    <div class="app-shell-layout" data-app-shell-layout>
      ${renderSidebar()}
      ${renderMainWorkspace()}
      ${renderInspector()}
    </div>
    ${renderRuntimeConsole()}
  </div>
  <script>${renderAppShellLocalizationClient()}${renderWorkbenchHomeClient()}${renderProductionRuntimeClient()}</script>
</body>
</html>`;
