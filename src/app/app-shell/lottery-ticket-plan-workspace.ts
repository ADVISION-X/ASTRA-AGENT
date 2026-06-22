export const renderLotteryTicketPlanWorkspace = (): string => `
<section class="skill-workspace hidden" data-skill-workspace="lottery-ticket-plan" data-job-panel="lottery-ticket-plan">
  <div class="skill-header">
    <div>
      <span class="eyebrow">Local Plan Generator</span>
      <h1>Lottery Ticket Plan</h1>
      <p>Generate local Pick3 upper/lower ticket plans for manual review.</p>
    </div>
    <span class="status-badge status-active">manual only</span>
  </div>
  <nav class="skill-page-nav" data-workspace-page-nav="lottery-ticket-plan" aria-label="Lottery Ticket Plan pages">
    <button class="skill-page-tab" type="button" data-workspace-page="plan" data-workspace-page-skill="lottery-ticket-plan" aria-pressed="true">Plan</button>
    <button class="skill-page-tab" type="button" data-workspace-page="audit" data-workspace-page-skill="lottery-ticket-plan" aria-pressed="false">Boundary</button>
  </nav>
  <div class="skill-page-stack secondary-page-stack">
    <section class="skill-page-surface" data-workspace-surface="plan" data-workspace-surface-skill="lottery-ticket-plan">
      <section class="panel app-form-panel">
        <form class="form-grid compact-form" data-lottery-ticket-plan-form>
          <input name="game" type="hidden" value="pick3" />
          <div class="field"><label>Hundreds</label><select name="hundreds"><option value="upper">upper 5-9</option><option value="lower">lower 0-4</option></select></div>
          <div class="field"><label>Tens</label><select name="tens"><option value="upper">upper 5-9</option><option value="lower">lower 0-4</option></select></div>
          <div class="field"><label>Ones</label><select name="ones"><option value="upper">upper 5-9</option><option value="lower">lower 0-4</option></select></div>
          <div class="field"><label>Entry cost</label><input name="entryCost" type="number" min="0.01" step="0.01" value="5" required /></div>
          <div class="notice wide" data-lottery-ticket-plan-boundary>
            <b>Manual purchase only</b>
            <span>This page generates a local plan. It does not click, add to My Plan, checkout, login, or pay on any lottery website.</span>
          </div>
          <div class="actions wide"><button class="btn" type="submit">Generate 125 tickets</button></div>
        </form>
      </section>
      <section class="panel history-panel" data-lottery-ticket-plan-result>
        <div class="panel-title-row">
          <div><span class="eyebrow">Generated Plan</span><h2 data-lottery-ticket-plan-title>No plan generated</h2></div>
          <span class="status-badge status-active" data-lottery-ticket-plan-count>0</span>
        </div>
        <div class="detail-grid inspector-detail-grid">
          <div><b>Ticket hash</b><span data-lottery-ticket-plan-hash>-</span></div>
          <div><b>Total cost</b><span data-lottery-ticket-plan-cost>-</span></div>
          <div><b>Manual only</b><span data-lottery-ticket-plan-manual>-</span></div>
        </div>
        <div class="record-list compact-record-list" data-lottery-ticket-plan-list></div>
      </section>
    </section>
    <section class="skill-page-surface hidden" data-workspace-surface="audit" data-workspace-surface-skill="lottery-ticket-plan">
      <section class="panel empty-state app-empty-surface">
        <span class="eyebrow">Blocked Boundary</span>
        <h2>No wagering-site automation</h2>
        <p>The lawful output is a local review list only. Official My Plan, cart, checkout, login, cookies, and payment are outside this owner.</p>
      </section>
    </section>
  </div>
</section>`;
