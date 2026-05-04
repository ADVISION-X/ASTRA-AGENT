import type { CommanderAppViewModel } from "../commander-app.types.js";
import { renderPageHeader } from "../layout/PageHeader.js";
import { localizeCommanderText } from "../locale.js";
import { escapeHtml, joinHtml, renderCard, renderEmptyState } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";

const CONTROL_STYLE = "width:100%;min-width:0;min-height:var(--cc-input-height);border:1px solid var(--cc-border-strong);border-radius:14px;background:rgba(255,255,255,0.92);padding:0 var(--cc-space-3);color:var(--cc-ink);font:600 var(--cc-text-md)/1 var(--cc-font-ui);";

function renderProviderSettingsCard(t: (zh: string, en: string) => string): string {
  return renderCard(
    t("高级 AI Provider 设置", "Advanced AI Provider Settings"),
    t("AI Capability / paid-analysis-ai", "AI Capability / paid-analysis-ai"),
    `<form class="cc-stack" data-ai-provider-settings-form>
      <p class="cc-note" data-ai-provider-settings-status>${escapeHtml(t("正在读取 provider readiness。", "Loading provider readiness."))}</p>
      <div class="cc-run-limit-grid">
        <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("显示名称", "Display Name"))}</span><input name="displayName" type="text" placeholder="OpenAI compatible map authoring" /></label>
        <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("Provider Kind", "Provider Kind"))}</span><select name="providerKind" style="${CONTROL_STYLE}"><option value="openai-compatible">OpenAI Compatible</option></select></label>
      </div>
      <div class="cc-run-limit-grid">
        <label class="cc-field"><span class="cc-section-title">Base URL</span><input name="baseUrl" type="url" inputmode="url" placeholder="https://api.example.com/v1" /></label>
        <label class="cc-field"><span class="cc-section-title">Model</span><input name="model" type="text" placeholder="gpt-4.1-mini" /></label>
      </div>
      <label class="cc-field"><span class="cc-section-title">API Key</span><input name="apiKey" type="password" autocomplete="off" placeholder="sk-..." /></label>
      <div class="cc-run-limit-grid">
        <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("允许付费 Provider", "Allow Paid Provider"))}</span><select name="allowPaidProvider" style="${CONTROL_STYLE}"><option value="true">true</option><option value="false">false</option></select></label>
        <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("允许外部传输", "Allow External Transmission"))}</span><select name="allowExternalTransmission" style="${CONTROL_STYLE}"><option value="true">true</option><option value="false">false</option></select></label>
      </div>
      <div class="cc-run-limit-grid">
        <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("Cost Max", "Cost Max"))}</span><input name="maxEstimatedCost" type="number" min="0.01" step="0.01" value="5" /></label>
        <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("Operator Approval Ref", "Operator Approval Ref"))}</span><input name="operatorApprovalRef" type="text" placeholder="approval://map-lab/provider/operator" /></label>
      </div>
      <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("批准原因", "Approval Reason"))}</span><input name="approvalReason" type="text" placeholder="operator approved external map authoring" /></label>
      <div class="cc-inline-actions">
        <button type="submit" class="cc-button cc-button-primary" data-map-lab-busy-sensitive>${escapeHtml(t("保存 AI Provider 设置", "Save AI Provider Settings"))}</button>
        <button type="button" class="cc-button" data-map-lab-refresh data-map-lab-busy-sensitive>${escapeHtml(t("刷新状态", "Refresh State"))}</button>
      </div>
      <p class="cc-muted">${escapeHtml(t("保存后页面只显示 configured、secretRef 与 last4；明文 key 不会回显到 UI、终端、proof 或 map package。", "After saving, the UI only shows configured, secretRef, and last4. The raw key is never echoed to UI, terminal, proof, or map packages."))}</p>
    </form>`,
  );
}

export function renderAiProviderSettingsPage(viewModel: CommanderConsoleViewModel, _appViewModel: CommanderAppViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  return joinHtml([
    `<section class="cc-page" data-app-page="ai-provider-settings" data-ai-provider-settings-page>`,
    renderPageHeader(
      t("AI Provider 设置", "AI Provider Settings"),
      t("配置 AI Capability 受治理 paid-analysis-ai，不把 secret 带回 Map Lab 操作页。", "Configure the AI Capability governed paid-analysis-ai without bringing secrets back into the Map Lab authoring page."),
    ),
    `<div class="cc-page-stack">`,
    `<div class="cc-home-grid">${renderProviderSettingsCard(t)}${renderCard(t("只读摘要", "Readiness Summary"), t("Provider / Policy / Secret", "Provider / Policy / Secret"), `<div data-map-lab-provider-summary>${renderEmptyState(t("正在读取 provider 摘要。", "Loading provider summary."))}</div>`)}</div>`,
    `</div>`,
    `</section>`,
  ]);
}
