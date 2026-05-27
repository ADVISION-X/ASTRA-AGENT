const WORKBENCH_HOME_STYLES = `
:root {
  color-scheme: light;
  --bg: #f5f6f2;
  --panel: #ffffff;
  --ink: #1d2730;
  --muted: #66717c;
  --line: #d8ded6;
  --accent: #16745f;
  --accent-strong: #0d5848;
  --warn: #9a5818;
  --bad: #a13a3a;
  --mono: "SFMono-Regular", Consolas, monospace;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
  font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
button, input, select {
  font: inherit;
}
.shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: 54px 1fr 132px;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 18px;
  border-bottom: 1px solid var(--line);
  background: #fbfcf8;
}
.brand { display: flex; align-items: baseline; gap: 10px; min-width: 260px; }
.brand strong { font-size: 17px; }
.brand span, .status span, .muted { color: var(--muted); }
.status { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.pill {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--line);
  background: #fff;
  padding: 3px 9px;
  border-radius: 999px;
  color: var(--muted);
}
.pill b { margin-left: 5px; color: var(--ink); }
.main {
  min-height: 0;
  display: grid;
  grid-template-columns: 240px minmax(420px, 1fr) 330px;
  gap: 0;
}
body[data-active-job="deep-research"] .main {
  grid-template-columns: 220px minmax(760px, 1fr) 280px;
}
.rail, .ledger {
  min-width: 0;
  padding: 16px;
  border-right: 1px solid var(--line);
  overflow: auto;
}
.ledger {
  border-right: 0;
  border-left: 1px solid var(--line);
}
.workspace { min-width: 0; padding: 18px 20px; overflow: auto; }
h1, h2, h3, p { margin: 0; }
h2 { font-size: 14px; margin-bottom: 10px; }
h3 { font-size: 13px; margin-bottom: 8px; color: var(--muted); }
.job-list { display: grid; gap: 8px; }
.job-card {
  width: 100%;
  text-align: left;
  border: 1px solid var(--line);
  background: var(--panel);
  border-radius: 8px;
  padding: 11px;
  cursor: pointer;
}
.job-card[aria-pressed="true"] { border-color: var(--accent); box-shadow: inset 3px 0 0 var(--accent); }
.job-card strong { display: block; margin-bottom: 4px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; max-width: 860px; }
.field { display: grid; gap: 5px; }
.field.wide { grid-column: 1 / -1; }
label { color: var(--muted); font-size: 12px; }
.platform-tabs {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 4px 0 2px;
}
.platform-tab {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  border-radius: 999px;
  min-height: 34px;
  padding: 6px 12px;
  cursor: pointer;
}
.platform-tab[aria-pressed="true"] {
  border-color: var(--accent-strong);
  background: var(--accent);
  color: #fff;
}
input, select {
  width: 100%;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  border-radius: 6px;
  min-height: 36px;
  padding: 7px 9px;
}
.check { display: flex; align-items: center; gap: 8px; min-height: 36px; }
.check input { width: auto; min-height: auto; }
.notice {
  grid-column: 1 / -1;
  display: grid;
  gap: 4px;
  border: 1px solid var(--line);
  background: #fbfcf8;
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--muted);
}
.notice b { color: var(--ink); }
.actions { display: flex; gap: 8px; align-items: center; margin-top: 14px; flex-wrap: wrap; }
.btn {
  border: 1px solid var(--accent-strong);
  background: var(--accent);
  color: #fff;
  border-radius: 6px;
  min-height: 36px;
  padding: 7px 12px;
  cursor: pointer;
}
.btn.secondary { background: #fff; color: var(--accent-strong); border-color: var(--line); }
.candidate-row {
  width: 100%;
  min-height: 38px;
  margin-bottom: 6px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  border-radius: 6px;
  padding: 8px 10px;
  text-align: left;
  font-family: var(--mono);
  font-size: 12px;
  cursor: pointer;
}
.candidate-row[aria-pressed="true"] {
  border-color: var(--accent-strong);
  box-shadow: inset 3px 0 0 var(--accent);
}
.panel {
  border: 1px solid var(--line);
  background: var(--panel);
  border-radius: 8px;
  padding: 13px;
  margin-bottom: 12px;
}
.kv { display: grid; gap: 6px; }
.kv div { display: grid; grid-template-columns: 92px 1fr; gap: 8px; }
.kv b { color: var(--muted); font-weight: 500; }
pre {
  margin: 0;
  white-space: pre-wrap;
  overflow: auto;
  max-height: 220px;
  font-family: var(--mono);
  font-size: 12px;
}
.result-strip {
  margin-top: 18px;
  max-width: 860px;
  display: grid;
  gap: 10px;
}
.result-summary {
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.record-list { display: grid; gap: 8px; }
.record-item {
  border: 1px solid var(--line);
  background: var(--panel);
  border-radius: 8px;
  padding: 10px;
  display: grid;
  gap: 5px;
}
.record-item strong { font-size: 13px; }
.record-meta { color: var(--muted); font-family: var(--mono); font-size: 11px; overflow-wrap: anywhere; }
.review-history { margin-top: 18px; }
.section-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.section-head-tight {
  margin-bottom: 14px;
}
.filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px 12px;
}
.history-state {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fbfcf8;
}
.table-wrap {
  margin-top: 14px;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
}
.history-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  min-width: 2440px;
}
.history-table th,
.history-table td {
  border-bottom: 1px solid var(--line);
  padding: 10px 12px;
  text-align: left;
  vertical-align: top;
}
.history-table th {
  position: sticky;
  top: 0;
  background: #fbfcf8;
  color: var(--muted);
  font-size: 12px;
  z-index: 1;
}
.history-table td .btn { min-height: 30px; padding: 5px 10px; }
.history-error-cell {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}
.review-row td {
  white-space: nowrap;
}
.review-summary-cell {
  max-width: 420px;
  white-space: normal;
  overflow-wrap: anywhere;
}
.review-pill {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.review-pill-decision.review-pill-pass,
.review-pill-status.review-pill-completed,
.review-pill-integrity.review-pill-pass {
  color: var(--accent-strong);
  border-color: #b8d8cf;
  background: #eef8f4;
}
.review-pill-decision.review-pill-watch,
.review-pill-status.review-pill-manual_required {
  color: var(--warn);
  border-color: #e8cfb7;
  background: #fff6eb;
}
.review-pill-decision.review-pill-reject,
.review-pill-status.review-pill-failed,
.review-pill-integrity.review-pill-failed {
  color: var(--bad);
  border-color: #ebc8c8;
  background: #fff2f2;
}
.review-pill-decision.review-pill-insufficient_data,
.review-pill-integrity.review-pill-not_available {
  color: var(--muted);
  border-color: var(--line);
  background: #f4f6f8;
}
.review-detail-row td {
  background: #fbfcf8;
}
.review-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 6px 2px 2px;
}
.review-detail-block {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
}
.review-detail-block-wide {
  grid-column: 1 / -1;
}
.review-detail-copy {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.review-detail-list {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
}
.review-detail-ref-line {
  display: grid;
  grid-template-columns: 180px auto 1fr;
  gap: 10px;
  align-items: center;
}
.review-detail-ref-value {
  overflow-wrap: anywhere;
  font-family: var(--mono);
  font-size: 11px;
}
.activity {
  border-top: 1px solid var(--line);
  background: #fbfcf8;
  padding: 12px 18px;
  overflow: auto;
}
.activity-log { display: grid; gap: 4px; font-family: var(--mono); font-size: 12px; color: var(--muted); }
.hidden { display: none; }
.ok { color: var(--accent-strong); }
.warn { color: var(--warn); }
.bad { color: var(--bad); }
@media (max-width: 980px) {
  .shell { grid-template-rows: auto 1fr 150px; }
  .topbar { align-items: flex-start; flex-direction: column; padding: 12px 14px; }
  .main { grid-template-columns: 1fr; }
  .rail, .ledger { border: 0; border-bottom: 1px solid var(--line); }
  .form-grid { grid-template-columns: 1fr; }
  .filter-grid { grid-template-columns: 1fr; }
  .review-detail-grid { grid-template-columns: 1fr; }
  .review-detail-ref-line {
    grid-template-columns: 1fr;
    align-items: flex-start;
  }
}
`;

export const renderWorkbenchHomeStyles = (): string => WORKBENCH_HOME_STYLES;
