export const aiProviderSettingsClient = `(function () {
  const viewModel = window.__grasseyeCommanderConsoleViewModel;
  if (!viewModel) { return; }
  const locale = viewModel.locale === "zh" ? "zh" : "en";
  function text(zh, en) { return locale === "zh" ? zh : en; }
  function page() { return document.querySelector("[data-ai-provider-settings-page]"); }
  function form() { const p = page(); return p instanceof HTMLElement ? p.querySelector("[data-ai-provider-settings-form]") : null; }
  function statusNode() { const p = page(); return p instanceof HTMLElement ? p.querySelector("[data-ai-provider-settings-status]") : null; }
  function summaryNode() { const p = page(); return p instanceof HTMLElement ? p.querySelector("[data-ai-provider-settings-summary]") : null; }
  function setStatus(message) { const n = statusNode(); if (n instanceof HTMLElement) { n.textContent = message; } }
  async function requestJson(path, body) {
    const response = await fetch(path, body === undefined
      ? { method: "GET" }
      : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      throw new Error(typeof payload.failureReason === "string" ? payload.failureReason : (typeof payload.error === "string" ? payload.error : "request_failed"));
    }
    return payload;
  }
  function syncForm(settings) {
    const f = form();
    if (!(f instanceof HTMLFormElement)) { return; }
    const displayName = f.elements.namedItem("displayName");
    const modelName = f.elements.namedItem("modelName");
    const apiKey = f.elements.namedItem("apiKey");
    if (displayName instanceof HTMLInputElement) { displayName.value = settings.displayName || "Google Gemini"; }
    if (modelName instanceof HTMLSelectElement && settings.modelName) { modelName.value = settings.modelName; }
    if (apiKey instanceof HTMLInputElement) { apiKey.value = ""; apiKey.placeholder = settings.maskedApiKey || "AIza..."; }
  }
  function syncSummary(settings) {
    const node = summaryNode();
    if (!(node instanceof HTMLElement)) { return; }
    node.innerHTML = "<dl class=\\"cc-summary-list\\">"
      + "<div class=\\"cc-summary-row\\"><dt>" + text("供应商", "Provider") + "</dt><dd>Google Gemini</dd></div>"
      + "<div class=\\"cc-summary-row\\"><dt>" + text("模型", "Model") + "</dt><dd>" + String(settings.modelName || "gemini-2.5-flash-lite") + "</dd></div>"
      + "<div class=\\"cc-summary-row\\"><dt>API Key</dt><dd>" + (settings.hasApiKey ? String(settings.maskedApiKey || "saved") : text("未保存", "Not saved")) + "</dd></div>"
      + "<div class=\\"cc-summary-row\\"><dt>" + text("最近更新", "Updated") + "</dt><dd>" + (settings.updatedAt ? new Date(settings.updatedAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US") : text("尚未保存", "Not saved yet")) + "</dd></div>"
      + "</dl>";
  }
  async function refresh() {
    const settings = await requestJson("/api/app-settings/online-ai-provider");
    syncForm(settings);
    syncSummary(settings);
    setStatus(settings.hasApiKey ? text("在线 AI 已配置。", "Online AI configured.") : text("请保存 Google Gemini API Key。", "Save a Google Gemini API key."));
  }
  async function submit(target) {
    const data = new FormData(target);
    const settings = await requestJson("/api/app-settings/online-ai-provider", {
      displayName: String(data.get("displayName") || ""),
      modelName: String(data.get("modelName") || "gemini-2.5-flash-lite"),
      apiKey: String(data.get("apiKey") || ""),
    });
    syncForm(settings);
    syncSummary(settings);
    setStatus(text("在线 AI 已保存。", "Online AI saved."));
  }
  document.addEventListener("submit", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLFormElement) || !target.matches("[data-ai-provider-settings-form]")) { return; }
    event.preventDefault();
    void submit(target).catch(function (error) { setStatus(error instanceof Error ? error.message : text("保存失败", "Save failed")); });
  });
  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.closest("[data-ai-provider-settings-refresh]")) { return; }
    void refresh().catch(function (error) { setStatus(error instanceof Error ? error.message : text("刷新失败", "Refresh failed")); });
  });
  document.addEventListener("grasseye:page-rendered", function () { void refresh().catch(function () {}); });
  void refresh().catch(function () {});
})();`;
