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
        <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("AI 名称", "AI Name"))}</span><input name="displayName" type="text" placeholder="${escapeHtml(t("例如：地图生成 AI", "Example: Map Authoring AI"))}" /></label>
        <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("AI 公司", "AI Company"))}</span><select name="providerCompany" style="${CONTROL_STYLE}" data-ai-provider-company><option value="openai">OpenAI</option><option value="deepseek">DeepSeek</option><option value="openrouter">OpenRouter</option></select></label>
      </div>
      <label class="cc-field"><span class="cc-section-title">API Key</span><input name="apiKey" type="password" autocomplete="off" placeholder="sk-..." /></label>
      <input name="providerKind" type="hidden" value="openai-compatible" />
      <input name="baseUrl" type="hidden" value="" />
      <input name="model" type="hidden" value="" />
      <input name="allowPaidProvider" type="hidden" value="true" />
      <input name="allowExternalTransmission" type="hidden" value="true" />
      <input name="maxEstimatedCost" type="hidden" value="5" />
      <input name="operatorApprovalRef" type="hidden" value="approval://settings/ai-provider/operator" />
      <input name="approvalReason" type="hidden" value="operator saved AI provider from Settings" />
      <div class="cc-inline-actions">
        <button type="submit" class="cc-button cc-button-primary" data-ai-provider-settings-busy-sensitive>${escapeHtml(t("保存 AI", "Save AI"))}</button>
        <button type="button" class="cc-button" data-ai-provider-settings-refresh data-ai-provider-settings-busy-sensitive>${escapeHtml(t("刷新状态", "Refresh State"))}</button>
      </div>
      <p class="cc-muted">${escapeHtml(t("只需要填写名称、AI 公司和密匙；服务地址与模型由系统按公司内置映射处理。明文 key 不回显到页面、终端、proof 或地图包。", "Only name, AI company, and key are required. Endpoint and model are mapped internally. The raw key is never echoed to UI, terminal, proof, or map packages."))}</p>
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
        <button type="button" class="cc-button" data-ai-provider-settings-refresh data-ai-provider-settings-busy-sensitive>${escapeHtml(t("编辑", "Edit"))}</button>
        <button type="button" class="cc-button cc-button-danger" disabled="disabled">${escapeHtml(t("删除", "Delete"))}</button>
      </div>
      <p class="cc-muted">${escapeHtml(t("当前构建先开放保存和状态查看；删除动作会在本地 Secret Store 删除接口完成后启用。", "This build supports saving and status checks first; delete will be enabled after the local Secret Store delete endpoint lands."))}</p>
    </div>`,
  );
}

function renderLocalRuntimeCard(t: (zh: string, en: string) => string): string {
  return renderCard(
    t("本地运行", "Local Runtime"),
    t("只读状态", "Read-only status"),
    `<div class="cc-stack">
      <div class="cc-detail-block">
        <span>${escapeHtml(t("本地 AI", "Local AI"))}</span>
        <strong data-ai-provider-settings-status>${escapeHtml(t("正在读取。", "Loading."))}</strong>
      </div>
      <p class="cc-muted">${escapeHtml(t("完整启动、依赖和结构化日志仍然在终端中查看；页面只保留必要状态。", "Full startup, dependency, and structured logs stay in the terminal; the page keeps only essential status."))}</p>
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
      t("只保留用户真正需要配置的内容：AI、本地运行状态、启动默认值、语言和证据偏好。", "Only keep what users really configure: AI, local runtime status, launch defaults, language, and evidence preferences."),
    ),
    `<div class="cc-page-stack">`,
    `<div class="cc-home-grid">${renderProviderSettingsCard(t)}${renderSavedAiCard(t)}</div>`,
    `<div class="cc-home-grid">${renderRunLimitSettingsCard(t)}${renderPreferenceCard(t)}</div>`,
    `<div class="cc-home-grid">${renderLocalRuntimeCard(t)}</div>`,
    `</div>`,
    `</section>`,
  ]);
}
