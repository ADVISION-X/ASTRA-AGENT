export const renderDeepResearchReportView = (): string => `
<div class="research-reader-shell" data-deep-research-reader-shell>
  <main class="research-reader" data-deep-research-reader data-deep-research-reader-primary>
    <section class="research-empty-state" data-deep-research-empty>
      <p class="research-kicker">Report Reader</p>
      <h2>Select a report from history</h2>
      <p class="muted">Choose a report above to open the ResearchPlan, promptBundle, clean/raw/index views, exports, and process trace.</p>
    </section>
    <article class="research-report hidden research-reading-rhythm" data-deep-research-report>
      <header class="research-report-header" data-deep-research-report-header></header>
      <section class="research-section" id="conclusion" data-deep-research-final-card></section>
      <section class="research-section" id="business-report" data-deep-research-primary-business-report></section>
      <section class="research-section" id="research-plan" data-deep-research-research-plan></section>
      <section class="research-section" id="analysis-cards" data-deep-research-analysis-cards></section>
      <section class="research-section" id="full-case-file" data-deep-research-full-case-file></section>
      <section class="research-section" id="process-trace" data-deep-research-process-trace></section>
    </article>
  </main>
</div>`;
