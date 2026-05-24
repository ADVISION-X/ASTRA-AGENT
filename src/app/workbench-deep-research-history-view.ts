export const renderDeepResearchHistoryView = (): string => `
<section class="research-history" data-deep-research-history-shell>
  <header class="research-rail-header">
    <div>
      <p class="research-kicker">Report History</p>
      <h2>Recent Reports</h2>
    </div>
    <div class="research-rail-actions">
      <button class="btn secondary" type="button" data-deep-research-latest>Latest</button>
      <button class="btn secondary" type="button" data-deep-research-refresh>Refresh</button>
    </div>
  </header>
  <label class="field research-search">
    <span>Search reports</span>
    <input name="historySearch" placeholder="Find by title, question, or status" data-deep-research-history-search />
  </label>
  <div class="research-history-list" data-deep-research-history></div>
</section>`;
