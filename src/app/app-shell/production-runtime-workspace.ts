import { appShellProductionPluginSupport } from "../../lib/local-runtime/production/catalog.js";

export const renderProductionRuntimeWorkspace = (): string => `
<section class="skill-workspace hidden" data-skill-workspace="production-runtime">
  <div class="skill-header">
    <div>
      <span class="eyebrow">生产运行时</span>
      <h1>生产工厂</h1>
      <p>这里只读展示任务、插件身份和故障状态；网站负责业务发单与最终入库。</p>
    </div>
  </div>
  <section class="panel app-form-panel">
    <form class="form-grid compact-form" data-production-runtime-form>
      <div class="field wide"><label>任务编号</label><input name="jobId" required /></div>
      <div class="actions wide"><button class="btn secondary" type="button" data-production-status>刷新状态</button></div>
      <div class="summary-metrics wide">
        <div><b data-production-task-status>-</b><span>任务状态</span></div>
        <div><b data-production-plugin-id>-</b><span>插件</span></div>
        <div><b data-production-plugin-version>-</b><span>版本</span></div>
        <div><b data-production-failure>-</b><span>故障</span></div>
      </div>
      <div class="field wide" data-production-atomic-steps>
        <label>浏览器原子步骤（步骤 / 子能力 / 序号 / 前置 / 发送 / 后置 / 终态 / 证据）</label>
        <div class="listing-edit-read-table-shell">
          <table class="compact-data-table">
            <thead><tr><th>步骤</th><th>子能力</th><th>序号</th><th>前置</th><th>发送</th><th>后置</th><th>终态</th><th>证据定位</th></tr></thead>
            <tbody data-production-atomic-step-rows><tr><td colspan="8">尚未读取任务</td></tr></tbody>
          </table>
        </div>
      </div>
      <div class="field wide"><label>目录支持范围</label><pre>${JSON.stringify(appShellProductionPluginSupport, null, 2)}</pre></div>
    </form>
  </section>
</section>`;
