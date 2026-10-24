import { renderAppShellIcon } from "./app-shell-icons.js";

export const renderRuntimeConsole = (): string => `
<footer class="runtime-console" data-runtime-console data-activity-panel>
  <div class="runtime-console-header">
    <div class="runtime-console-title">
      ${renderAppShellIcon("terminal")}
      <span>Runtime Console</span>
      <span class="status-badge status-console" data-runtime-console-state data-tone="ready">ready</span>
    </div>
    <button class="icon-button icon-button-ghost" type="button" data-console-toggle aria-expanded="true" aria-label="Toggle console" title="Toggle console">${renderAppShellIcon("console")}</button>
  </div>
  <div class="runtime-console-events" data-runtime-console-events data-activity-log role="log" aria-live="polite" aria-relevant="additions" aria-label="Runtime Console">
    <div class="runtime-event empty-state" data-runtime-empty-state>Waiting for runtime events.</div>
    <div class="runtime-event loading-state hidden" data-runtime-loading-state>Loading runtime events...</div>
    <div class="runtime-event error-state hidden" data-runtime-error-state>Runtime event stream unavailable.</div>
    <div class="runtime-event manual-required-state hidden" data-runtime-manual-required-state>manual_required events appear here.</div>
    <div class="runtime-event failed-state hidden" data-runtime-failed-state>failed events appear here.</div>
  </div>
</footer>`;
