import { localizeCommanderText } from "../locale.js";
import { escapeHtml, renderEmptyState } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";

export function renderInspectModal(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);

  return `<div class="cc-inspect-modal" data-inspect-modal hidden="hidden" aria-hidden="true">
    <div class="cc-inspect-backdrop" data-close-inspect></div>
    <aside class="cc-inspect-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(t("检查详情", "Inspect details"))}">
      <header class="cc-inspect-header">
        <div>
          <p class="cc-eyebrow">${escapeHtml(t("三级详情", "Level 3 Detail"))}</p>
          <h2 data-inspect-title>${escapeHtml(t("等待查看详情", "Waiting for inspect detail"))}</h2>
          <p class="cc-muted" data-inspect-subtitle>${escapeHtml(t("点击 Inspect 或 Debug Bundle 后再打开。", "Open after clicking Inspect or Debug Bundle."))}</p>
        </div>
        <div class="cc-inline-actions">
          <button type="button" class="cc-button cc-button-tight" data-copy-inspect-json>${escapeHtml(t("复制 JSON", "Copy JSON"))}</button>
          <button type="button" class="cc-button cc-button-tight" data-close-inspect>${escapeHtml(t("关闭", "Close"))}</button>
        </div>
      </header>
      <section class="cc-inspect-meta">
        <div><span>${escapeHtml(t("归属", "Owner"))}</span><strong data-inspect-owner>${escapeHtml(t("等待来源", "Awaiting source"))}</strong></div>
        <div><span>${escapeHtml(t("摘要", "Summary"))}</span><strong data-inspect-summary>${escapeHtml(t("尚未选择对象。", "No inspect target selected yet."))}</strong></div>
      </section>
      <section class="cc-inspect-section">
        <h3>${escapeHtml(t("引用", "References"))}</h3>
        <div data-inspect-refs>${renderEmptyState(t("当前还没有展开的检查对象。", "No inspect target is open yet."))}</div>
      </section>
      <section class="cc-inspect-section cc-inspect-body" data-inspect-body>
        ${renderEmptyState(t("Inspect 默认关闭，只在你主动点击后显示。", "Inspect stays closed by default and opens only when you click into it."))}
      </section>
    </aside>
  </div>`;
}