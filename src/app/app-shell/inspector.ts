import { renderAppShellIcon } from "./app-shell-icons.js";

export const renderInspector = (): string => `
<aside class="inspector" data-app-shell-inspector data-task-status-panel aria-label="Inspector">
  <div class="inspector-toolbar">
    <div class="inspector-heading">
      <span class="eyebrow">Inspector</span>
      <h2 data-inspector-title>No selection</h2>
    </div>
    <div class="inspector-tools">
      <span class="status-badge status-insufficient" data-inspector-kind>empty</span>
      <button class="icon-button icon-button-ghost" type="button" data-inspector-toggle aria-expanded="false" aria-label="Toggle inspector" title="Toggle inspector">${renderAppShellIcon("close")}</button>
    </div>
  </div>
  <div class="inspector-body" data-inspector-body>
    <section class="empty-state" data-inspector-empty data-inspector-empty-state>
      <h3>Open Detail When Needed</h3>
      <p>Whole-order status, evidence, exceptions, and runtime events use this detail surface. It stays closed until the operator selects a record.</p>
    </section>
  </div>
  <div class="detail-section inspector-task-snapshot">
    <h3>Task Snapshot</h3>
    <div class="detail-grid">
      <div><b>ID</b><span data-task-id>-</span></div>
      <div><b>Status</b><span data-task-status>-</span></div>
      <div><b>Step</b><span data-task-step>-</span></div>
      <div><b>Reason</b><span data-task-reason>-</span></div>
      <div><b>Evidence</b><span data-evidence-ref>-</span></div>
    </div>
    <details>
      <summary>Raw record</summary>
      <pre data-raw-result>{}</pre>
    </details>
  </div>
</aside>`;
