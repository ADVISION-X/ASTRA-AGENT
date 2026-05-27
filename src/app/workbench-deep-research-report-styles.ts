export const WORKBENCH_DEEP_RESEARCH_REPORT_STYLES = `
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