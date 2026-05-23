const WORKBENCH_DEEP_RESEARCH_STYLES = `
.research-shell {
  display: grid;
  gap: 16px;
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
  border-radius: 12px;
}
.research-header {
  display: grid;
  gap: 8px;
  padding: 18px 20px;
  background:
    radial-gradient(circle at top left, rgba(22, 116, 95, 0.12), transparent 42%),
    linear-gradient(180deg, #fbfcf8, #f7f8f4);
}
.research-disclaimer {
  margin: 0;
  color: var(--warn);
  font-size: 12px;
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
  padding: 14px 16px;
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
.research-export-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.research-form-shell {
  padding: 16px;
}
.research-control {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
textarea {
  width: 100%;
  min-height: 110px;
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
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.research-history,
.research-reader,
.research-side-panel {
  padding: 16px;
}
.research-history {
  display: grid;
  gap: 12px;
  position: sticky;
  top: 0;
}
.research-search input {
  width: 100%;
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
  border-radius: 10px;
  padding: 12px;
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
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 16px;
}
.research-reader {
  min-width: 0;
}
.research-report {
  gap: 16px;
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
}
.research-report-header h2,
.research-card-head h2,
.research-section-head h2 {
  margin: 0;
  font-size: 20px;
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
  gap: 12px;
  position: sticky;
  top: 0;
  align-self: start;
}
.research-nav a {
  color: var(--accent-strong);
  text-decoration: none;
  font-weight: 600;
}
.research-nav a:hover {
  text-decoration: underline;
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
  .research-reader-shell {
    grid-template-columns: 1fr;
  }
  .research-side {
    position: static;
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
  .research-history {
    position: static;
  }
}
`;

export const renderWorkbenchDeepResearchStyles = (): string => WORKBENCH_DEEP_RESEARCH_STYLES;
