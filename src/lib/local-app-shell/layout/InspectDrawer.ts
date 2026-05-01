import { renderInspectEvidenceDetails } from "../inspect/renderInspectEvidenceDetails.js";
import { renderInspectMapDetails } from "../inspect/renderInspectMapDetails.js";
import { renderInspectRoundDetails } from "../inspect/renderInspectRoundDetails.js";
import { localizeCommanderText } from "../locale.js";
import type { CommanderConsoleInspectItem, CommanderConsoleViewModel } from "../types.js";
import { escapeHtml, renderEmptyState } from "../render-utils.js";

function renderInspectBody(item: CommanderConsoleInspectItem): string {
  if (item.kind === "map") {
    return renderInspectMapDetails(item);
  }

  if (item.kind === "round" || item.kind === "log") {
    return renderInspectRoundDetails(item);
  }

  return renderInspectEvidenceDetails(item);
}

export function renderInspectDrawer(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  if (viewModel.inspectItems.length === 0) {
    return `<aside class="cc-inspect-drawer">${renderEmptyState(t("当前没有可检查对象。", "No inspect targets are available."))}</aside>`;
  }

  return `<aside class="cc-inspect-drawer is-idle" data-drawer-root>
    <header class="cc-drawer-header">
      <div>
        <p class="cc-eyebrow">${escapeHtml(t("三级检查", "Level 3 Inspect"))}</p>
        <h2 data-drawer-title>${escapeHtml(t("等待检查对象", "Waiting for an inspect target"))}</h2>
        <p class="cc-muted" data-drawer-subtitle>${escapeHtml(t("点击结果、复核项、错误卡或调试包后，这里才会展开详情。", "This drawer opens details only after you click a result, review item, error card, or debug bundle."))}</p>
      </div>
      <div class="cc-inline-actions">
        <button type="button" class="cc-button" data-drawer-close>${escapeHtml(t("收起", "Collapse"))}</button>
        <button type="button" class="cc-button" data-drawer-expand>${escapeHtml(t("全屏", "Fullscreen"))}</button>
        <span class="cc-drawer-badge">${escapeHtml(t("已打开", "Open"))}</span>
      </div>
    </header>
    <section class="cc-drawer-section">
      <h3>${escapeHtml(t("已选对象", "Selected Object"))}</h3>
      <div class="cc-drawer-grid">
        <div><span>${escapeHtml(t("对象", "object"))}</span><strong data-drawer-title-inline>${escapeHtml(t("尚未选择", "nothing selected"))}</strong></div>
        <div><span>${escapeHtml(t("归属", "owner"))}</span><strong data-drawer-owner>${escapeHtml(t("等待来源", "awaiting source"))}</strong></div>
      </div>
      <p class="cc-note" data-drawer-summary>${escapeHtml(t("主工作区默认保持低密度。只有当你主动检查某个对象时，这里才会显示内部引用和 JSON 快照。", "The main workspace stays low density by default. Internal refs and JSON snapshots appear here only after you intentionally inspect an object."))}</p>
    </section>
    <section class="cc-drawer-section">
      <h3>${escapeHtml(t("为什么存在这个面板", "Why this panel exists"))}</h3>
      <p class="cc-note">${escapeHtml(t("深信息不塞进主工作区。点击地图、证明、记录、轮次或复核对象时，详细 JSON、引用和归属层级只在这里展开。", "Deep details stay out of the main workspace. Maps, proofs, records, rounds, and reviews expand here with JSON, refs, and owner hierarchy."))}</p>
    </section>
    <section class="cc-drawer-section">
      <h3>${escapeHtml(t("引用", "References"))}</h3>
      <div class="cc-drawer-ref" data-drawer-references>${renderEmptyState(t("当前还没有展开的检查对象。", "No inspect target is open yet."))}</div>
    </section>
    <section class="cc-drawer-section">
      <h3>${escapeHtml(t("JSON 快照", "JSON Snapshot"))}</h3>
      <div data-drawer-body>${renderEmptyState(t("点击 Inspect 或 Open Debug Bundle 后，这里会显示结构化调试包。", "Click Inspect or Open Debug Bundle to show the structured debug bundle here."))}</div>
    </section>
    <div class="cc-inline-actions cc-drawer-actions">
      <button type="button" class="cc-button" data-copy-inspect-json>${escapeHtml(t("复制 JSON", "Copy JSON"))}</button>
    </div>
  </aside>`;
}