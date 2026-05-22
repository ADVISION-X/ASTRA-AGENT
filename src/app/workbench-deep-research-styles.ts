const WORKBENCH_DEEP_RESEARCH_STYLES = `
.research-shell {
  display: grid;
  gap: 16px;
}
.research-shell.hidden { display: none; }
.research-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  max-width: 980px;
}
.research-disclaimer {
  margin: 0;
  color: var(--warn);
  font-size: 12px;
}
.research-control {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  max-width: 980px;
}
textarea {
  width: 100%;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  border-radius: 6px;
  padding: 9px;
  resize: vertical;
  font: inherit;
}
.research-overview,
.research-progress,
.research-summary-grid,
.research-timeline,
.research-final-report,
.research-evidence-table {
  max-width: 980px;
}
.research-overview,
.research-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.research-metric,
.research-step,
.research-final-section {
  border: 1px solid var(--line);
  background: var(--panel);
  border-radius: 8px;
  padding: 12px;
}
.research-metric b {
  display: block;
  font-size: 18px;
}
.research-progress {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
}
.research-progress span {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 6px 8px;
  text-align: center;
  color: var(--muted);
  background: #fff;
}
.research-progress .active {
  border-color: var(--accent);
  color: var(--accent-strong);
}
.research-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.research-timeline {
  display: grid;
  gap: 12px;
}
.research-step header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.phase-badge,
.hash-chip,
.status-chip {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 11px;
  max-width: 100%;
  overflow-wrap: anywhere;
}
.phase-badge {
  border-color: var(--accent);
  color: var(--accent-strong);
  font-weight: 700;
}
.hash-chip {
  font-family: var(--mono);
  color: var(--muted);
}
.status-chip {
  color: var(--warn);
}
.research-step details,
.research-final-report details,
.research-evidence-table details {
  margin-top: 8px;
}
.prompt-pre,
.response-pre,
.raw-json-pre {
  max-height: 360px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: var(--mono);
}
.research-final-report {
  display: grid;
  gap: 10px;
}
.research-evidence-table table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
}
.research-evidence-table th,
.research-evidence-table td {
  border-bottom: 1px solid var(--line);
  padding: 8px;
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}
.research-evidence-table th {
  color: var(--muted);
  font-weight: 600;
}
@media (max-width: 980px) {
  .research-control,
  .research-overview,
  .research-summary-grid,
  .research-progress {
    grid-template-columns: 1fr;
  }
}
`;

export const renderWorkbenchDeepResearchStyles = (): string => WORKBENCH_DEEP_RESEARCH_STYLES;
