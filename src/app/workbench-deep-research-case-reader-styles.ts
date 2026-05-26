const WORKBENCH_DEEP_RESEARCH_CASE_READER_STYLES = `
.research-plan-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}
.research-subquestion-card {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcf8 100%);
  display: grid;
  gap: 12px;
  padding: 14px;
}
.research-promptbundle-panel {
  border: 1px solid rgba(22, 116, 95, 0.18);
  border-radius: 10px;
  background: #f7fbf9;
  padding: 12px;
}
.research-answer-tabs,
.research-answer-clean,
.research-answer-index,
.research-answer-raw,
.research-delivery-status,
.research-case-outline {
  display: grid;
  gap: 10px;
}
.research-answer-clean,
.research-answer-index,
.research-answer-raw {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  padding: 12px;
}
.research-delivery-status {
  border: 1px solid rgba(22, 116, 95, 0.18);
  border-radius: 10px;
  background: #f7fbf9;
  padding: 12px;
}
.research-case-outline .research-list {
  padding-left: 18px;
}
.research-chain-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 8px;
}
.research-chain-step {
  min-height: 54px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  color: var(--ink);
  text-decoration: none;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 8px;
  align-items: center;
  padding: 8px 10px;
}
.research-chain-index {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: var(--accent-strong);
  font-weight: 700;
}
.research-chain-step b {
  font-size: 12px;
}
.research-chain-step .research-status-pill {
  grid-column: 1 / -1;
  justify-self: start;
  min-height: 24px;
  padding: 3px 8px;
}
.research-chain-completed {
  border-color: rgba(22, 116, 95, 0.26);
  background: #f4fbf8;
}
.research-primary-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
@media (max-width: 1100px) {
  .research-plan-grid {
    grid-template-columns: 1fr;
  }
  .research-chain-strip {
    grid-template-columns: 1fr;
  }
}
`;

export const renderWorkbenchDeepResearchCaseReaderStyles = (): string =>
  WORKBENCH_DEEP_RESEARCH_CASE_READER_STYLES;
