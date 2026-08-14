export const renderXuanxueAiProductionWorkspace = (): string => `
<section class="skill-workspace hidden" data-skill-workspace="xuanxue-ai-production">
  <div class="skill-header">
    <div>
      <span class="eyebrow">Local-only whole-order control</span>
      <h1>玄学 AI 生产</h1>
      <p>只按整单 orderId 查看、暂停、取消、接管或恢复；这里不允许控制阶段、标签页、选择器或坐标。</p>
    </div>
  </div>
  <section class="panel app-form-panel">
    <form class="form-grid compact-form" data-xuanxue-ai-production-form>
      <div class="field wide"><label>Order ID</label><input name="orderId" required /></div>
      <div class="field"><label>Expected revision</label><input name="expectedRevision" type="number" min="0" value="0" required /></div>
      <div class="field"><label>Request ID</label><input name="requestId" required /></div>
      <div class="field wide"><label>Reason</label><input name="reason" maxlength="1000" required /></div>
      <div class="actions wide">
        <button class="btn secondary" type="button" data-xuanxue-status>刷新状态</button>
        <button class="btn secondary" type="button" data-xuanxue-pause>安全暂停</button>
        <button class="btn secondary" type="button" data-xuanxue-takeover>人工接管</button>
        <button class="btn secondary" type="button" data-xuanxue-resume>恢复同一整单</button>
        <button class="btn" type="button" data-xuanxue-cancel>取消整单</button>
      </div>
      <div class="summary-metrics wide">
        <div><b data-xuanxue-state>-</b><span>intervention state</span></div>
        <div><b data-xuanxue-revision>-</b><span>revision</span></div>
        <div><b data-xuanxue-checkpoint>-</b><span>last safe checkpoint</span></div>
        <div><b data-xuanxue-order-status>-</b><span>order status</span></div>
      </div>
    </form>
  </section>
</section>`;
