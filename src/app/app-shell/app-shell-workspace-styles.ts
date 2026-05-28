export const APP_SHELL_WORKSPACE_STYLES = `
.workspace {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 18px;
  background: var(--surface);
}
.skill-workspace {
  min-height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 14px;
}
.skill-workspace:not(.hidden) > .research-shell.hidden { display: block !important; }
.skill-header {
  min-height: 78px;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
  padding: 2px 2px 0;
}
.skill-header p {
  max-width: 840px;
  margin-top: 6px;
  color: var(--muted);
}
.skill-header-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.workspace-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(250px, 270px) minmax(650px, 1fr);
  gap: 14px;
  align-items: start;
}
.workspace-side {
  min-width: 0;
  display: grid;
  gap: 12px;
}
.panel, .card {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: 0 1px 2px rgba(17, 24, 39, 0.04);
}
.panel { padding: 13px; }
.publish-task-card { align-self: start; }
.panel-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.compact-form { grid-template-columns: 1fr; }
.field { display: grid; gap: 5px; min-width: 0; }
.field.wide, .wide { grid-column: 1 / -1; }
label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 620;
}
input, select {
  width: 100%;
  min-height: 32px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: #fff;
  color: var(--ink);
  padding: 7px 9px;
}
input:focus, select:focus, button:focus-visible {
  outline: 2px solid rgba(13, 118, 104, 0.24);
  outline-offset: 1px;
}
.check {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 32px;
}
.check input { width: auto; min-height: auto; }
.actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.btn {
  min-height: 34px;
  border: 1px solid var(--accent);
  border-radius: 7px;
  background: var(--accent);
  color: #fff;
  padding: 7px 12px;
  font-weight: 650;
  cursor: pointer;
}
.btn.secondary {
  border-color: var(--line);
  background: #fff;
  color: var(--ink);
}
.compact-button {
  min-height: 28px;
  padding: 4px 8px;
  font-size: 11px;
}
.summary-metrics {
  display: grid;
  gap: 8px;
}
.summary-metrics div {
  display: grid;
  gap: 2px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--panel-subtle);
}
.summary-metrics b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--mono);
  font-size: 12px;
}
.summary-metrics span { color: var(--muted); font-size: 11px; }
.filter-bar {
  display: grid;
  grid-template-columns: repeat(3, minmax(150px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}
.history-panel {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
}
.history-state {
  min-height: 36px;
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  margin-bottom: 12px;
}
.history-table-shell {
  min-height: 360px;
  max-height: calc(100vh - 340px);
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
}
.history-table {
  width: 100%;
  min-width: 1420px;
  border-collapse: separate;
  border-spacing: 0;
}
.history-table th,
.history-table td {
  border-bottom: 1px solid var(--line);
  padding: 9px 10px;
  text-align: left;
  vertical-align: top;
}
.history-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #f8fafc;
  color: var(--muted);
  font-size: 11px;
  font-weight: 720;
}
.review-row {
  cursor: pointer;
}
.review-row:hover td { background: #f7fbfa; }
.table-actions {
  min-width: 330px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.history-error-cell {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}
.status-badge, .decision-badge {
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  color: var(--muted);
  padding: 3px 9px;
  font-size: 11px;
  font-weight: 720;
  white-space: nowrap;
}
.status-pass, .status-completed, .status-ready {
  border-color: #bad9cc;
  background: #eef8f3;
  color: var(--green);
}
.status-watch, .status-running {
  border-color: #d7c9a9;
  background: #fff8e8;
  color: var(--amber);
}
.status-reject, .status-failed, .failed-state {
  border-color: #e2b9bd;
  background: #fff1f2;
  color: var(--red);
}
.status-insufficient, .status-insufficient-data, .empty-state {
  border-color: var(--line);
  background: #f6f8fa;
  color: var(--muted);
}
.status-completed-with-errors, .status-manual-required, .manual-required-state {
  border-color: #d7c9a9;
  background: #fff8e8;
  color: var(--amber);
}
.loading-state {
  border-color: #b8c9d6;
  background: #eef5fb;
  color: var(--blue);
}
.error-state {
  border-color: #e2b9bd;
  background: #fff1f2;
  color: var(--red);
}
.ready-state {
  border-color: #bad9cc;
  background: #eef8f3;
  color: var(--green);
}
.state-stack {
  display: grid;
  gap: 7px;
  margin-top: 10px;
}
.state-stack > div, .empty-state, .loading-state, .error-state, .manual-required-state, .failed-state {
  border-radius: 7px;
  padding: 9px 10px;
}
`;
