export const renderDeepResearchPanel = (): string => `
<section class="hidden research-shell" data-job-panel="deep-research">
  <header class="research-header">
    <div>
      <h1>Deep Research Analysis</h1>
      <p class="muted">question -> decomposition -> positive analysis -> falsification -> final synthesis</p>
    </div>
    <p class="research-disclaimer">This is an AI research report, not a guaranteed prediction. Review reverse conditions and evidence gaps before acting.</p>
  </header>
  <form class="research-control" data-deep-research-form>
    <div class="field wide"><label>User Question</label><textarea name="userQuestion" rows="5" required></textarea></div>
    <div class="field wide"><label>Analysis Goal</label><input name="analysisGoal" /></div>
    <div class="field"><label>Language</label><select name="language"><option value="zh-CN">zh-CN</option><option value="en">en</option></select></div>
    <div class="field"><label>Provider</label><select name="providerKind"><option value="gemini-api">Gemini API</option><option value="gemini-web-chat">Gemini web chat</option><option value="gpt-web-chat">GPT web chat</option></select></div>
    <div class="field"><label>Max sub questions</label><input name="maxSubQuestions" type="number" min="2" max="12" value="4" required /></div>
    <div class="actions"><button class="btn" type="submit">Start</button><button class="btn secondary" type="button" data-deep-research-latest>Latest</button><button class="btn secondary" type="button" data-deep-research-refresh>Refresh</button></div>
  </form>
  <section class="research-overview" data-deep-research-overview></section>
  <section class="research-progress" data-deep-research-progress></section>
  <nav class="research-tabs" aria-label="Deep Research views">
    <button class="btn secondary" type="button" data-research-tab="overview">Overview</button>
    <button class="btn secondary" type="button" data-research-tab="timeline">Timeline</button>
    <button class="btn secondary" type="button" data-research-tab="final-report">Final Report</button>
    <button class="btn secondary" type="button" data-research-tab="evidence">Evidence</button>
  </nav>
  <section data-research-view="overview"><div class="research-summary-grid" data-deep-research-summary></div></section>
  <section class="hidden" data-research-view="timeline"><div class="research-timeline" data-deep-research-timeline></div></section>
  <section class="hidden" data-research-view="final-report"><div class="research-final-report" data-deep-research-final-report></div></section>
  <section class="hidden" data-research-view="evidence"><div class="research-evidence-table" data-deep-research-evidence></div></section>
</section>`;
