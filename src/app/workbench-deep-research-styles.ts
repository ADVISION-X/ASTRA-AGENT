import { renderWorkbenchDeepResearchCaseReaderStyles } from "./workbench-deep-research-case-reader-styles.js";
import { WORKBENCH_DEEP_RESEARCH_REPORT_STYLES } from "./workbench-deep-research-report-styles.js";

const WORKBENCH_DEEP_RESEARCH_STYLES = `
.research-shell {
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 14px;
}
.research-shell.hidden,
.research-empty-state.hidden,
.research-help-modal.hidden,
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
  padding: 2px 2px 0;
  background: transparent;
  border: 0;
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
.deep-research-page-stack {
  min-height: 0;
  display: grid;
}
.deep-research-page-stack .skill-page-surface {
  min-height: 0;
}
.research-reader-surface,
.research-library-surface,
.research-new-surface,
.research-case-surface {
  min-height: 0;
}
.research-field-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
}
.research-help-button,
.research-help-close {
  appearance: none;
  border: 1px solid rgba(22, 116, 95, 0.34);
  background: #f7fbf9;
  color: var(--accent-strong);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.research-help-button {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 12px;
  line-height: 1;
  padding: 0;
}
.research-help-button:hover,
.research-help-close:hover {
  border-color: var(--accent-strong);
  background: rgba(22, 116, 95, 0.1);
}
.research-help-modal {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 20px;
}
.research-help-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(25, 34, 43, 0.28);
}
.research-help-card {
  position: relative;
  width: min(560px, 100%);
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 18px 48px rgba(25, 34, 43, 0.18);
  padding: 18px;
  display: grid;
  gap: 12px;
}
.research-help-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.research-help-head h2,
.research-help-card p {
  margin: 0;
}
.research-help-close {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  padding: 0;
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
.research-attachment-dropzone {
  border: 1px dashed var(--line-strong);
  border-radius: 8px;
  padding: 12px;
  background: #fbfcf8;
  color: var(--muted);
  min-height: 48px;
  display: flex;
  align-items: center;
}
.research-attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 28px;
}
.research-attachment-pill {
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  color: var(--ink);
  padding: 4px 9px;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  max-height: calc(100vh - 390px);
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
  min-height: 0;
}
.research-reader {
  min-width: 0;
  max-width: none;
  height: calc(100vh - 332px);
  overflow: auto;
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
  order: initial;
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
${WORKBENCH_DEEP_RESEARCH_REPORT_STYLES}`;
export const renderWorkbenchDeepResearchStyles = (): string => `${WORKBENCH_DEEP_RESEARCH_STYLES}${renderWorkbenchDeepResearchCaseReaderStyles()}`;
