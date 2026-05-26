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
@media (max-width: 1100px) {
  .research-plan-grid {
    grid-template-columns: 1fr;
  }
}
`;

export const renderWorkbenchDeepResearchCaseReaderStyles = (): string =>
  WORKBENCH_DEEP_RESEARCH_CASE_READER_STYLES;