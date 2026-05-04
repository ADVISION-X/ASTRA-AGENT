type MapLabLocale = "zh" | "en";
type MapLabFeedbackTone = "ok" | "attention" | "blocked";
type MapLabProviderState = { providerId: string; displayName: string | null; providerKind: string | null; providerCompany: "openai" | "deepseek" | "openrouter" | null; configured: boolean; enabled: boolean; configRef: string | null; secretRef: string | null; hasSecret: boolean; secretLast4: string | null; model: string | null; allowPaidProvider: boolean; allowExternalTransmission: boolean; maxEstimatedCost: number | null; operatorApprovalRef: string | null; missingReason: string | null; updatedAt: string | null; };
type MapLabCatalogItem = { packageId: string; packageVersion: string; mapId: string; title: string; lifecycleStatus: string; approvalStatus: string; summary: string; chain: string[]; validationIssues: Array<{ code: string; message: string; severity: string }>; activationId: string | null; draftOnly: boolean; };
type MapLabSnapshot = { provider: MapLabProviderState; developerCatalog: MapLabCatalogItem[]; };
type MapLabPreviewPackage = { manifest: { displayName: string; packageId: string; packageVersion: string; approvalStatus: string }; taskTemplate: { description: string; requestedPlatformId: string }; operationalMap: { allowedAbilityGroups: string[]; finalStates: string[] }; dependencies: { requiredCapabilities: string[]; requiredPromptContracts: string[]; requiredPlatformProfiles: string[] }; };
type MapLabGenerateDraftResult = { status: "success" | "failed" | "review_required"; failureReason: string | null; reviewRequiredReason: string | null; packageId: string | null; packageVersion: string | null; mapPackage: MapLabPreviewPackage | null; humanReadableExplanation: string | null; requiredClarifications: string[]; riskWarnings: string[]; validationHints: string[]; validationIssues: string[]; needsCapabilityExpansion: boolean; draftStatus: "draft_ready" | "needs_clarification" | null; };
type MapLabFeedback = { tone: MapLabFeedbackTone; title: string; body: string };
type MapLabClientState = { snapshot: MapLabSnapshot | null; lastResult: MapLabGenerateDraftResult | null; focusedPackageId: string | null; feedback: MapLabFeedback | null; busyAction: string | null; };

function mapLabText(locale: MapLabLocale, zh: string, en: string): string { return locale === "zh" ? zh : en; }
function mapLabEscapeHtml(value: string | null | undefined): string { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function mapLabListHtml(items: string[], emptyText: string): string { return items.length === 0 ? `<p class="cc-note">${mapLabEscapeHtml(emptyText)}</p>` : `<div class="cc-stack">${items.map((item) => `<div class="cc-list-row"><div><strong>${mapLabEscapeHtml(item)}</strong></div></div>`).join("")}</div>`; }

function mapLabBuildProviderSummaryHtml(snapshot: MapLabSnapshot, locale: MapLabLocale): string {
  const provider = snapshot.provider;
  const updatedAt = provider.updatedAt ? new Date(provider.updatedAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US") : mapLabText(locale, "尚未写入", "Not saved yet");
  const company = provider.providerCompany === "deepseek" ? "DeepSeek" : provider.providerCompany === "openrouter" ? "OpenRouter" : "OpenAI";
  return `<dl class="cc-summary-list"><div class="cc-summary-row"><dt>${mapLabEscapeHtml(mapLabText(locale, "AI 名称", "AI Name"))}</dt><dd>${mapLabEscapeHtml(provider.displayName ?? mapLabText(locale, "未命名", "Unnamed"))}</dd></div><div class="cc-summary-row"><dt>${mapLabEscapeHtml(mapLabText(locale, "AI 公司", "AI Company"))}</dt><dd>${mapLabEscapeHtml(company)}</dd></div><div class="cc-summary-row"><dt>${mapLabEscapeHtml(mapLabText(locale, "配置状态", "Configured"))}</dt><dd>${mapLabEscapeHtml(provider.configured ? mapLabText(locale, "已配置", "Configured") : mapLabText(locale, "未配置", "Missing"))}</dd></div><div class="cc-summary-row"><dt>Key</dt><dd>${mapLabEscapeHtml(provider.secretLast4 ? `••••${provider.secretLast4}` : mapLabText(locale, "未保存", "Not saved"))}</dd></div><div class="cc-summary-row"><dt>${mapLabEscapeHtml(mapLabText(locale, "最近更新时间", "Updated"))}</dt><dd>${mapLabEscapeHtml(updatedAt)}</dd></div></dl>`;
}

function mapLabResolveProviderCompany(value: FormDataEntryValue | null): "openai" | "deepseek" | "openrouter" {
  return value === "deepseek" || value === "openrouter" ? value : "openai";
}

function mapLabResolveProviderDefaults(providerCompany: "openai" | "deepseek" | "openrouter"): { baseUrl: string; model: string } {
  if (providerCompany === "deepseek") return { baseUrl: "https://api.deepseek.com", model: "deepseek-chat" };
  if (providerCompany === "openrouter") return { baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4.1-mini" };
  return { baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" };
}

function mapLabBuildStatsHtml(snapshot: MapLabSnapshot, locale: MapLabLocale): string {
  const approvedCount = snapshot.developerCatalog.filter((item) => item.approvalStatus === "approved").length;
  const activeCount = snapshot.developerCatalog.filter((item) => item.activationId !== null).length;
  return `<div class="cc-stat-tile"><span>${mapLabEscapeHtml(mapLabText(locale, "草稿目录", "Draft Catalog"))}</span><strong>${mapLabEscapeHtml(String(snapshot.developerCatalog.length))}</strong></div><div class="cc-stat-tile"><span>${mapLabEscapeHtml(mapLabText(locale, "已批准 / 已激活", "Approved / Active"))}</span><strong>${mapLabEscapeHtml(`${approvedCount} / ${activeCount}`)}</strong></div>`;
}

function mapLabBuildCatalogPreviewHtml(item: MapLabCatalogItem, locale: MapLabLocale): string {
  const issues = item.validationIssues.map((issue) => `${issue.severity}: ${issue.message}`);
  return `<div class="cc-stack"><div class="cc-detail-block"><span>${mapLabEscapeHtml(mapLabText(locale, "草稿标题", "Draft Title"))}</span><strong>${mapLabEscapeHtml(item.title)}</strong><p class="cc-note">${mapLabEscapeHtml(item.summary || mapLabText(locale, "该草稿没有额外摘要。", "This draft has no additional summary."))}</p></div><dl class="cc-summary-list"><div class="cc-summary-row"><dt>${mapLabEscapeHtml(mapLabText(locale, "审批状态", "Approval"))}</dt><dd>${mapLabEscapeHtml(item.approvalStatus)}</dd></div><div class="cc-summary-row"><dt>${mapLabEscapeHtml(mapLabText(locale, "生命周期", "Lifecycle"))}</dt><dd>${mapLabEscapeHtml(item.lifecycleStatus)}</dd></div><div class="cc-summary-row"><dt>${mapLabEscapeHtml(mapLabText(locale, "激活记录", "Activation"))}</dt><dd>${mapLabEscapeHtml(item.activationId ?? mapLabText(locale, "尚未激活", "Not active"))}</dd></div></dl>${mapLabListHtml(item.chain, mapLabText(locale, "该草稿没有公开链路说明。", "This draft does not expose a public chain summary."))}${mapLabListHtml(issues, mapLabText(locale, "当前没有 validation issue。", "No validation issues."))}</div>`;
}

function mapLabBuildResultPreviewHtml(result: MapLabGenerateDraftResult, locale: MapLabLocale): string {
  const mapPackage = result.mapPackage;
  const title = mapPackage?.manifest.displayName ?? mapLabText(locale, "未产出地图", "No map produced");
  const summary = mapPackage?.taskTemplate.description ?? result.humanReadableExplanation ?? mapLabText(locale, "当前结果没有可展示摘要。", "The current result has no display summary.");
  const statusLine = result.status === "success" ? mapLabText(locale, "已生成可审阅 draft。", "A reviewable draft was generated.") : result.status === "review_required" ? mapLabText(locale, "草稿已生成，但需要人工复核后才能继续。", "A draft was generated, but it requires human review before proceeding.") : mapLabText(locale, "本次生成失败，没有拿到可导入草稿。", "Generation failed and no importable draft was returned.");
  return `<div class="cc-stack"><div class="cc-detail-block"><span>${mapLabEscapeHtml(mapLabText(locale, "最新结果", "Latest Result"))}</span><strong>${mapLabEscapeHtml(title)}</strong><p class="cc-note">${mapLabEscapeHtml(summary)}</p></div><div class="cc-detail-block"><span>${mapLabEscapeHtml(mapLabText(locale, "状态", "Status"))}</span><strong>${mapLabEscapeHtml(statusLine)}</strong></div><dl class="cc-summary-list"><div class="cc-summary-row"><dt>${mapLabEscapeHtml(mapLabText(locale, "Package", "Package"))}</dt><dd>${mapLabEscapeHtml(result.packageId ?? mapLabText(locale, "未生成", "Not generated"))}</dd></div><div class="cc-summary-row"><dt>${mapLabEscapeHtml(mapLabText(locale, "Draft Status", "Draft Status"))}</dt><dd>${mapLabEscapeHtml(result.draftStatus ?? mapLabText(locale, "未知", "Unknown"))}</dd></div><div class="cc-summary-row"><dt>${mapLabEscapeHtml(mapLabText(locale, "平台", "Platform"))}</dt><dd>${mapLabEscapeHtml(mapPackage?.taskTemplate.requestedPlatformId ?? mapLabText(locale, "未知", "Unknown"))}</dd></div></dl>${mapLabListHtml(result.requiredClarifications, mapLabText(locale, "当前没有必须补充说明的项。", "There are no required clarifications right now."))}${mapLabListHtml(result.riskWarnings, mapLabText(locale, "当前没有额外风险警告。", "There are no additional risk warnings right now."))}${mapLabListHtml(result.validationHints, mapLabText(locale, "当前没有额外 validation hint。", "There are no additional validation hints right now."))}${mapLabListHtml(result.validationIssues, mapLabText(locale, "当前没有 validation issue。", "There are no validation issues right now."))}${mapLabListHtml(mapPackage?.dependencies.requiredCapabilities ?? [], mapLabText(locale, "当前没有新增 capability 依赖。", "There are no additional capability dependencies right now."))}${mapLabListHtml(mapPackage?.dependencies.requiredPromptContracts ?? [], mapLabText(locale, "当前没有额外 prompt contract 依赖。", "There are no additional prompt contract dependencies right now."))}</div>`;
}

function mapLabBuildCatalogActions(item: MapLabCatalogItem, locale: MapLabLocale): string {
  const actions = [`<button type="button" class="cc-button" data-map-lab-focus-package="${mapLabEscapeHtml(item.packageId)}">${mapLabEscapeHtml(mapLabText(locale, "查看预览", "Preview"))}</button>`];
  actions.push(`<span class="cc-pill">${mapLabEscapeHtml(mapLabText(locale, "draft/quarantine only", "draft/quarantine only"))}</span>`);
  return actions.join("");
}

function mapLabBuildCatalogCardHtml(item: MapLabCatalogItem, locale: MapLabLocale): string {
  return `<section class="cc-card" data-map-lab-package-card data-package-id="${mapLabEscapeHtml(item.packageId)}" data-package-version="${mapLabEscapeHtml(item.packageVersion)}"><div class="cc-stack"><div class="cc-list-row"><div><strong>${mapLabEscapeHtml(item.title)}</strong><small>${mapLabEscapeHtml(item.summary || item.packageId)}</small></div><span class="cc-pill">${mapLabEscapeHtml(item.approvalStatus)}</span></div><dl class="cc-summary-list"><div class="cc-summary-row"><dt>Package</dt><dd>${mapLabEscapeHtml(item.packageId)}</dd></div><div class="cc-summary-row"><dt>${mapLabEscapeHtml(mapLabText(locale, "验证问题", "Validation Issues"))}</dt><dd>${mapLabEscapeHtml(String(item.validationIssues.length))}</dd></div><div class="cc-summary-row"><dt>${mapLabEscapeHtml(mapLabText(locale, "激活记录", "Activation"))}</dt><dd>${mapLabEscapeHtml(item.activationId ?? mapLabText(locale, "尚未激活", "Not active"))}</dd></div></dl><div class="cc-inline-actions">${mapLabBuildCatalogActions(item, locale)}</div></div></section>`;
}

function mapLabBuildCatalogHtml(state: MapLabClientState, locale: MapLabLocale): string {
  const snapshot = state.snapshot;
  return !snapshot || snapshot.developerCatalog.length === 0 ? `<div class="cc-empty">${mapLabEscapeHtml(mapLabText(locale, "Map Lab 还没有草稿。", "Map Lab has no drafts yet."))}</div>` : snapshot.developerCatalog.map((item) => mapLabBuildCatalogCardHtml(item, locale)).join("");
}

function mapLabBuildFeedbackHtml(feedback: MapLabFeedback | null): string {
  if (!feedback) return "";
  const toneClass = feedback.tone === "ok" ? "cc-pill-ok" : feedback.tone === "attention" ? "cc-pill-attention" : "cc-pill-blocked";
  const bannerTone = feedback.tone === "blocked" ? "cc-tone-blocked" : "cc-tone-attention";
  return `<section class="cc-error-banner ${bannerTone}"><strong class="${toneClass}">${mapLabEscapeHtml(feedback.title)}</strong><p>${mapLabEscapeHtml(feedback.body)}</p></section>`;
}

function mapLabBuildPageUrl(page: string): string { const url = new URL(window.location.href); if (page === "home") url.searchParams.delete("page"); else url.searchParams.set("page", page); return url.toString(); }
function mapLabGetPage(): HTMLElement | null { const page = document.querySelector("[data-map-lab-page], [data-ai-provider-settings-page]"); return page instanceof HTMLElement ? page : null; }

async function mapLabPostJson(path: string, body?: unknown): Promise<unknown> {
  const requestInit: RequestInit = body === undefined
    ? { method: "GET" }
    : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
  const response = await fetch(path, requestInit);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : `http_${response.status}`);
  return payload;
}

function mapLabSeedProviderForm(form: HTMLFormElement, snapshot: MapLabSnapshot): void {
  const displayNameInput = form.elements.namedItem("displayName");
  const providerCompanyInput = form.elements.namedItem("providerCompany");
  const apiKeyInput = form.elements.namedItem("apiKey");
  const operatorApprovalRefInput = form.elements.namedItem("operatorApprovalRef");
  if (displayNameInput instanceof HTMLInputElement) displayNameInput.value = snapshot.provider.displayName ?? "";
  if (providerCompanyInput instanceof HTMLSelectElement) providerCompanyInput.value = snapshot.provider.providerCompany ?? "openai";
  if (operatorApprovalRefInput instanceof HTMLInputElement) operatorApprovalRefInput.value = snapshot.provider.operatorApprovalRef ?? "";
  if (apiKeyInput instanceof HTMLInputElement) apiKeyInput.placeholder = snapshot.provider.secretLast4 ? `••••${snapshot.provider.secretLast4}` : "sk-...";
}

function mapLabResolveProviderStatus(snapshot: MapLabSnapshot | null, locale: MapLabLocale): string {
  return snapshot?.provider.configured ? mapLabText(locale, "AI 已配置，可以生成地图草稿。", "AI configured. Draft generation is available.") : mapLabText(locale, "AI 未配置，生成前必须先保存。", "AI is missing. Save it before generation.");
}

function mapLabResolveCatalogSummary(snapshot: MapLabSnapshot | null, locale: MapLabLocale): string {
  return snapshot ? mapLabText(locale, `当前目录共有 ${snapshot.developerCatalog.length} 个草稿。`, `${snapshot.developerCatalog.length} draft(s) are currently in the local catalog.`) : mapLabText(locale, "正在读取本地目录。", "Loading local catalog.");
}

function mapLabResolvePreviewHtml(state: MapLabClientState, locale: MapLabLocale): string {
  const focused = state.snapshot?.developerCatalog.find((item) => item.packageId === state.focusedPackageId) ?? null;
  return state.lastResult ? mapLabBuildResultPreviewHtml(state.lastResult, locale) : focused ? mapLabBuildCatalogPreviewHtml(focused, locale) : `<div class="cc-empty">${mapLabEscapeHtml(mapLabText(locale, "先生成一个 draft，或在目录里点“查看预览”。", "Generate a draft first, or click Preview in the catalog."))}</div>`;
}

function mapLabResolveNextAction(snapshot: MapLabSnapshot | null, locale: MapLabLocale): string {
  return snapshot?.provider.configured ? mapLabText(locale, "输入用户需求生成草稿；结果只会进入 draft/quarantine。", "Describe the goal and generate a draft; results only enter draft/quarantine.") : mapLabText(locale, "先到设置页保存 AI。", "Save AI in Settings first.");
}

function mapLabSyncProviderPanel(page: HTMLElement, snapshot: MapLabSnapshot | null, locale: MapLabLocale): void {
  const providerForm = page.querySelector("[data-ai-provider-settings-form]");
  if (providerForm instanceof HTMLFormElement && snapshot) mapLabSeedProviderForm(providerForm, snapshot);
  const providerSummary = page.querySelector("[data-map-lab-provider-summary]");
  if (providerSummary instanceof HTMLElement) providerSummary.innerHTML = snapshot ? mapLabBuildProviderSummaryHtml(snapshot, locale) : "";
  const stats = page.querySelector("[data-map-lab-stats]");
  if (stats instanceof HTMLElement && snapshot) stats.innerHTML = mapLabBuildStatsHtml(snapshot, locale);
  const providerStatus = page.querySelector("[data-map-lab-provider-status]");
  if (providerStatus instanceof HTMLElement) providerStatus.textContent = mapLabResolveProviderStatus(snapshot, locale);
}

function mapLabSyncCatalogPanel(page: HTMLElement, state: MapLabClientState, locale: MapLabLocale): void {
  const catalogSummary = page.querySelector("[data-map-lab-catalog-summary]");
  if (catalogSummary instanceof HTMLElement) catalogSummary.textContent = mapLabResolveCatalogSummary(state.snapshot, locale);
  const catalog = page.querySelector("[data-map-lab-catalog]");
  if (catalog instanceof HTMLElement) catalog.innerHTML = mapLabBuildCatalogHtml(state, locale);
}

function mapLabSyncPreviewPanel(page: HTMLElement, state: MapLabClientState, locale: MapLabLocale): void {
  const preview = page.querySelector("[data-map-lab-preview]");
  if (preview instanceof HTMLElement) preview.innerHTML = mapLabResolvePreviewHtml(state, locale);
  const feedback = page.querySelector("[data-map-lab-feedback]");
  if (feedback instanceof HTMLElement) feedback.innerHTML = mapLabBuildFeedbackHtml(state.feedback);
  const nextAction = page.querySelector("[data-map-lab-next-action]");
  if (nextAction instanceof HTMLElement) nextAction.textContent = mapLabResolveNextAction(state.snapshot, locale);
}

function mapLabSyncBusyState(page: HTMLElement, busyAction: string | null): void {
  page.querySelectorAll("[data-map-lab-busy-sensitive]").forEach((node) => { if (node instanceof HTMLButtonElement) node.disabled = busyAction !== null; });
}

function mapLabSyncPage(state: MapLabClientState, locale: MapLabLocale): void {
  const page = mapLabGetPage();
  if (!page) return;
  mapLabSyncProviderPanel(page, state.snapshot, locale);
  mapLabSyncCatalogPanel(page, state, locale);
  mapLabSyncPreviewPanel(page, state, locale);
  mapLabSyncBusyState(page, state.busyAction);
}

async function mapLabRefreshSnapshot(state: MapLabClientState, locale: MapLabLocale): Promise<void> { state.snapshot = await mapLabPostJson("/api/map-lab/state") as MapLabSnapshot; mapLabSyncPage(state, locale); }
async function mapLabRunAction(state: MapLabClientState, locale: MapLabLocale, action: string, task: () => Promise<void>): Promise<void> {
  state.busyAction = action; mapLabSyncPage(state, locale);
  try { await task(); } catch (error) { state.feedback = { tone: "blocked", title: mapLabText(locale, "Map Lab 操作失败", "Map Lab action failed"), body: error instanceof Error ? error.message : mapLabText(locale, "未知错误", "Unknown error") }; }
  finally { state.busyAction = null; mapLabSyncPage(state, locale); }
}

function mapLabBuildGeneratePayload(form: HTMLFormElement): Record<string, string> {
  const formData = new FormData(form);
  return { missionId: `map-lab-${Date.now()}`, objective: String(formData.get("objective") ?? "").trim(), targetPlatform: String(formData.get("targetPlatform") ?? "tiktok-web"), allowedAutomationScope: String(formData.get("allowedAutomationScope") ?? "").trim(), mustAskBefore: String(formData.get("mustAskBefore") ?? "").trim(), runLimit: String(formData.get("runLimit") ?? "").trim(), failureHandlingPreference: String(formData.get("failureHandlingPreference") ?? "").trim(), evidencePreference: String(formData.get("evidencePreference") ?? "").trim(), operatorNotes: String(formData.get("operatorNotes") ?? "").trim(), outputLanguage: String(formData.get("outputLanguage") ?? "zh-CN") };
}

function mapLabReadApprovalContext(page: HTMLElement): { approvedBy: string; reason: string } | null {
  const approvedByInput = page.querySelector("[data-map-lab-approved-by]");
  const reasonInput = page.querySelector("[data-map-lab-activation-reason]");
  return approvedByInput instanceof HTMLInputElement && reasonInput instanceof HTMLInputElement ? { approvedBy: approvedByInput.value.trim(), reason: reasonInput.value.trim() || "operator_confirmed_map_lab_draft" } : null;
}

async function mapLabHandleProviderSubmit(target: HTMLFormElement, state: MapLabClientState, locale: MapLabLocale): Promise<void> {
  await mapLabRunAction(state, locale, "provider", async () => {
    const formData = new FormData(target);
    const providerCompany = mapLabResolveProviderCompany(formData.get("providerCompany"));
    const providerDefaults = mapLabResolveProviderDefaults(providerCompany);
    await mapLabPostJson("/api/ai-provider-settings/provider-config", { displayName: String(formData.get("displayName") ?? "").trim(), providerCompany, providerKind: "openai-compatible", baseUrl: providerDefaults.baseUrl, model: providerDefaults.model, apiKey: String(formData.get("apiKey") ?? "").trim(), allowPaidProvider: String(formData.get("allowPaidProvider") ?? "true") === "true", providerAllowlist: ["paid-analysis-ai"], dataPolicy: { allowExternalTransmission: String(formData.get("allowExternalTransmission") ?? "true") === "true" }, costPolicy: { maxEstimatedCost: Number(formData.get("maxEstimatedCost") ?? 5) }, operatorApprovalRef: String(formData.get("operatorApprovalRef") ?? "").trim(), approvalReason: String(formData.get("approvalReason") ?? "").trim() });
    state.feedback = { tone: "ok", title: mapLabText(locale, "AI 已保存", "AI saved"), body: mapLabText(locale, "AI 密匙已写入本地安全存储。", "The AI key was saved to local secure storage.") };
    await mapLabRefreshSnapshot(state, locale);
  });
}

async function mapLabHandleGenerateSubmit(target: HTMLFormElement, state: MapLabClientState, locale: MapLabLocale): Promise<void> {
  await mapLabRunAction(state, locale, "generate", async () => {
    state.lastResult = await mapLabPostJson("/api/map-lab/generate", mapLabBuildGeneratePayload(target)) as MapLabGenerateDraftResult;
    state.focusedPackageId = state.lastResult.packageId;
    state.feedback = { tone: state.lastResult.status === "success" ? "ok" : state.lastResult.status === "review_required" ? "attention" : "blocked", title: mapLabText(locale, "地图草稿已返回", "Draft result returned"), body: state.lastResult.reviewRequiredReason ?? state.lastResult.failureReason ?? mapLabText(locale, "可以继续人工审阅。", "You can continue to human review.") };
    await mapLabRefreshSnapshot(state, locale);
  });
}

async function mapLabHandleApprove(button: HTMLElement, page: HTMLElement, state: MapLabClientState, locale: MapLabLocale): Promise<void> {
  const approvalContext = mapLabReadApprovalContext(page); const packageId = button.getAttribute("data-map-lab-approve"); const packageVersion = button.getAttribute("data-package-version");
  if (!approvalContext || !packageId || !packageVersion || approvalContext.approvedBy.length === 0) return;
  await mapLabRunAction(state, locale, "approve", async () => {
    await mapLabPostJson("/api/map-lab/approve", { packageId, packageVersion, approvedBy: approvalContext.approvedBy });
    state.focusedPackageId = packageId;
    state.feedback = { tone: "ok", title: mapLabText(locale, "草稿已批准", "Draft approved"), body: mapLabText(locale, "现在可以继续激活，并回到开始页选择运行。", "You can now activate it and return to the start page to run it.") };
    await mapLabRefreshSnapshot(state, locale);
  });
}

async function mapLabHandleActivate(button: HTMLElement, page: HTMLElement, state: MapLabClientState, locale: MapLabLocale): Promise<void> {
  const approvalContext = mapLabReadApprovalContext(page); const packageId = button.getAttribute("data-map-lab-activate"); const packageVersion = button.getAttribute("data-package-version");
  if (!approvalContext || !packageId || !packageVersion || approvalContext.approvedBy.length === 0) return;
  await mapLabRunAction(state, locale, "activate", async () => {
    await mapLabPostJson("/api/map-lab/activate", { packageId, packageVersion, approvedBy: approvalContext.approvedBy, reason: approvalContext.reason });
    state.focusedPackageId = packageId;
    state.feedback = { tone: "ok", title: mapLabText(locale, "地图已激活", "Map activated"), body: mapLabText(locale, "回到开始页后，新的任务模板应该已经可以选择运行。", "Return to the start page and the new task template should now be runnable.") };
    await mapLabRefreshSnapshot(state, locale);
  });
}

function mapLabHandleSubmit(event: Event, state: MapLabClientState, locale: MapLabLocale): void {
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) return;
  if (target.matches("[data-ai-provider-settings-form]")) { event.preventDefault(); void mapLabHandleProviderSubmit(target, state, locale); }
  if (target.matches("[data-map-lab-generate-form]")) { event.preventDefault(); void mapLabHandleGenerateSubmit(target, state, locale); }
}

function mapLabHandleRefreshClick(target: HTMLElement, state: MapLabClientState, locale: MapLabLocale): boolean {
  if (!target.closest("[data-map-lab-refresh]")) return false;
  void mapLabRunAction(state, locale, "refresh", async () => { await mapLabRefreshSnapshot(state, locale); });
  return true;
}

function mapLabHandleOpenStartClick(target: HTMLElement): boolean {
  if (!target.closest("[data-map-lab-open-start]")) return false;
  window.location.assign(mapLabBuildPageUrl("home"));
  return true;
}

function mapLabHandleFocusClick(target: HTMLElement, state: MapLabClientState, locale: MapLabLocale): boolean {
  const focusButton = target.closest("[data-map-lab-focus-package]");
  if (!(focusButton instanceof HTMLElement)) return false;
  state.focusedPackageId = focusButton.getAttribute("data-map-lab-focus-package");
  state.lastResult = null;
  mapLabSyncPage(state, locale);
  return true;
}

function mapLabHandleCommandClick(target: HTMLElement, page: HTMLElement, state: MapLabClientState, locale: MapLabLocale): boolean {
  const approveButton = target.closest("[data-map-lab-approve]");
  if (approveButton instanceof HTMLElement) { void mapLabHandleApprove(approveButton, page, state, locale); return true; }
  const activateButton = target.closest("[data-map-lab-activate]");
  if (activateButton instanceof HTMLElement) { void mapLabHandleActivate(activateButton, page, state, locale); return true; }
  return false;
}

function mapLabHandleClick(event: Event, state: MapLabClientState, locale: MapLabLocale): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const page = mapLabGetPage();
  if (!page) return;
  if (mapLabHandleRefreshClick(target, state, locale)) return;
  if (mapLabHandleOpenStartClick(target)) return;
  if (mapLabHandleFocusClick(target, state, locale)) return;
  mapLabHandleCommandClick(target, page, state, locale);
}

function mapLabHandlePageChange(state: MapLabClientState, locale: MapLabLocale): void { if (!mapLabGetPage()) return; mapLabSyncPage(state, locale); void mapLabRefreshSnapshot(state, locale); }

function mapLabBootstrap(): void {
  const pageHost = document.querySelector("[data-app-page-host]");
  if (!(pageHost instanceof HTMLElement)) return;
  const locale: MapLabLocale = document.documentElement.lang === "zh-CN" ? "zh" : "en";
  const state: MapLabClientState = { snapshot: null, lastResult: null, focusedPackageId: null, feedback: null, busyAction: null };
  document.addEventListener("submit", (event) => mapLabHandleSubmit(event, state, locale));
  document.addEventListener("click", (event) => mapLabHandleClick(event, state, locale));
  new MutationObserver(() => mapLabHandlePageChange(state, locale)).observe(pageHost, { childList: true });
  mapLabHandlePageChange(state, locale);
}

export const mapLabClient = [mapLabText, mapLabEscapeHtml, mapLabListHtml, mapLabBuildProviderSummaryHtml, mapLabBuildStatsHtml, mapLabBuildCatalogPreviewHtml, mapLabBuildResultPreviewHtml, mapLabBuildCatalogActions, mapLabBuildCatalogCardHtml, mapLabBuildCatalogHtml, mapLabBuildFeedbackHtml, mapLabBuildPageUrl, mapLabGetPage, mapLabPostJson, mapLabSeedProviderForm, mapLabResolveProviderStatus, mapLabResolveCatalogSummary, mapLabResolvePreviewHtml, mapLabResolveNextAction, mapLabSyncProviderPanel, mapLabSyncCatalogPanel, mapLabSyncPreviewPanel, mapLabSyncBusyState, mapLabSyncPage, mapLabRefreshSnapshot, mapLabRunAction, mapLabBuildGeneratePayload, mapLabReadApprovalContext, mapLabHandleProviderSubmit, mapLabHandleGenerateSubmit, mapLabHandleApprove, mapLabHandleActivate, mapLabHandleSubmit, mapLabHandleRefreshClick, mapLabHandleOpenStartClick, mapLabHandleFocusClick, mapLabHandleCommandClick, mapLabHandleClick, mapLabHandlePageChange, mapLabBootstrap].map((fn) => String(fn)).join("\n") + "\nmapLabBootstrap();";
