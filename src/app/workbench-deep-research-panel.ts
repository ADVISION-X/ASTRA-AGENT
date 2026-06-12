import { renderDeepResearchHistoryView } from "./workbench-deep-research-history-view.js";
import { renderDeepResearchReportView } from "./workbench-deep-research-report-view.js";

const renderDeepResearchNewResearchSurface = (): string => `
<section class="research-form-shell" data-deep-research-form-shell>
  <form class="research-control" data-deep-research-form>
    <div class="field wide">
      <span class="research-field-label"><label for="deep-research-user-question">User Question</label><button class="research-help-button" type="button" data-deep-research-field-help="userQuestion" aria-label="User Question help">?</button></span>
      <textarea id="deep-research-user-question" name="userQuestion" rows="5" required></textarea>
    </div>
    <div class="field wide">
      <span class="research-field-label"><label for="deep-research-input-attachments">Input Attachments</label><button class="research-help-button" type="button" data-deep-research-field-help="inputAttachments" aria-label="Input Attachments help">?</button></span>
      <input id="deep-research-input-attachment-picker" type="file" multiple data-deep-research-attachment-picker />
      <textarea id="deep-research-input-attachments" name="inputAttachments" class="hidden" rows="1" data-deep-research-attachment-state></textarea>
      <div class="research-attachment-dropzone" data-deep-research-attachment-dropzone tabindex="0">
        <span>Add files, paste files, or drop local files here</span>
      </div>
      <div class="research-attachment-list" data-deep-research-attachment-list></div>
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
</section>`;

export const renderDeepResearchPanel = (): string => `
<section class="research-shell deep-research-app-workspace" data-job-panel="deep-research" data-deep-research-layout-contract="reader-primary-history-library">
  <header class="skill-header research-header">
    <div>
      <span class="eyebrow">Level 2 Skill Workspace</span>
      <h1>Deep Research Analysis</h1>
      <p class="muted">Case reader -> ResearchPlan -> promptBundle -> clean/raw/index -> final adjudication -> HTML delivery</p>
    </div>
    <p class="research-disclaimer">This is an AI research report, not a guaranteed prediction. Read reverse conditions, opposing arguments, and evidence gaps before acting.</p>
  </header>
  <nav class="skill-page-nav" data-deep-research-page-nav aria-label="Deep Research Analysis pages">
    <button class="skill-page-tab" type="button" data-deep-research-page="reader" aria-pressed="true">Report Reader</button>
    <button class="skill-page-tab" type="button" data-deep-research-page="library" aria-pressed="false">Report Library</button>
    <button class="skill-page-tab" type="button" data-deep-research-page="new" aria-pressed="false" data-deep-research-new-toggle>New Research</button>
    <button class="skill-page-tab" type="button" data-deep-research-page="case" aria-pressed="false">Case File</button>
  </nav>
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
  <div class="skill-page-stack deep-research-page-stack" data-deep-research-layout data-deep-research-scroll-boundary>
    <section class="skill-page-surface research-reader-surface" data-deep-research-surface="reader">
      ${renderDeepResearchReportView()}
    </section>
    <section class="skill-page-surface research-library-surface hidden" data-deep-research-surface="library">
      ${renderDeepResearchHistoryView()}
    </section>
    <section class="skill-page-surface research-new-surface hidden" data-deep-research-surface="new">
      ${renderDeepResearchNewResearchSurface()}
    </section>
    <section class="skill-page-surface research-case-surface hidden" data-deep-research-surface="case">
      <aside class="research-side" data-deep-research-side data-deep-research-side-panel>
        <section class="research-side-panel">
          <p class="research-kicker">Report Navigation</p>
          <nav class="research-nav" data-deep-research-nav></nav>
        </section>
        <section class="research-side-panel">
          <p class="research-kicker">Metadata</p>
          <div class="research-side-meta" data-deep-research-meta></div>
        </section>
      </aside>
    </section>
  </div>
</section>`;
