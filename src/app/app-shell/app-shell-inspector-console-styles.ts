export const APP_SHELL_INSPECTOR_CONSOLE_STYLES = `
.inspector {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  resize: horizontal;
  border-left: 1px solid var(--line);
  background: #f8fafc;
  padding: 12px;
}
body.inspector-collapsed .inspector { display: none; }
.inspector-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}
.inspector-body {
  display: grid;
  gap: 12px;
}
.detail-section {
  display: grid;
  gap: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  padding: 12px;
}
.detail-grid {
  display: grid;
  gap: 8px;
}
.detail-grid > div {
  display: grid;
  grid-template-columns: minmax(110px, 150px) minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}
.detail-grid b {
  color: var(--muted);
  font-weight: 650;
}
.detail-grid span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.inspector-list {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 5px;
}
.inspector-link-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}
.inspector-task-snapshot { margin-top: 12px; }
summary { cursor: pointer; color: var(--muted); font-weight: 650; }
.runtime-console {
  min-height: 0;
  display: grid;
  grid-template-rows: 34px minmax(0, 1fr);
  background: #111820;
  color: #dbe5ee;
}
.runtime-console-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  border-bottom: 1px solid #26313d;
  color: #a8b5c2;
  font-weight: 680;
}
.runtime-console-events {
  min-height: 0;
  overflow: auto;
  display: grid;
  align-content: start;
  gap: 6px;
  padding: 10px 14px;
  font-family: var(--mono);
  font-size: 12px;
}
.runtime-event {
  width: 100%;
  border: 1px solid #26313d;
  border-radius: 7px;
  background: #17212c;
  color: #dbe5ee;
  padding: 7px 9px;
  text-align: left;
}
.runtime-event.completed-state { border-color: #244c3f; color: #b8f0d5; }
.runtime-event.running-state { border-color: #66521d; color: #f4d489; }
.runtime-event.manual-required-state { border-color: #66521d; color: #f4d489; }
.runtime-event.failed-state { border-color: #66313a; color: #f2bbc3; }
.record-list { display: grid; gap: 8px; }
.record-item {
  width: 100%;
  display: grid;
  gap: 5px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  padding: 10px;
  text-align: left;
  cursor: pointer;
}
.record-meta {
  color: var(--muted);
  font-family: var(--mono);
  font-size: 11px;
  overflow-wrap: anywhere;
}
.platform-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.platform-tab {
  min-height: 32px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: #fff;
  padding: 6px 10px;
  cursor: pointer;
}
.platform-tab[aria-pressed="true"] {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 700;
}
.notice {
  display: grid;
  gap: 7px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
  color: var(--muted);
  padding: 10px;
}
.notice b { color: var(--ink); }
progress { width: 100%; height: 12px; }
.candidate-row {
  width: 100%;
  min-height: 34px;
  margin-bottom: 6px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: #fff;
  padding: 7px 9px;
  text-align: left;
  font-family: var(--mono);
  font-size: 11px;
  cursor: pointer;
}
.candidate-row[aria-pressed="true"] {
  border-color: var(--accent);
  background: var(--accent-soft);
}
@media (max-width: 1280px) {
  .app-shell-layout { grid-template-columns: 210px minmax(740px, 1fr) 290px; }
  .workspace-grid { grid-template-columns: 250px minmax(610px, 1fr); }
  .filter-bar { grid-template-columns: repeat(2, minmax(160px, 1fr)); }
}
`;
