const WORKBENCH_DEEP_RESEARCH_STYLES = `
.research-shell {
  display: grid;
  gap: 14px;
}
.research-shell.hidden { display: none; }
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
  background: linear-gradient(180deg, #fbfcf8, #f7f8f4);
}
.research-header h1 {
  font-size: 24px;
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
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
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
  position: sticky;
  top: 12px;
  max-height: calc(100vh - 128px);
  grid-template-rows: auto auto minmax(0, 1fr);
  overflow: hidden;
}
.research-search input {
  width: 100%;
}
.research-history-list {
  min-height: 0;
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
  gap: 8px;
}
.research-history-item.selected {
  border-color: var(--accent-strong);
  box-shadow: inset 3px 0 0 var(--accent);
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
  max-width: 1120px;
}
.research-report {
  gap: 14px;
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
  padding: 24px;
  min-height: 260px;
  align-content: center;
}
.research-report-header h2,
.research-card-head h2,
.research-section-head h2 {
  margin: 0;
  font-size: 18px;
  line-height: 1.25;
}
.research-section {
  gap: 12px;
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
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  padding: 6px 10px;
}
.research-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.research-nav a:hover {
  border-color: var(--accent-strong);
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
.research-confidence-pill,
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
.research-stage-completed,
.research-confidence-pill { color: var(--accent-strong); border-color: rgba(22, 116, 95, 0.25); background: rgba(22, 116, 95, 0.08); }
.research-status-failed,
.research-stage-failed { color: var(--bad); border-color: rgba(161, 58, 58, 0.25); background: rgba(161, 58, 58, 0.08); }
.research-status-review_required,
.research-stage-review_required { color: var(--warn); border-color: rgba(154, 88, 24, 0.25); background: rgba(154, 88, 24, 0.08); }
.research-stage-running,
.research-status-running { color: var(--accent-strong); border-color: rgba(22, 116, 95, 0.18); background: rgba(22, 116, 95, 0.05); }
.research-stage-pending,
.research-status-queued { color: var(--muted); }
.research-summary-grid,
.research-analysis-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.research-stage-grid,
.research-question-tree {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
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
  padding: 18px;
}
.research-section[data-deep-research-final-card] {
  border-color: rgba(22, 116, 95, 0.28);
  box-shadow: inset 4px 0 0 var(--accent);
}
.research-question-card-full {
  background: #fbfcf8;
}
.research-copy-block,
.research-analysis-card,
.research-conflict-card {
  display: grid;
  gap: 10px;
}
.research-list {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
}
.research-copy-block details,
.research-evidence-root details,
.research-export-item details,
.research-evidence-item details {
  margin-top: 4px;
}
.research-copy-block summary,
.research-evidence-root summary,
.research-export-item summary,
.research-evidence-item summary {
  cursor: pointer;
  color: var(--accent-strong);
  font-weight: 600;
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
  .research-layout {
    grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
  }
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
    position: static;
    max-height: 360px;
  }
  .research-side {
    grid-template-columns: 1fr;
  }
}
`;

export const renderWorkbenchDeepResearchStyles = (): string => WORKBENCH_DEEP_RESEARCH_STYLES;
