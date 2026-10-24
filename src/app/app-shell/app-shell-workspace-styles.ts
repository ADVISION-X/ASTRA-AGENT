export const APP_SHELL_WORKSPACE_STYLES = `
.workspace {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 28px 32px 40px;
  background: var(--surface);
  container: workspace / inline-size;
}
.workspace:focus { outline: none; }
.skill-workspace {
  width: 100%;
  max-width: 1360px;
  margin: 0 auto;
  display: grid;
  align-content: start;
  gap: 20px;
}
.skill-header { padding-bottom: 20px; border-bottom: 1px solid var(--line); }
.skill-header p { max-width: 68ch; margin-top: 8px; color: var(--muted); }
.panel {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--panel);
  box-shadow: var(--shadow-panel);
}
.panel-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 16px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
}
.panel-hint { color: var(--muted); font-size: 12px; }
.query-panel { padding: 16px 20px 18px; }
.field { display: grid; gap: 8px; min-width: 0; }
label { color: var(--ink); font-size: 13px; font-weight: 650; }
.query-row { display: flex; gap: 10px; }
input, select {
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--ink);
  transition: border-color 120ms, box-shadow 120ms;
}
input { font-family: var(--mono); font-size: 13px; }
input::placeholder { color: var(--soft); font-family: var(--sans); }
input:hover, select:hover { border-color: var(--soft); }
input:focus, select:focus, input:focus-visible, select:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
}
.btn {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 18px;
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #fff;
  font-weight: 650;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 120ms, border-color 120ms;
}
.btn:hover { border-color: color-mix(in srgb, var(--accent) 86%, #000); background: color-mix(in srgb, var(--accent) 86%, #000); }
.btn.secondary { border-color: var(--line-strong); background: var(--panel); color: var(--ink); }
.btn.secondary:hover { background: var(--panel-subtle); }
.btn:disabled { opacity: 0.55; cursor: progress; }
.metric-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--panel);
  box-shadow: var(--shadow-panel);
}
.metric { display: grid; gap: 6px; min-width: 0; padding: 14px 20px; border-left: 1px solid var(--line); }
.metric:first-child { border-left: 0; }
.metric dt { color: var(--muted); font-size: 12px; font-weight: 650; }
.metric dd { margin: 0; font: 600 14px/1.4 var(--mono); overflow-wrap: anywhere; }
.metric dd[data-tone="unknown"] { color: var(--soft); font-weight: 500; }
.metric dd[data-tone="warning"] { color: var(--amber); }
.metric dd[data-tone="info"] { color: var(--blue); }
.metric dd[data-tone="warning"]::before { content: "! "; font-weight: 800; }
.metric dd[data-tone="info"]::before { content: "\\25C6  "; font-size: 11px; }
.matrix-panel { min-width: 0; overflow: hidden; }
.matrix-shell { overflow: auto; }
.matrix-shell:focus-visible { outline-offset: -2px; }
.matrix-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
.matrix-table th {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line-strong);
  background: var(--panel-subtle);
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
  text-align: left;
  white-space: nowrap;
}
.matrix-table tbody tr { --row-bg: var(--panel); }
.matrix-table tbody tr[data-selectable] { cursor: pointer; }
.matrix-table tbody tr[data-selectable]:hover { --row-bg: var(--panel-subtle); }
.matrix-table tbody tr.is-selected { --row-bg: var(--accent-soft); }
.matrix-table tbody tr:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.matrix-table td {
  padding: 11px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--row-bg);
  vertical-align: top;
  overflow-wrap: break-word;
}
.matrix-table tbody tr:last-child td { border-bottom: 0; }
.matrix-table th:first-child, .matrix-table td:first-child { position: sticky; left: 0; z-index: 1; }
.matrix-table th:first-child { z-index: 2; }
.matrix-table td:first-child { border-right: 1px solid var(--line); }
.matrix-table tbody tr.is-selected td:first-child { box-shadow: inset 4px 0 0 var(--accent); }
.matrix-table .cell-axis, .matrix-table .cell-owner, .matrix-table .cell-value,
.matrix-table .cell-reason, .matrix-table .cell-time, .matrix-table .cell-locator { font-family: var(--mono); font-size: 12px; }
.matrix-table .cell-label { display: none; }
.matrix-table .cell-axis { font-weight: 650; white-space: nowrap; }
.matrix-table .cell-freshness { white-space: nowrap; }
.matrix-table .cell-owner, .matrix-table .cell-freshness { color: var(--muted); }
.matrix-table .cell-time { min-width: 112px; }
.matrix-table .cell-value { min-width: 180px; overflow-wrap: anywhere; }
.matrix-table .cell-locator { min-width: 120px; color: var(--muted); overflow-wrap: anywhere; }
.matrix-table .matrix-empty {
  position: static;
  padding: 36px 20px;
  border-right: 0;
  color: var(--muted);
  font: 13px/1.5 var(--sans);
  text-align: center;
}
.matrix-table .matrix-empty.is-error { background: var(--red-soft); color: var(--red); }
.matrix-table .matrix-empty.is-error::before { content: "\\2715  "; font-weight: 800; }
.reason-chip {
  display: inline-block;
  overflow-wrap: normal;
  padding: 1px 8px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--panel-subtle);
  color: var(--ink);
}
.status-badge {
  min-height: 26px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: var(--panel);
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.2;
  white-space: nowrap;
}
.status-badge::before { content: "\\25CB"; content: "\\25CB" / ""; font-size: 10px; font-weight: 800; line-height: 1; }
.status-badge b { font-weight: 700; }
.status-skill { border-color: color-mix(in srgb, var(--accent) 32%, transparent); background: var(--accent-soft); color: var(--accent); }
.status-skill::before { content: "\\25CF"; content: "\\25CF" / ""; }
.status-health, .status-info, .status-loading { border-color: color-mix(in srgb, var(--blue) 30%, transparent); background: var(--blue-soft); color: var(--blue); }
.status-health::before, .status-info::before, .status-loading::before { content: "\\25C6"; content: "\\25C6" / ""; }
.status-pass, .status-completed, .status-ready { border-color: color-mix(in srgb, var(--green) 30%, transparent); background: var(--green-soft); color: var(--green); }
.status-pass::before, .status-completed::before, .status-ready::before { content: "\\2713"; content: "\\2713" / ""; }
.status-watch, .status-running { border-color: color-mix(in srgb, var(--amber) 32%, transparent); background: var(--amber-soft); color: var(--amber); }
.status-watch::before, .status-running::before { content: "\\25CF"; content: "\\25CF" / ""; }
.status-manual-required, .status-completed-with-errors { border-color: color-mix(in srgb, var(--amber) 32%, transparent); background: var(--amber-soft); color: var(--amber); }
.status-manual-required::before, .status-completed-with-errors::before { content: "!"; content: "!" / ""; }
.status-reject, .status-failed { border-color: color-mix(in srgb, var(--red) 30%, transparent); background: var(--red-soft); color: var(--red); }
.status-reject::before, .status-failed::before { content: "\\2715"; content: "\\2715" / ""; }
.status-insufficient, .status-insufficient-data { background: var(--panel-subtle); color: var(--muted); }
.status-console { border-color: var(--console-line); background: transparent; color: var(--console-muted); }
@media (max-width: 1199px) {
  .workspace { padding: 24px 24px 36px; }
}
@media (max-width: 899px) {
  .workspace { overflow: visible; padding: 20px 16px 28px; }
}
@container workspace (max-width: 999px) {
  .metric-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .metric:nth-child(odd) { border-left: 0; }
  .metric:nth-child(n+3) { border-top: 1px solid var(--line); }
  .matrix-table, .matrix-table tbody { display: block; }
  .matrix-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .matrix-table tbody tr {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
    gap: 10px 20px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--line);
    background: var(--row-bg);
  }
  .matrix-table tbody tr:last-child { border-bottom: 0; }
  .matrix-table tbody tr.is-selected { box-shadow: inset 4px 0 0 var(--accent); }
  .matrix-table tbody tr.is-selected td:first-child { box-shadow: none; }
  .matrix-table td, .matrix-table td:first-child { display: block; position: static; min-width: 0; padding: 0; border: 0; background: transparent; box-shadow: none; }
  .matrix-table .cell-label { display: block; margin-bottom: 3px; color: var(--muted); font: 600 11px/1.3 var(--sans); }
  .matrix-table .cell-axis, .matrix-table .cell-value, .matrix-table .cell-locator { grid-column: 1 / -1; }
  .matrix-table .cell-axis { font-size: 13px; }
  .matrix-table .cell-axis .cell-label { display: none; }
  .matrix-table .matrix-empty { grid-column: 1 / -1; padding: 28px 0; }
}
@container workspace (max-width: 559px) {
  .query-row { flex-direction: column; }
  .metric-strip { grid-template-columns: minmax(0, 1fr); }
  .metric { border-left: 0; border-top: 1px solid var(--line); }
  .metric:first-child { border-top: 0; }
}
`;
