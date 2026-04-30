import type { CommanderConsoleViewModel } from "../../types.js";
import { localizeCommanderText } from "../../locale.js";
import { escapeHtml } from "../../render-utils.js";
import { getActiveTaskTemplate } from "../../view-helpers.js";

export function renderAdvancedFields(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const activeTemplate = getActiveTaskTemplate(viewModel);

  return `<details class="cc-advanced-panel" data-advanced-fields>
    <summary>${escapeHtml(t("高级设置", "Advanced Fields"))}</summary>
    <div class="cc-advanced-grid">
      <div><span>${escapeHtml(t("任务模板 ID", "Task template ID"))}</span><strong>${escapeHtml(activeTemplate?.taskTemplateId ?? t("未选择", "unselected"))}</strong></div>
      <div><span>${escapeHtml(t("内部地图", "Internal map"))}</span><strong data-advanced-map-id>${escapeHtml(activeTemplate?.developerBinding?.mapId ?? t("未绑定", "unbound"))}</strong></div>
      <div><span>${escapeHtml(t("平台目标", "Platform target"))}</span><strong data-advanced-platform-id>${escapeHtml(activeTemplate?.developerBinding?.requestedPlatformId ?? t("未绑定", "unbound"))}</strong></div>
      <div><span>${escapeHtml(t("目标档案", "Target profile"))}</span><strong data-advanced-profile-ref>${escapeHtml(activeTemplate?.developerBinding?.targetProfileRef ?? t("未绑定", "unbound"))}</strong></div>
      <div><span>${escapeHtml(t("浏览器档案", "Browser profile"))}</span><strong>${escapeHtml(activeTemplate?.developerBinding?.platformProfileRef ?? t("未绑定", "unbound"))}</strong></div>
      <div><span>${escapeHtml(t("AI 模式", "AI mode"))}</span><strong>${escapeHtml(activeTemplate?.advancedFields.aiMode ?? t("未启用", "disabled"))}</strong></div>
      <div><span>${escapeHtml(t("日志级别", "Log level"))}</span><strong>${escapeHtml(activeTemplate?.advancedFields.logLevel ?? "debug")}</strong></div>
    </div>
    <p class="cc-note">${escapeHtml(t("这些字段只服务于开发者检查与调试，不属于普通用户启动流程。", "These fields exist only for developer inspection and debugging, not for the normal launch flow."))}</p>
  </details>`;
}