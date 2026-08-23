import { renderXuanxueAiProductionWorkspace } from "./xuanxue-ai-production-workspace.js";

export const renderMainWorkspace = (): string => `
<main class="workspace" data-app-shell-workspace data-workspace-page-nav="registered-skills" data-workspace-surface="registered-skills">
  ${renderXuanxueAiProductionWorkspace()}
</main>`;
