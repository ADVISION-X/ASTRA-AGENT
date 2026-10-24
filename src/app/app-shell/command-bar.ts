import { renderAppShellIcon } from "./app-shell-icons.js";
import { getDefaultSkill } from "./skill-registry.js";
import { renderLocaleToggle } from "./localization.js";

export const renderCommandBar = (): string => `
<header class="command-bar" data-app-shell-command-bar>
  <div class="command-brand">
    <span class="brand-mark" aria-hidden="true">${renderAppShellIcon("eye")}</span>
    <strong>GrassEye</strong>
    <span class="brand-product">AGENT Workbench</span>
  </div>
  <div class="command-context">
    <span class="status-badge status-skill" data-current-skill>${getDefaultSkill().label}</span>
    <span class="status-badge status-health" role="status">health <b data-health-status>-</b></span>
  </div>
  <div class="command-actions" data-locale-toggle-host>
    ${renderLocaleToggle()}
    <div class="icon-group" role="group" aria-label="Panels">
      <button class="icon-button" type="button" data-sidebar-toggle aria-expanded="true" aria-label="Toggle sidebar" title="Toggle sidebar">${renderAppShellIcon("sidebar")}</button>
      <button class="icon-button" type="button" data-inspector-toggle aria-expanded="false" aria-label="Toggle inspector" title="Toggle inspector">${renderAppShellIcon("inspector")}</button>
      <button class="icon-button" type="button" data-console-toggle aria-expanded="true" aria-label="Toggle console" title="Toggle console">${renderAppShellIcon("console")}</button>
    </div>
    <button class="icon-button icon-button-primary" type="button" data-refresh-shell aria-label="Refresh shell" title="Refresh shell">${renderAppShellIcon("refresh")}</button>
  </div>
</header>`;
