import { renderWorkbenchDeepResearchClient } from "../workbench-deep-research-client.js";
import { renderWorkbenchDeepResearchStyles } from "../workbench-deep-research-styles.js";
import { renderMediaOptimizerClient } from "../skills/media-optimizer/media-optimizer-client.js";
import { renderWorkbenchHomeClient } from "../workbench-home-client.js";
import { renderWorkbenchHomeStyles } from "../workbench-home-styles.js";
import { renderXuanxueAiProductionClient } from "../workbench-xuanxue-ai-production-client.js";
import { renderAmazonInvoiceInterventionClient } from "../amazon-invoice-intervention-client.js";
import { renderAmazonProductMiningInterventionClient } from "../amazon-product-mining-intervention-client.js";
import { renderDeepResearchInterventionClient } from "../deep-research-intervention-client.js";
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
  <style>${renderWorkbenchHomeStyles()}${renderWorkbenchDeepResearchStyles()}</style>
</head>
<body class="inspector-collapsed" data-active-skill="amazon-product-mining">
  <div class="app-shell" data-workbench-shell data-app-shell>
    ${renderCommandBar()}
    <div class="app-shell-layout" data-app-shell-layout>
      ${renderSidebar()}
      ${renderMainWorkspace()}
      ${renderInspector()}
    </div>
    ${renderRuntimeConsole()}
  </div>
  <script>${renderAppShellLocalizationClient()}${renderWorkbenchHomeClient()}${renderMediaOptimizerClient()}${renderWorkbenchDeepResearchClient()}${renderXuanxueAiProductionClient()}${renderAmazonInvoiceInterventionClient()}${renderAmazonProductMiningInterventionClient()}${renderDeepResearchInterventionClient()}</script>
</body>
</html>`;
