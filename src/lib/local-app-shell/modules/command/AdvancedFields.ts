import type { CommanderConsoleViewModel } from "../../types.js";
import { localizeCommanderText } from "../../locale.js";
import { escapeHtml } from "../../render-utils.js";
import { getActiveTaskTemplate } from "../../view-helpers.js";

export function renderAdvancedFields(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const activeTemplate = getActiveTaskTemplate(viewModel);

  return `<details class="cc-advanced-panel" data-advanced-fields>
    <summary>${escapeHtml(t("启动摘要", "Launch Summary"))}</summary>
    <div class="cc-advanced-grid">
      <div><span>${escapeHtml(t("启动绑定 ID", "Launch binding ID"))}</span><strong>${escapeHtml(activeTemplate?.taskBindingId ?? t("未选择", "unselected"))}</strong></div>
      <div><span>${escapeHtml(t("任务类别", "Task category"))}</span><strong>${escapeHtml(activeTemplate?.taskCategory ?? t("未选择", "unselected"))}</strong></div>
      <div><span>${escapeHtml(t("安全级别", "Safety level"))}</span><strong>${escapeHtml(activeTemplate?.safetyLevel ?? t("未选择", "unselected"))}</strong></div>
    </div>
    <p class="cc-note">${escapeHtml(t("普通启动页不显示内部绑定、步骤、能力或 prompt 绑定字段。", "The ordinary start surface does not expose internal bindings, steps, capabilities, or prompt binding fields."))}</p>
  </details>`;
}
