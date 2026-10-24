import { renderAppShellIcon } from "./app-shell-icons.js";

export const renderProductionRuntimeWorkspace = (): string => `
<section class="skill-workspace hidden" data-skill-workspace="production-runtime" aria-labelledby="production-runtime-title">
  <div class="skill-header">
    <span class="eyebrow">生产运行时</span>
    <h1 id="production-runtime-title">生产工厂</h1>
    <p>一次读取 Website、AGENT、Browser、Outbox 与日志各自权威；不领取、不重试、不恢复。</p>
  </div>
  <section class="panel query-panel" aria-label="任务查询">
    <form class="query-form" data-production-runtime-form novalidate>
      <div class="field">
        <label for="production-job-id">任务编号（可选）</label>
        <div class="query-row">
          <input id="production-job-id" name="jobId" autocomplete="off" spellcheck="false" placeholder="留空自动发现；多个候选时明确选择" />
          <button class="btn" type="button" data-production-status>${renderAppShellIcon("refresh")}<span>刷新真实状态</span></button>
        </div>
      </div>
    </form>
  </section>
  <dl class="metric-strip" aria-label="生产观察摘要">
    <div class="metric"><dt>观察范围</dt><dd data-production-scope data-tone="unknown">-</dd></div>
    <div class="metric"><dt>当前工单</dt><dd data-production-selected-job data-tone="unknown">-</dd></div>
    <div class="metric"><dt>诊断完整性</dt><dd data-production-completeness data-tone="unknown">-</dd></div>
    <div class="metric"><dt>观察时间</dt><dd data-production-observed-at data-tone="unknown">-</dd></div>
  </dl>
  <section class="panel matrix-panel" aria-labelledby="production-matrix-title">
    <div class="panel-header">
      <h2 id="production-matrix-title">生产真实状态矩阵</h2>
      <p class="panel-hint">点击一行查看完整证据</p>
    </div>
    <div class="matrix-shell" role="region" aria-labelledby="production-matrix-title" tabindex="0">
      <table class="matrix-table">
        <thead><tr><th scope="col">事实</th><th scope="col">Owner</th><th scope="col">当前值</th><th scope="col">原因</th><th scope="col">观察时间</th><th scope="col">新鲜度</th><th scope="col">权威 / 证据</th><th scope="col">完整性</th></tr></thead>
        <tbody data-production-observation-rows><tr><td class="matrix-empty" colspan="8">正在读取当前权威</td></tr></tbody>
      </table>
    </div>
  </section>
</section>`;
