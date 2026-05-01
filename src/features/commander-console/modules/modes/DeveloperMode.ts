import type { CommanderConsoleViewModel } from "../../types.js";
import { localizeCommanderText } from "../../locale.js";
import { renderDataTable } from "../../render-advanced-utils.js";
import { escapeHtml, renderCard, renderStatusPill } from "../../render-utils.js";

import { renderAdvancedFields } from "../command/AdvancedFields.js";

function renderHealthCard(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const rows = viewModel.capabilityHealth.map((entry) => [
    escapeHtml(entry.label),
    renderStatusPill(entry.tone, entry.tone === "danger" ? "blocked" : entry.tone === "warn" ? "attention" : "ok"),
    escapeHtml(entry.detail),
  ]);
  return renderCard(t("能力健康", "Capability Health"), t("开发者模式", "Developer Mode"), renderDataTable([
    t("能力组", "Capability"),
    t("状态", "Status"),
    t("说明", "Detail"),
  ], rows, t("暂无能力健康记录。", "No capability health records.")));
}

function renderLogPreviewCard(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const rows = viewModel.runtimeProofTimeline.slice(0, 8).map((entry, index) => [
    escapeHtml(entry.createdAt),
    escapeHtml(entry.step),
    escapeHtml(entry.status),
    `<button type="button" class="cc-inline-button" data-inspect-kind="round" data-inspect-id="${escapeHtml(`${entry.step}-${index}`)}">${escapeHtml(t("检查", "Inspect"))}</button>`,
  ]);
  return renderCard(t("结构化日志预览", "Structured Log Preview"), t("开发者模式", "Developer Mode"), renderDataTable([
    t("时间", "Time"),
    t("步骤", "Step"),
    t("状态", "Status"),
    t("调试包", "Debug Bundle"),
  ], rows, t("当前没有运行日志。", "No runtime logs are available.")));
}

export function renderDeveloperMode(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);

  return `<section class="cc-mode-surface cc-developer-surface" data-mode-surface="developer" hidden="hidden">
    <div class="cc-page-grid">
      <div class="cc-span-12">
        ${renderCard(
          t("Developer Mode", "Developer Mode"),
          t("显式隔离", "Explicit Separation"),
          `<div class="cc-stack">
            <p class="cc-note">${escapeHtml(t("这里只有开发者字段、内部绑定、结构化日志和检查入口。普通模式不会显示这些系统字段。", "This area is the only place for developer-only fields, internal bindings, structured logs, and inspect paths. Normal mode does not show these system fields."))}</p>
            ${renderAdvancedFields(viewModel)}
          </div>`,
          `<button type="button" class="cc-button" data-mode-toggle>${escapeHtml(t("关闭开发者模式", "Close Developer Mode"))}</button>`,
        )}
      </div>
      <div class="cc-span-6">
        ${renderHealthCard(viewModel)}
      </div>
      <div class="cc-span-6">
        ${renderLogPreviewCard(viewModel)}
      </div>
    </div>
  </section>`;
}