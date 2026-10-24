export const APP_SHELL_INSPECTOR_CONSOLE_STYLES = `
.inspector {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  border-left: 1px solid var(--line);
  background: var(--panel-subtle);
}
body.inspector-collapsed .inspector { display: none; }
.inspector-toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 14px 14px 20px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}
.inspector-heading { min-width: 0; }
.inspector-heading h2 { font-size: 16px; overflow-wrap: anywhere; }
.inspector-tools { display: flex; align-items: center; gap: 6px; flex: none; }
.inspector-body { display: grid; gap: 12px; padding: 16px 16px 0; }
.detail-section {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--panel);
  box-shadow: var(--shadow-panel);
}
.inspector-task-snapshot { margin: 12px 16px 20px; }
.detail-grid { display: grid; }
.detail-grid > div {
  display: grid;
  grid-template-columns: minmax(88px, 120px) minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  padding: 9px 0;
  border-top: 1px solid var(--line);
}
.detail-grid > div:first-child { border-top: 0; padding-top: 2px; }
.detail-grid b { color: var(--muted); font-size: 12px; font-weight: 650; }
.detail-grid span, .inspector-list { min-width: 0; font: 12px/1.55 var(--mono); overflow-wrap: anywhere; }
.inspector-list { margin: 0; padding-left: 16px; display: grid; gap: 4px; }
summary { cursor: pointer; color: var(--muted); font-size: 12px; font-weight: 650; }
details pre { margin-top: 8px; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel-subtle); }
.inspector .empty-state {
  display: grid;
  gap: 6px;
  padding: 20px 18px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius);
  background: transparent;
  color: var(--muted);
}
.inspector .empty-state h3 { color: var(--ink); font-size: 13px; }
.inspector .empty-state p { font-size: 13px; }
.runtime-console {
  min-height: 0;
  display: grid;
  grid-template-rows: 44px minmax(0, 1fr);
  border-top: 1px solid #000;
  background: var(--console-bg);
  color: var(--console-ink);
}
.runtime-console-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px 0 20px;
  border-bottom: 1px solid var(--console-line);
  color: var(--console-muted);
}
.runtime-console-title { display: flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; }
.runtime-console .icon-button { color: var(--console-muted); }
.runtime-console .icon-button:hover { border-color: var(--console-line); background: var(--console-line); color: var(--console-ink); }
.runtime-console .status-badge[data-tone="completed"] { border-color: #2f6b52; color: #6fd8a6; }
.runtime-console .status-badge[data-tone="failed"] { border-color: #8a3a44; color: #ff8d98; }
.runtime-console .status-badge[data-tone="running"] { border-color: #7a6226; color: #f2c566; }
.runtime-console .status-badge[data-tone="completed"]::before { content: "\\2713"; content: "\\2713" / ""; }
.runtime-console .status-badge[data-tone="failed"]::before { content: "\\2715"; content: "\\2715" / ""; }
body.console-collapsed .runtime-console-events { display: none; }
.runtime-console-events {
  min-height: 0;
  overflow: auto;
  display: grid;
  align-content: start;
  gap: 2px;
  padding: 8px 12px 12px;
  font: 12px/1.55 var(--mono);
}
.runtime-event {
  width: 100%;
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 5px 10px;
  border: 0;
  border-left: 2px solid var(--console-line);
  border-radius: 0 6px 6px 0;
  background: transparent;
  color: var(--console-ink);
  font: inherit;
  text-align: left;
}
.runtime-event::before { flex: none; width: 12px; color: var(--console-muted); font-weight: 800; text-align: center; }
button.runtime-event { cursor: pointer; }
button.runtime-event:hover { background: var(--console-line); }
button.runtime-event:focus-visible { outline-color: #6fd8a6; outline-offset: -2px; }
.runtime-event time { flex: none; color: var(--console-muted); }
.runtime-event span { min-width: 0; overflow-wrap: anywhere; }
.empty-state.runtime-event::before { content: "\\25CB"; }
.loading-state.runtime-event::before { content: "\\25C6"; }
.error-state.runtime-event::before { content: "\\2715"; }
.manual-required-state.runtime-event::before { content: "!"; }
.failed-state.runtime-event::before { content: "\\2715"; }
.empty-state.runtime-event, .loading-state.runtime-event { color: var(--console-muted); }
.loading-state.runtime-event { border-left-color: #4f7fb8; }
.ready-state.runtime-event { border-left-color: #4f7fb8; }
.ready-state.runtime-event::before { content: "\\25C6"; color: #7db4f0; }
.completed-state.runtime-event { border-left-color: #3fa57a; }
.completed-state.runtime-event::before { content: "\\2713"; color: #6fd8a6; }
.running-state.runtime-event, .manual-required-state.runtime-event { border-left-color: #c79b3a; color: #f2c566; }
.running-state.runtime-event::before { content: "\\25CF"; color: #f2c566; }
.manual-required-state.runtime-event::before { color: #f2c566; }
.failed-state.runtime-event, .error-state.runtime-event { border-left-color: #d1596a; color: #ff8d98; }
.failed-state.runtime-event::before, .error-state.runtime-event::before { color: #ff8d98; }
@media (max-width: 1199px) {
  .inspector {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 6;
    width: min(400px, 100%);
    box-shadow: var(--shadow-drawer);
  }
}
@media (max-width: 899px) {
  .inspector {
    position: static;
    width: auto;
    border-left: 0;
    border-top: 1px solid var(--line);
    box-shadow: none;
  }
  .inspector-toolbar { position: static; }
}
`;
