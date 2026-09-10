export const renderProductionRuntimeWorkspace = (): string => `
<section class="skill-workspace hidden" data-skill-workspace="production-runtime">
  <div class="skill-header">
    <div>
      <span class="eyebrow">生产运行时</span>
      <h1>生产工厂</h1>
      <p>一次读取 Website、AGENT、Browser、Outbox 与日志各自权威；不领取、不重试、不恢复。</p>
    </div>
  </div>
  <section class="panel app-form-panel">
    <form class="form-grid compact-form" data-production-runtime-form>
      <div class="field wide"><label>任务编号（可选）</label><input name="jobId" placeholder="留空自动发现；多个候选时明确选择" /></div>
      <div class="actions wide"><button class="btn secondary" type="button" data-production-status>刷新真实状态</button></div>
      <div class="summary-metrics wide">
        <div><b data-production-scope>-</b><span>观察范围</span></div>
        <div><b data-production-selected-job>-</b><span>当前工单</span></div>
        <div><b data-production-completeness>-</b><span>诊断完整性</span></div>
        <div><b data-production-observed-at>-</b><span>观察时间</span></div>
      </div>
      <div class="field wide">
        <label>生产真实状态矩阵（点击一行查看完整证据）</label>
        <div class="listing-edit-read-table-shell">
          <table class="compact-data-table">
            <thead><tr><th>事实</th><th>Owner</th><th>当前值</th><th>原因</th><th>观察时间</th><th>新鲜度</th><th>权威 / 证据</th><th>完整性</th></tr></thead>
            <tbody data-production-observation-rows><tr><td colspan="8">正在读取当前权威</td></tr></tbody>
          </table>
        </div>
      </div>
    </form>
  </section>
</section>`;
