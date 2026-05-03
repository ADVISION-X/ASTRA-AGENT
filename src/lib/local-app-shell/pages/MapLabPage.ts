import type { CommanderAppViewModel } from "../commander-app.types.js";
import { renderPageHeader } from "../layout/PageHeader.js";
import { localizeCommanderText } from "../locale.js";
import { escapeHtml, joinHtml, renderCard, renderEmptyState } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";

const CONTROL_STYLE = "width:100%;min-width:0;min-height:var(--cc-input-height);border:1px solid var(--cc-border-strong);border-radius:14px;background:rgba(255,255,255,0.92);padding:0 var(--cc-space-3);color:var(--cc-ink);font:600 var(--cc-text-md)/1 var(--cc-font-ui);";
const TEXTAREA_STYLE = "width:100%;min-width:0;min-height:132px;border:1px solid var(--cc-border-strong);border-radius:14px;background:rgba(255,255,255,0.92);padding:12px var(--cc-space-3);color:var(--cc-ink);font:600 var(--cc-text-md)/1.5 var(--cc-font-ui);resize:vertical;";

function renderProviderCard(t: (zh: string, en: string) => string): string {
  return renderCard(
    t("高级 AI Provider", "Paid AI Provider"),
    t("本地安全存储", "Local Secret Store"),
    `<form class="cc-stack" data-map-lab-provider-form>
      <p class="cc-note" data-map-lab-provider-status>${escapeHtml(t("正在读取 provider 状态。", "Loading provider state."))}</p>
      <div class="cc-run-limit-grid">
        <label class="cc-field"><span class="cc-section-title">Base URL</span><input name="baseUrl" type="url" inputmode="url" placeholder="https://api.example.com/v1" /></label>
        <label class="cc-field"><span class="cc-section-title">Model</span><input name="model" type="text" placeholder="gpt-4.1-mini" /></label>
      </div>
      <label class="cc-field"><span class="cc-section-title">API Key</span><input name="apiKey" type="password" autocomplete="off" placeholder="sk-..." /></label>
      <div class="cc-inline-actions">
        <button type="submit" class="cc-button cc-button-primary" data-map-lab-busy-sensitive>${escapeHtml(t("保存 Provider", "Save Provider"))}</button>
        <button type="button" class="cc-button" data-map-lab-refresh data-map-lab-busy-sensitive>${escapeHtml(t("刷新状态", "Refresh State"))}</button>
      </div>
      <p class="cc-muted">${escapeHtml(t("API key 只会本地保存到受治理 secretRef，不会再以明文回显。", "The API key is stored locally behind a governed secretRef and is never echoed back in plaintext."))}</p>
    </form>`,
  );
}

function renderWorkflowCard(t: (zh: string, en: string) => string): string {
  return renderCard(
    t("闭环状态", "Closed Loop Status"),
    t("描述 → 草稿 → 确认 → 激活 → 运行", "Describe -> Draft -> Confirm -> Activate -> Run"),
    `<div class="cc-stack">
      <div class="cc-stat-grid" data-map-lab-stats>
        <div class="cc-stat-tile"><span>${escapeHtml(t("草稿目录", "Draft Catalog"))}</span><strong>--</strong></div>
        <div class="cc-stat-tile"><span>${escapeHtml(t("可运行地图", "Runnable Maps"))}</span><strong>--</strong></div>
      </div>
      <div class="cc-detail-block">
        <span>${escapeHtml(t("下一步", "Next Step"))}</span>
        <strong data-map-lab-next-action>${escapeHtml(t("正在读取 Map Lab 状态。", "Loading Map Lab state."))}</strong>
      </div>
      <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("审批人标识", "Approval Actor"))}</span><input name="approvedBy" type="text" value="local-operator" data-map-lab-approved-by /></label>
      <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("激活原因", "Activation Reason"))}</span><input name="activationReason" type="text" value="operator_confirmed_map_lab_draft" data-map-lab-activation-reason /></label>
      <div class="cc-inline-actions">
        <button type="button" class="cc-button" data-map-lab-open-start>${escapeHtml(t("回到开始页选择运行", "Open Start Surface"))}</button>
      </div>
    </div>`,
  );
}

function renderGenerateCard(t: (zh: string, en: string) => string): string {
  return renderCard(
    t("需求生成地图", "Generate Map From Goal"),
    t("自然语言输入", "Natural Language Input"),
    `<form class="cc-stack" data-map-lab-generate-form>
      <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("目标平台", "Target Platform"))}</span><select name="targetPlatform" style="${CONTROL_STYLE}"><option value="tiktok-web">TikTok Web</option><option value="facebook-web">Facebook Web</option></select></label>
      <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("用户需求", "User Goal"))}</span><textarea name="objective" style="${TEXTAREA_STYLE}" placeholder="${escapeHtml(t("例如：进入 TikTok 搜索关键词，打开结果页前 5 条视频并保存证据包。", "Example: Search TikTok for a keyword, open the first 5 results, and capture evidence packets."))}"></textarea></label>
      <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("操作员补充", "Operator Notes"))}</span><textarea name="operatorNotes" style="${TEXTAREA_STYLE}" placeholder="${escapeHtml(t("补充风险边界、语言要求或人工复核重点。", "Add risk boundaries, language requirements, or review focus points."))}"></textarea></label>
      <label class="cc-field"><span class="cc-section-title">${escapeHtml(t("输出语言", "Output Language"))}</span><select name="outputLanguage" style="${CONTROL_STYLE}"><option value="zh-CN">简体中文</option><option value="en-US">English</option></select></label>
      <div class="cc-inline-actions">
        <button type="submit" class="cc-button cc-button-primary cc-button-large" data-map-lab-busy-sensitive>${escapeHtml(t("生成 Draft", "Generate Draft"))}</button>
        <button type="button" class="cc-button" data-map-lab-refresh data-map-lab-busy-sensitive>${escapeHtml(t("刷新目录", "Refresh Catalog"))}</button>
      </div>
      <p class="cc-muted">${escapeHtml(t("AI 只能产出 draft package；审批和激活仍然必须经过人工确认。", "AI may only produce a draft package; approval and activation still require human confirmation."))}</p>
    </form>`,
  );
}

function renderPreviewCard(t: (zh: string, en: string) => string): string {
  return renderCard(
    t("通俗预览", "Human Preview"),
    t("最新生成或选中草稿", "Latest Generation Or Selected Draft"),
    `<div class="cc-stack">
      <div data-map-lab-feedback></div>
      <div data-map-lab-provider-summary>${renderEmptyState(t("正在读取 provider 摘要。", "Loading provider summary."))}</div>
      <div data-map-lab-preview>${renderEmptyState(t("先输入需求生成 draft，或在下方目录中选择一个草稿查看。", "Generate a draft first, or select one from the catalog below to inspect it."))}</div>
    </div>`,
  );
}

function renderCatalogCard(t: (zh: string, en: string) => string): string {
  return renderCard(
    t("本地草稿目录", "Local Draft Catalog"),
    t("Quarantine / Approval / Activation", "Quarantine / Approval / Activation"),
    `<div class="cc-stack">
      <p class="cc-note" data-map-lab-catalog-summary>${escapeHtml(t("正在读取本地目录。", "Loading local catalog."))}</p>
      <div class="cc-stack" data-map-lab-catalog>${renderEmptyState(t("Map Lab 还没有草稿。", "Map Lab has no drafts yet."))}</div>
    </div>`,
  );
}

export function renderMapLabPage(viewModel: CommanderConsoleViewModel, _appViewModel: CommanderAppViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  return joinHtml([
    `<section class="cc-page" data-app-page="map-lab" data-map-lab-page>`,
    renderPageHeader(
      t("地图工坊", "Map Lab"),
      t("把用户需求交给高级 AI 生成受治理地图草稿，确认后激活，再回到开始页选择运行。", "Turn user goals into governed AI-authored map drafts, confirm them, activate them, then return to the start page to run."),
    ),
    `<div class="cc-page-stack">`,
    `<div class="cc-home-grid">${renderProviderCard(t)}${renderWorkflowCard(t)}</div>`,
    `<div class="cc-home-grid">${renderGenerateCard(t)}${renderPreviewCard(t)}</div>`,
    renderCatalogCard(t),
    `</div>`,
    `</section>`,
  ]);
}