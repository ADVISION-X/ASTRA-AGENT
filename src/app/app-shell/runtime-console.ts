export const renderRuntimeConsole = (): string => `
<footer class="runtime-console" data-runtime-console data-activity-panel>
  <div class="runtime-console-header">
    <span>Runtime Console</span>
    <span class="status-badge status-running" data-runtime-console-state>ready</span>
  </div>
  <div class="runtime-console-events" data-runtime-console-events data-activity-log>
    <div class="runtime-event empty-state" data-runtime-empty-state>Waiting for runtime events.</div>
    <div class="runtime-event loading-state hidden" data-runtime-loading-state>Loading runtime events...</div>
    <div class="runtime-event error-state hidden" data-runtime-error-state>Runtime event stream unavailable.</div>
    <div class="runtime-event manual-required-state hidden" data-runtime-manual-required-state>manual_required events appear here.</div>
    <div class="runtime-event failed-state hidden" data-runtime-failed-state>failed events appear here.</div>
  </div>
</footer>`;
