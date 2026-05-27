import { renderDeepResearchHistoryView } from "./workbench-deep-research-history-view.js";
import { renderDeepResearchReportView } from "./workbench-deep-research-report-view.js";

export const renderDeepResearchPanel = (): string => `
<section class="hidden research-shell" data-job-panel="deep-research" data-deep-research-layout-contract="reader-primary-history-library">
  <header class="research-header">
    <div>
      <h1>Deep Research Analysis</h1>
      <p class="muted">Case reader -> ResearchPlan -> promptBundle -> clean/raw/index -> final adjudication -> HTML delivery</p>
    </div>
    <p class="research-disclaimer">This is an AI research report, not a guaranteed prediction. Read reverse conditions, opposing arguments, and evidence gaps before acting.</p>
  </header>
  <div class="research-toolbar">
    <div>
      <p class="research-kicker">Report Library</p>
      <p class="muted">Read complete case files without collapsing them into a final-summary-only viewer.</p>
    </div>
    <div class="research-toolbar-actions">
      <button class="btn" type="button" data-deep-research-new-toggle>New Research</button>
    </div>
  </div>
  <section class="research-form-shell hidden" data-deep-research-form-shell>
    <form class="research-control" data-deep-research-form>
      <div class="field wide">
        <span class="research-field-label"><label for="deep-research-user-question">User Question</label><button class="research-help-button" type="button" data-deep-research-field-help="userQuestion" aria-label="User Question help">?</button></span>
        <textarea id="deep-research-user-question" name="userQuestion" rows="5" required></textarea>
      </div>
      <div class="field wide">
        <span class="research-field-label"><label for="deep-research-analysis-goal">Analysis Goal</label><button class="research-help-button" type="button" data-deep-research-field-help="analysisGoal" aria-label="Analysis Goal help">?</button></span>
        <input id="deep-research-analysis-goal" name="analysisGoal" />
      </div>
      <div class="field">
        <span class="research-field-label"><label for="deep-research-language">Language</label><button class="research-help-button" type="button" data-deep-research-field-help="language" aria-label="Language help">?</button></span>
        <select id="deep-research-language" name="language"><option value="zh-CN">zh-CN</option><option value="en">en</option></select>
      </div>
      <div class="field">
        <span class="research-field-label"><label for="deep-research-provider">Provider</label><button class="research-help-button" type="button" data-deep-research-field-help="providerKind" aria-label="Provider help">?</button></span>
        <select id="deep-research-provider" name="providerKind"><option value="gemini-api">Gemini API</option><option value="gemini-web-chat">Gemini web chat</option><option value="gpt-web-chat">GPT web chat</option></select>
      </div>
      <div class="field">
        <span class="research-field-label"><label for="deep-research-max-sub-questions">Max sub questions</label><button class="research-help-button" type="button" data-deep-research-field-help="maxSubQuestions" aria-label="Max sub questions help">?</button></span>
        <input id="deep-research-max-sub-questions" name="maxSubQuestions" type="number" min="2" max="12" value="4" required />
      </div>
      <div class="actions"><button class="btn" type="submit">Start</button></div>
    </form>
  </section>
  <div class="research-help-modal hidden" data-deep-research-help-modal role="dialog" aria-modal="true" aria-labelledby="deep-research-help-title">
    <div class="research-help-backdrop" data-deep-research-help-close></div>
    <article class="research-help-card">
      <div class="research-help-head">
        <h2 id="deep-research-help-title" data-deep-research-help-title>Field help</h2>
        <button class="research-help-close" type="button" data-deep-research-help-close aria-label="Close field help">x</button>
      </div>
      <p data-deep-research-help-body></p>
      <p class="muted" data-deep-research-help-effect></p>
    </article>
  </div>
  <section class="research-layout" data-deep-research-layout data-deep-research-scroll-boundary>
    ${renderDeepResearchReportView()}
    ${renderDeepResearchHistoryView()}
  </section>
</section>`;
