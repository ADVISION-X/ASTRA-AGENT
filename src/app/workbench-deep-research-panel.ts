import { renderDeepResearchHistoryView } from "./workbench-deep-research-history-view.js";
import { renderDeepResearchReportView } from "./workbench-deep-research-report-view.js";

export const renderDeepResearchPanel = (): string => `
<section class="hidden research-shell" data-job-panel="deep-research" data-deep-research-layout-contract="history-rail-reader">
  <header class="research-header">
    <div>
      <h1>Deep Research Analysis</h1>
      <p class="muted">Report library -> final conclusion -> paired analysis -> synthesis -> evidence trace</p>
    </div>
    <p class="research-disclaimer">This is an AI research report, not a guaranteed prediction. Read reverse conditions, opposing arguments, and evidence gaps before acting.</p>
  </header>
  <div class="research-toolbar">
    <div>
      <p class="research-kicker">Report Library</p>
      <p class="muted">Read completed reports without mixing them with debug-first controls.</p>
    </div>
    <div class="research-toolbar-actions">
      <button class="btn" type="button" data-deep-research-new-toggle>New Research</button>
    </div>
  </div>
  <section class="research-form-shell hidden" data-deep-research-form-shell>
    <form class="research-control" data-deep-research-form>
      <div class="field wide"><label>User Question</label><textarea name="userQuestion" rows="5" required></textarea></div>
      <div class="field wide"><label>Analysis Goal</label><input name="analysisGoal" /></div>
      <div class="field"><label>Language</label><select name="language"><option value="zh-CN">zh-CN</option><option value="en">en</option></select></div>
      <div class="field"><label>Provider</label><select name="providerKind"><option value="gemini-api">Gemini API</option><option value="gemini-web-chat">Gemini web chat</option><option value="gpt-web-chat">GPT web chat</option></select></div>
      <div class="field"><label>Max sub questions</label><input name="maxSubQuestions" type="number" min="2" max="12" value="4" required /></div>
      <div class="actions"><button class="btn" type="submit">Start</button></div>
    </form>
  </section>
  <section class="research-layout" data-deep-research-layout data-deep-research-scroll-boundary>
    ${renderDeepResearchHistoryView()}
    ${renderDeepResearchReportView()}
  </section>
</section>`;
