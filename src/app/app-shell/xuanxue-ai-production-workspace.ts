export const renderXuanxueAiProductionWorkspace = (): string => `
<section class="skill-workspace hidden" data-skill-workspace="xuanxue-ai-production">
  <div class="skill-header">
    <div>
      <span class="eyebrow">Local production status</span>
      <h1>玄学 AI 生产</h1>
      <p>这里只读查看整单状态；暂停、取消与移交只接受网站 ControlIntentV6。</p>
    </div>
  </div>
  <section class="panel app-form-panel">
    <form class="form-grid compact-form" data-xuanxue-ai-production-form>
      <div class="field wide"><label>Order ID</label><input name="orderId" required /></div>
      <div class="actions wide">
        <button class="btn secondary" type="button" data-xuanxue-status>刷新状态</button>
      </div>
      <div class="summary-metrics wide">
        <div><b data-xuanxue-state>-</b><span>control intent</span></div>
        <div><b data-xuanxue-revision>-</b><span>control epoch</span></div>
        <div><b data-xuanxue-checkpoint>-</b><span>last safe checkpoint</span></div>
        <div><b data-xuanxue-order-status>-</b><span>order status</span></div>
      </div>
    </form>
  </section>
</section>`;
