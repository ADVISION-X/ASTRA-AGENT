import type { CommanderAppViewModel } from "../commander-app.types.js";
import { renderPageHeader } from "../layout/PageHeader.js";
import { localizeCommanderText } from "../locale.js";
import { escapeHtml, joinHtml, renderCard, renderEmptyState } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";

const CONTROL_STYLE = "width:100%;min-width:0;min-height:var(--cc-input-height);border:1px solid var(--cc-border-strong);border-radius:14px;background:rgba(255,255,255,0.92);padding:0 var(--cc-space-3);color:var(--cc-ink);font:600 var(--cc-text-md)/1 var(--cc-font-ui);";

function renderProviderSettingsCard(t: (zh: string, en: string) => string): string {
  return renderCard(
    t("AI 设置", "AI Settings"),
    t("只保存必要信息", "Only the essentials"),
    `<form class="cc-stack" data-ai-provider-settings-form>
      <p class="cc-note" data-ai-provider-settings-status>${escapeHtml(t("正在读取 AI 状态。", "Loading AI status."))}</p>
      <div class="cc-run-limit-grid">
        <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("AI 名称", "AI Name"))}</span><input name="displayName" type="text" placeholder="Google Gemini" autocomplete="off" /></label>
        <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("模型", "Model"))}</span><select name="modelName" style="${CONTROL_STYLE}" data-ai-provider-model><option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option><option value="gemini-2.5-flash">Gemini 2.5 Flash</option><option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option></select></label>
      </div>
      <label class="cc-field"><span class="cc-section-title">Google Gemini API Key</span><input name="apiKey" type="password" autocomplete="new-password" spellcheck="false" placeholder="AIza..." data-ai-provider-api-key /></label>
      <div class="cc-inline-actions">
        <button type="submit" class="cc-button cc-button-primary" data-ai-provider-settings-busy-sensitive>${escapeHtml(t("保存 AI", "Save AI"))}</button>
        <button type="button" class="cc-button" data-ai-provider-settings-refresh data-ai-provider-settings-busy-sensitive>${escapeHtml(t("刷新状态", "Refresh State"))}</button>
      </div>
      <p class="cc-muted">${escapeHtml(t("密匙只写入本机受保护配置文件，页面只显示掩码；不会写入日志、proof、截图、地图包或终端输出。运行链路只调用在线 Gemini，不再调用本地 AI。", "The key is written only to a protected local config file and only a masked value is shown. It is never written to logs, proofs, screenshots, map packages, or terminal output. Runtime uses online Gemini only."))}</p>
    </form>`,
  );
}

function renderSavedAiCard(t: (zh: string, en: string) => string): string {
  return renderCard(
    t("已保存 AI", "Saved AI"),
    t("可查看、编辑、删除", "View, edit, delete"),
    `<div class="cc-stack">
      <div data-ai-provider-settings-summary>${renderEmptyState(t("正在读取已保存 AI。", "Loading saved AI."))}</div>
      <div class="cc-inline-actions">
        <button type="button" class="cc-button" data-ai-provider-settings-refresh data-ai-provider-settings-busy-sensitive>${escapeHtml(t("查看状态", "View Status"))}</button>
        <button type="button" class="cc-button" data-ai-provider-settings-refresh data-ai-provider-settings-busy-sensitive>${escapeHtml(t("刷新", "Refresh"))}</button>
        <button type="button" class="cc-button cc-button-danger" disabled="disabled">${escapeHtml(t("删除", "Delete"))}</button>
      </div>
      <p class="cc-muted">${escapeHtml(t("当前只开放保存和状态查看；删除动作稍后接入本机 Secret Store 删除接口。", "This build supports saving and status checks; delete will be enabled after the local Secret Store delete endpoint lands."))}</p>
    </div>`,
  );
}

function renderLocalRuntimeCard(t: (zh: string, en: string) => string): string {
  return renderCard(
    t("AI 运行链路", "AI Runtime"),
    t("只读状态", "Read-only status"),
    `<div class="cc-stack">
      <div class="cc-detail-block">
        <span>${escapeHtml(t("在线 AI", "Online AI"))}</span>
        <strong data-ai-provider-settings-status>${escapeHtml(t("正在读取。", "Loading."))}</strong>
      </div>
      <p class="cc-muted">${escapeHtml(t("本地 AI 已从主链路移除。截图、格子、点击和证据仍然本地执行；视觉判断只走在线 Gemini。", "Local AI has been removed from the main path. Screenshots, grids, clicks, and evidence stay local; visual judgment uses online Gemini only."))}</p>
    </div>`,
  );
}

function renderPreferenceCard(t: (zh: string, en: string) => string): string {
  return renderCard(
    t("使用偏好", "Preferences"),
    t("低频设置", "Low-frequency settings"),
    `<div class="cc-stack">
      <div class="cc-run-limit-grid">
        <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("语言", "Language"))}</span><select style="${CONTROL_STYLE}" data-settings-locale-select><option value="zh">中文</option><option value="en">English</option></select></label>
        <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("证据保存", "Evidence Storage"))}</span><input value="${escapeHtml(t("本地受治理目录", "Local governed directory"))}" disabled="disabled" /></label>
      </div>
      <p class="cc-muted">${escapeHtml(t("设置页只放低频配置，不放任务启动、调试模式或内部地图字段。", "Settings only contains low-frequency configuration, not launch controls, debug modes, or internal map fields."))}</p>
    </div>`,
  );
}

function renderRunLimitSettingsCard(t: (zh: string, en: string) => string): string {
  return renderCard(
    t("启动默认值", "Launch Defaults"),
    t("APP 自己管，不归地图", "App-owned, never map-owned"),
    `<form class="cc-stack" data-app-run-limit-settings-form>
      <p class="cc-note" data-app-run-limit-settings-status>${escapeHtml(t("正在读取启动默认值。", "Loading launch defaults."))}</p>
      <div class="cc-run-limit-grid">
        <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("默认运行时长", "Default duration"))}</span><input name="defaultMaxMinutes" type="number" min="1" placeholder="480" /></label>
        <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("默认最多处理轮次", "Default max processing rounds"))}</span><input name="defaultMaxRounds" type="number" min="1" placeholder="300" /></label>
      </div>
      <div class="cc-inline-actions">
        <button type="submit" class="cc-button cc-button-primary">${escapeHtml(t("保存默认值", "Save Defaults"))}</button>
        <button type="button" class="cc-button" data-app-run-limit-refresh>${escapeHtml(t("刷新", "Refresh"))}</button>
      </div>
      <div data-app-run-limit-settings-summary>${renderEmptyState(t("正在读取默认值摘要。", "Loading defaults summary."))}</div>
      <p class="cc-muted">${escapeHtml(t("这两个数字只决定开始页预填值。地图包不得再声明默认值、最大值或任何钳制策略；用户在开始页可以临时改成任意正整数。", "These values only seed the start page. Map packages must no longer declare defaults, maxima, or clamp policy; operators can override them with any positive integers on the start page."))}</p>
    </form>`,
  );
}

export function renderSettingsPage(viewModel: CommanderConsoleViewModel, _appViewModel: CommanderAppViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  return joinHtml([
    `<section class="cc-page" data-app-page="settings" data-ai-provider-settings-page data-app-run-limit-settings-page>`,
    renderPageHeader(
      t("设置", "Settings"),
      t("只保留用户真正需要配置的内容：在线 AI、启动默认值、语言和证据偏好。", "Only keep what users really configure: online AI, launch defaults, language, and evidence preferences."),
    ),
    `<div class="cc-page-stack">`,
    `<div class="cc-home-grid">${renderProviderSettingsCard(t)}${renderSavedAiCard(t)}</div>`,
    `<div class="cc-home-grid">${renderRunLimitSettingsCard(t)}${renderPreferenceCard(t)}</div>`,
    `<div class="cc-home-grid">${renderLocalRuntimeCard(t)}</div>`,
    `</div>`,
    `</section>`,
  ]);
}
