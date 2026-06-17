import { getDefaultSkill } from "./skill-registry.js";
import { renderLocaleToggle } from "./localization.js";

export const renderCommandBar = (): string => `
<header class="command-bar" data-app-shell-command-bar>
  <div class="command-brand">
    <strong>GrassEye</strong>
    <span>AGENT Workbench</span>
  </div>
  <div class="command-context">
    <span class="status-badge status-running" data-current-skill>${getDefaultSkill().label}</span>
    <span class="status-badge status-completed">health <b data-health-status>-</b></span>
    <span class="status-badge status-watch">mode <b data-mode-status>-</b></span>
  </div>
  <div class="command-actions" data-locale-toggle-host>
    ${renderLocaleToggle()}
    <button class="icon-button" type="button" data-sidebar-toggle aria-label="Toggle sidebar" title="Toggle sidebar">⌥</button>
    <button class="icon-button" type="button" data-inspector-toggle aria-label="Toggle inspector" title="Toggle inspector">⌘</button>
    <button class="icon-button" type="button" data-console-toggle aria-label="Toggle console" title="Toggle console">⌃</button>
    <button class="icon-button icon-button-primary" type="button" data-refresh-shell aria-label="Refresh shell" title="Refresh shell">↻</button>
  </div>
</header>`;
