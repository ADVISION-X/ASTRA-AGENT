import { renderWorkbenchDeepResearchClient } from "../workbench-deep-research-client.js";
import { renderWorkbenchDeepResearchStyles } from "../workbench-deep-research-styles.js";
import { renderWorkbenchHomeClient } from "../workbench-home-client.js";
import { renderWorkbenchHomeStyles } from "../workbench-home-styles.js";
import { renderWorkbenchVideoDownloadClient } from "../workbench-video-download-client.js";
import { renderCommandBar } from "./command-bar.js";
import { renderInspector } from "./inspector.js";
import { renderMainWorkspace } from "./app-shell-layout.js";
import { renderRuntimeConsole } from "./runtime-console.js";
import { renderSidebar } from "./sidebar.js";

export const renderAppShell = (): string => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GrassEye AGENT Workbench</title>
  <style>${renderWorkbenchHomeStyles()}${renderWorkbenchDeepResearchStyles()}</style>
</head>
<body data-active-skill="amazon-product-mining">
  <div class="app-shell" data-workbench-shell data-app-shell>
    ${renderCommandBar()}
    <div class="app-shell-layout" data-app-shell-layout>
      ${renderSidebar()}
      ${renderMainWorkspace()}
      ${renderInspector()}
    </div>
    ${renderRuntimeConsole()}
  </div>
  <script>${renderWorkbenchHomeClient()}${renderWorkbenchVideoDownloadClient()}${renderWorkbenchDeepResearchClient()}</script>
</body>
</html>`;
