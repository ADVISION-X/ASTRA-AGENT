import { localizeCommanderText } from "../locale.js";
import { escapeHtml, renderEmptyState } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";

export function renderRightInspector(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);

  return `<div class="cc-right-inspector-shell" data-inspect-modal hidden="hidden" aria-hidden="true">
    <button type="button" class="cc-inspector-backdrop" data-close-inspect aria-label="${escapeHtml(t("关闭检查详情", "Close inspect details"))}"></button>
    <aside class="cc-right-inspector" role="dialog" aria-modal="true" aria-label="${escapeHtml(t("右侧检查面板", "Right inspector"))}">
      <header class="cc-right-inspector-header">
        <div>
          <p class="cc-eyebrow">${escapeHtml(t("检查面板", "Inspector"))}</p>
          <h2 data-inspect-title>${escapeHtml(t("等待查看详情", "Waiting for inspect detail"))}</h2>
          <p class="cc-muted" data-inspect-subtitle>${escapeHtml(t("右侧只读检查面默认关闭。", "The read-only right inspector stays closed by default."))}</p>
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
        ${renderEmptyState(t("点击详情后，检查面板才会展开。", "The inspector opens only after you click into a detail."))}
      </section>
    </aside>
  </div>`;
}