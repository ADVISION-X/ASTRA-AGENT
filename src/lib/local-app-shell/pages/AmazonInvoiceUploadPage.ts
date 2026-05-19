import type { CommanderAppViewModel } from "../commander-app.types.js";
import { renderPageHeader } from "../layout/PageHeader.js";
import { localizeCommanderText } from "../locale.js";
import { escapeHtml, joinHtml, renderCard, renderEmptyState } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";

function renderInputField(label: string, name: string, value: string, options?: {
  placeholder?: string;
  type?: "text" | "url";
}): string {
  return `<label class="cc-field">
    <span>${escapeHtml(label)}</span>
    <input name="${escapeHtml(name)}" type="${escapeHtml(options?.type ?? "text")}" value="${escapeHtml(value)}"${options?.placeholder ? ` placeholder="${escapeHtml(options.placeholder)}"` : ""} />
  </label>`;
}

function renderMarketplaceField(locale: CommanderConsoleViewModel["locale"]): string {
  const label = localizeCommanderText(locale, "站点", "Marketplace");
  return `<label class="cc-field">
    <span>${escapeHtml(label)}</span>
    <select name="marketplace">
      <option value="AE" selected>AE</option>
      <option value="SA">SA</option>
      <option value="JP">JP</option>
      <option value="US">US</option>
      <option value="UK">UK</option>
    </select>
  </label>`;
}

function renderOpenAdminForm(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  return renderCard(
    t("先打开 ONTHEWAY 后台页", "Open ONTHEWAY Admin First"),
    t("只允许本地开发地址", "Local development hosts only"),
    `<form class="cc-amazon-form" data-amazon-admin-open-form>
      ${renderInputField(t("后台地址", "Admin URL"), "adminUrl", "http://localhost:3000/apex/amazon-manage/amazon-invoices", { type: "url" })}
      <div class="cc-inline-actions">
        <button type="submit" class="cc-button cc-button-primary cc-button-large">${escapeHtml(t("打开后台页", "Open Admin Page"))}</button>
      </div>
    </form>`,
  );
}

function renderMissionForm(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  return renderCard(
    t("完整上传任务", "Complete Upload Task"),
    t("接收批准 PDF，执行搜索、上传、提交和验证", "Receives an approved PDF, then searches, uploads, submits, and verifies"),
    `<form class="cc-amazon-form" data-amazon-invoice-upload-form enctype="multipart/form-data">
      <div class="cc-run-limit-grid">
        ${renderMarketplaceField(viewModel.locale)}
        ${renderInputField(t("Amazon 订单号", "Amazon Order ID"), "amazonOrderId", "123-1234567-1234567")}
      </div>
      <div class="cc-run-limit-grid">
        ${renderInputField(t("发票号", "Invoice No"), "invoiceNo", "INV-2026-0001")}
        <label class="cc-field">
          <span>${escapeHtml(t("发票 PDF", "Invoice PDF"))}</span>
          <input name="invoicePdf" type="file" accept="application/pdf,.pdf" required />
        </label>
      </div>
      ${renderInputField(t("Seller Central 入口", "Seller Central Entry URL"), "sellerCentralEntryUrl", "https://sellercentral.amazon.ae/orders-v3", { type: "url" })}
      ${renderInputField(t("后台订单详情 URL", "Admin Order URL"), "adminOrderUrl", "http://localhost:3000/apex/amazon-manage/orders/123", { type: "url" })}
      <label class="cc-checkbox-row">
        <input type="checkbox" name="requireHumanFinalSubmit" checked />
        <span>${escapeHtml(t("最终提交前停下人工复核", "Stop for human review before final submit"))}</span>
      </label>
      <div class="cc-inline-actions">
        <button type="submit" class="cc-button cc-button-primary cc-button-large">${escapeHtml(t("启动上传", "Start Upload"))}</button>
      </div>
    </form>`,
  );
}

function renderScopeCard(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  return renderCard(
    t("当前边界", "Current Scope"),
    t("只做本地任务启动桥，不改网站后端", "Local launch channel only; website backend stays untouched"),
    `<ul class="cc-amazon-note-list">
      <li>${escapeHtml(t("不复用视觉任务首页，也不穿过 /api/tasks/start。", "Does not reuse the visual mission home page or pass through /api/tasks/start."))}</li>
      <li>${escapeHtml(t("浏览器 owner 仍在 workbench 内部，不在 route 中 new 浏览器控制器。", "Browser ownership stays inside workbench; routes never construct browser controllers."))}</li>
      <li>${escapeHtml(t("PDF 会先保存为 approved task file，再交给 DOM 上传能力。", "PDF is first saved as an approved task file before DOM upload."))}</li>
      <li>${escapeHtml(t("遇到登录、2FA、验证码或不确定提交会返回 review_required。", "Login, 2FA, CAPTCHA, or uncertain submit states return review_required."))}</li>
    </ul>`,
  );
}

function renderResultCard(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  return renderCard(
    t("最新结果", "Latest Results"),
    t("左侧是后台打开结果，右侧是上传任务结果", "Admin open result and upload task result"),
    `<div class="cc-amazon-result-stack">
      <section class="cc-amazon-result-card">
        <div class="cc-section-copy">
          <strong>${escapeHtml(t("后台页打开结果", "Admin Open Result"))}</strong>
          <p class="cc-note">${escapeHtml(t("显示 allowlist 判定和当前浏览器 URL。", "Shows allowlist decision and current browser URL."))}</p>
        </div>
        <div data-amazon-admin-result>${renderEmptyState(t("还没有后台打开结果。", "No admin open result yet."))}</div>
      </section>
      <section class="cc-amazon-result-card">
        <div class="cc-section-copy">
          <strong>${escapeHtml(t("上传任务结果", "Upload Task Result"))}</strong>
          <p class="cc-note">${escapeHtml(t("显示 taskId、reachedStep、status 和 evidence。", "Shows taskId, reachedStep, status, and evidence."))}</p>
        </div>
        <div data-amazon-upload-result>${renderEmptyState(t("还没有任务结果。", "No mission result yet."))}</div>
      </section>
    </div>`,
  );
}

export function renderAmazonInvoiceUploadPage(viewModel: CommanderConsoleViewModel, _appViewModel: CommanderAppViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  return joinHtml([
    `<section class="cc-page" data-app-page="amazon-invoice-upload" data-amazon-invoice-upload-page>`,
    renderPageHeader(
      t("Amazon Invoice Upload", "Amazon Invoice Upload"),
      t("Agent 独立插件入口，接收批准 PDF 并在当前 Chrome 执行 Amazon 发票上传。", "Independent Agent plugin entry that receives an approved PDF and uploads it in current Chrome."),
    ),
    `<div class="cc-amazon-upload-grid">`,
    `<div class="cc-page-stack">`,
    renderOpenAdminForm(viewModel),
    renderMissionForm(viewModel),
    `</div>`,
    `<div class="cc-page-stack">`,
    renderScopeCard(viewModel),
    renderResultCard(viewModel),
    `</div>`,
    `</div>`,
    `</section>`,
  ]);
}
