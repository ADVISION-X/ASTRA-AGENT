export const renderDeepResearchReportView = (): string => `
<div class="research-reader-shell" data-deep-research-reader-shell>
  <main class="research-reader" data-deep-research-reader data-deep-research-reader-primary>
    <section class="research-empty-state" data-deep-research-empty>
      <p class="research-kicker">Report Reader</p>
      <h2>Select a report from history</h2>
      <p class="muted">Choose a report above to open the conclusion, analysis, and evidence trace.</p>
    </section>
    <article class="research-report hidden research-reading-rhythm" data-deep-research-report>
      <header class="research-report-header" data-deep-research-report-header></header>
      <section class="research-section" id="conclusion" data-deep-research-final-card></section>
      <section class="research-section" data-deep-research-stage-overview></section>
      <section class="research-section" id="decomposition" data-deep-research-decomposition></section>
      <section class="research-section" data-deep-research-subquestions></section>
      <section class="research-section" id="final-adjudication" data-deep-research-final-adjudication></section>
      <section class="research-section" id="full-case-file" data-deep-research-full-case-file></section>
      <section class="research-section" id="business-report" data-deep-research-primary-business-report></section>
      <section class="research-section" id="evidence" data-deep-research-evidence></section>
    </article>
  </main>
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
</div>`;
