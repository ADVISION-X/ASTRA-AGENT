import { renderWorkbenchDeepResearchCaseReaderStyles } from "./workbench-deep-research-case-reader-styles.js";

const WORKBENCH_DEEP_RESEARCH_STYLES = `
.research-shell { display: grid; gap: 14px; }
.research-shell.hidden,
.research-empty-state.hidden,
.research-report.hidden { display: none; }
.research-header,
.research-toolbar,
.research-form-shell,
.research-history,
.research-reader,
.research-side-panel,
.research-analysis-card,
.research-conflict-card,
.research-question-card,
.research-stage-item,
.research-evidence-item,
.research-export-item,
.research-empty-state,
.research-article-card {
  border: 1px solid var(--line);
  background: var(--panel);
  border-radius: 8px;
}
.research-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  background: linear-gradient(135deg, #fffdfa 0%, #f4faf7 58%, #eef4fb 100%);
}
.research-header h1 {
  font-size: 26px;
  line-height: 1.15;
}
.research-disclaimer {
  margin: 0;
  color: var(--warn);
  font-size: 12px;
  max-width: 520px;
  text-align: right;
}
.research-toolbar,
.research-rail-header,
.research-report-kicker,
.research-card-head,
.research-analysis-head,
.research-evidence-top,
.research-export-item div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.research-toolbar {
  padding: 12px 14px;
}
.research-kicker {
  margin: 0 0 4px;
  color: var(--accent-strong);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.research-toolbar-actions,
.research-rail-actions,
.research-export-actions,
.research-delivery-strip {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.research-delivery-strip {
  gap: 10px;
}
.research-delivery-strip span {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fbfcf8;
  color: var(--muted);
  padding: 5px 10px;
  font-size: 12px;
}
.research-delivery-strip b {
  color: var(--ink);
}
.research-form-shell {
  padding: 14px;
}
.research-control {
  display: grid;
  grid-template-columns: minmax(260px, 1.4fr) minmax(180px, 0.8fr) minmax(170px, 0.7fr) minmax(150px, 0.6fr);
  gap: 12px;
  align-items: end;
}
textarea {
  width: 100%;
  min-height: 84px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  border-radius: 8px;
  padding: 9px;
  resize: vertical;
  font: inherit;
}
.research-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  min-height: 0;
}
.research-history,
.research-reader,
.research-side-panel {
  padding: 14px;
}
.research-history {
  display: grid;
  gap: 12px;
  grid-template-rows: auto auto minmax(0, 1fr);
  overflow: visible;
}
.research-search input {
  width: 100%;
}
.research-history-list {
  max-height: min(320px, 34vh);
  overflow: auto;
  padding-right: 2px;
}
.research-history-list,
.research-question-tree,
.research-analysis-grid,
.research-stage-grid,
.research-evidence-body,
.research-evidence-exports,
.research-summary-grid,
.research-reader,
.research-report,
.research-nav,
.research-side-meta,
.research-side-meta-grid {
  display: grid;
  gap: 10px;
}
.research-history-item {
  width: 100%;
  text-align: left;
  border: 1px solid var(--line);
  background: #fbfcf8;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  display: grid;
  grid-template-columns: minmax(180px, 0.85fr) minmax(260px, 1.35fr) auto minmax(220px, auto);
  align-items: center;
  gap: 8px;
}
.research-history-select {
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: grid;
  gap: 8px;
  padding: 0;
  text-align: left;
  min-width: 0;
}
.research-history-delete {
  justify-self: end;
}
.research-history-item.selected {
  border-color: var(--accent-strong);
  box-shadow: inset 4px 0 0 var(--accent);
  background: #f4fbf8;
}
.research-history-item h3,
.research-question-card h3,
.research-evidence-item h3 {
  margin: 0;
  color: var(--ink);
  font-size: 14px;
}
.research-history-item p,
.research-question-card p,
.research-evidence-item p,
.research-copy-block p,
.research-empty-state p,
.research-lead {
  margin: 0;
}
.research-history-title {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.research-history-title span,
.research-history-summary {
  color: var(--muted);
  font-size: 12px;
}
.research-history-summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.research-history-top,
.research-meta-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.research-meta-row {
  color: var(--muted);
  font-size: 12px;
}
.research-reader-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
}
.research-reader {
  min-width: 0;
  max-width: none;
}
.research-report {
  gap: 14px;
}
.research-reading-rhythm {
  font-size: 14.5px;
  line-height: 1.65;
}
.research-empty-state,
.research-section,
.research-report-header,
.research-side-panel,
.research-card-head,
.research-article-card,
.research-conflict-card {
  display: grid;
  gap: 12px;
}
.research-empty-state {
  padding: 14px 16px;
  min-height: 0;
  align-content: start;
  border-style: dashed;
  background: #fbfcf8;
}
.research-report-header h2,
.research-card-head h2,
.research-section-head h2 {
  margin: 0;
  font-size: 20px;
  line-height: 1.25;
}
.research-section {
  gap: 12px;
  background: #fff;
}
.research-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.research-side {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 0.8fr);
  gap: 12px;
  position: static;
  align-self: start;
  order: -1;
}
.research-side-panel {
  min-width: 0;
}
.research-side .research-side-panel {
  background: #fbfcf8;
}
.research-nav a {
  color: var(--accent-strong);
  text-decoration: none;
  font-weight: 600;
  border: 0;
  border-left: 3px solid rgba(22, 116, 95, 0.28);
  border-radius: 0;
  background: transparent;
  padding: 2px 8px;
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}
.research-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
}
.research-nav a:hover {
  border-left-color: var(--accent-strong);
  text-decoration: none;
}
.research-side-meta-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.research-side-meta-grid div,
.research-debug-list div {
  display: grid;
  gap: 4px;
}
.research-side-meta-grid b,
.research-debug-list dt {
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}
.research-side-meta-grid span,
.research-debug-list dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.research-status-pill,
.research-stage-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  border-radius: 999px;
  border: 1px solid var(--line);
  padding: 4px 10px;
  font-size: 12px;
}
.research-status-pill { color: var(--muted); background: #fff; }
.research-status-completed,
.research-stage-completed { color: var(--accent-strong); border-color: rgba(22, 116, 95, 0.25); background: rgba(22, 116, 95, 0.08); }
.research-status-failed,
.research-stage-failed { color: var(--bad); border-color: rgba(161, 58, 58, 0.25); background: rgba(161, 58, 58, 0.08); }
.research-status-review_required,
.research-stage-review_required { color: var(--warn); border-color: rgba(154, 88, 24, 0.25); background: rgba(154, 88, 24, 0.08); }
.research-stage-running,
.research-status-running { color: var(--accent-strong); border-color: rgba(22, 116, 95, 0.18); background: rgba(22, 116, 95, 0.05); }
.research-stage-pending,
.research-status-queued { color: var(--muted); }
.research-summary-grid { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
.research-analysis-grid { grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); }
.research-stage-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.research-question-tree { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
.research-analysis-card,
.research-conflict-card,
.research-question-card,
.research-stage-item,
.research-evidence-item,
.research-export-item,
.research-article-card,
.research-report-header,
.research-section,
.research-card-head,
.research-empty-state {
  padding: 14px;
}
.research-report-header,
.research-section[data-deep-research-final-card] {
  padding: 22px;
}
.research-report-header {
  background: linear-gradient(135deg, #ffffff 0%, #f7fbf9 48%, #f5f8fc 100%);
}
.research-section[data-deep-research-final-card] {
  border-color: rgba(22, 116, 95, 0.28);
  background: linear-gradient(135deg, #ffffff 0%, #f5fbf8 62%, #fffaf0 100%);
  box-shadow: inset 5px 0 0 var(--accent), 0 10px 28px rgba(29, 39, 48, 0.06);
}
.research-section[data-deep-research-final-card] h2 {
  font-size: 24px;
}
.research-question-card-full {
  background: #fbfcf8;
}
.research-subquestion-section {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 8px;
  display: grid;
  gap: 12px;
  padding: 16px;
}
.research-analysis-card {
  border-top: 3px solid rgba(22, 116, 95, 0.38);
  background: linear-gradient(180deg, #ffffff, #fbfcf8);
}
.research-copy-block, .research-analysis-card, .research-conflict-card, .research-parsed-panel, .research-parsed-list, .research-parsed-item {
  display: grid; gap: 10px;
}
.research-parsed-panel { border: 1px solid rgba(22, 116, 95, 0.18); border-radius: 8px; background: #f7fbf9; padding: 12px; }
.research-parsed-head, .research-parsed-item-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; flex-wrap: wrap;
}
.research-parsed-head h3, .research-parsed-item h4 { margin: 0; }
.research-parsed-item { border: 1px solid var(--line); border-left: 3px solid rgba(22, 116, 95, 0.28); border-radius: 8px; background: #fff; padding: 12px; }
.research-list {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 8px;
}
.research-list li::marker { color: var(--accent-strong); }
.research-copy-block details,
.research-evidence-root details,
.research-debug-root,
.research-export-item details,
.research-evidence-item details {
  margin-top: 4px;
}
.research-copy-block summary,
.research-evidence-root summary,
.research-debug-root summary,
.research-export-item summary,
.research-evidence-item summary {
  cursor: pointer;
  color: var(--accent-strong);
  font-weight: 600;
}
.research-debug-root {
  border: 1px dashed rgba(102, 113, 124, 0.42);
  border-radius: 8px;
  background: #fbfcf8;
  padding: 10px 12px;
}
.prompt-pre,
.response-pre,
.raw-json-pre {
  margin: 0;
  max-height: 360px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: var(--mono);
  font-size: 12px;
}
.research-evidence-root {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fbfcf8;
  padding: 12px 14px;
}
.research-debug-list {
  margin: 0;
  display: grid;
  gap: 10px;
}
@media (max-width: 1400px) {
  .research-stage-grid,
  .research-question-tree {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 1100px) {
  .research-layout,
  .research-stage-grid,
  .research-question-tree,
  .research-summary-grid,
  .research-analysis-grid,
  .research-control {
    grid-template-columns: 1fr;
  }
  .research-header,
  .research-toolbar,
  .research-section-head {
    align-items: flex-start;
    flex-direction: column;
  }
  .research-disclaimer {
    max-width: none;
    text-align: left;
  }
  .research-history {
    max-height: none;
  }
  .research-history-item {
    grid-template-columns: 1fr;
  }
  .research-side {
    grid-template-columns: 1fr;
  }
}`;
export const renderWorkbenchDeepResearchStyles = (): string => `${WORKBENCH_DEEP_RESEARCH_STYLES}${renderWorkbenchDeepResearchCaseReaderStyles()}`;
