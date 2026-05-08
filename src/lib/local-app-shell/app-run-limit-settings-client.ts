export const appRunLimitSettingsClient = `(function () {
  const viewModel = window.__grasseyeCommanderConsoleViewModel;
  if (!viewModel) { return; }

  const locale = viewModel.locale === "zh" ? "zh" : "en";

  function text(zh, en) {
    return locale === "zh" ? zh : en;
  }
  function getSettingsPage() {
    return document.querySelector("[data-app-run-limit-settings-page]");
  }
  function getSettingsForm() {
    const page = getSettingsPage();
    return page instanceof HTMLElement ? page.querySelector("[data-app-run-limit-settings-form]") : null;
  }
  function getSettingsStatusNode() {
    const page = getSettingsPage();
    return page instanceof HTMLElement ? page.querySelector("[data-app-run-limit-settings-status]") : null;
  }
  function getSettingsSummaryNode() {
    const page = getSettingsPage();
    return page instanceof HTMLElement ? page.querySelector("[data-app-run-limit-settings-summary]") : null;
  }
  function resolveUpdatedAt(settings) {
    return settings && settings.updatedAt
      ? new Date(settings.updatedAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")
      : text("尚未保存", "Not saved yet");
  }
  function setStatus(message) {
    const statusNode = getSettingsStatusNode();
    if (statusNode instanceof HTMLElement) {
      statusNode.textContent = message;
    }
  }
  function syncSettingsSummary(settings) {
    const summaryNode = getSettingsSummaryNode();
    if (!(summaryNode instanceof HTMLElement)) { return; }
    summaryNode.innerHTML = "<dl class=\"cc-summary-list\">"
      + "<div class=\"cc-summary-row\"><dt>" + text("默认运行时长", "Default duration") + "</dt><dd>" + String(settings.defaultMaxMinutes) + "</dd></div>"
      + "<div class=\"cc-summary-row\"><dt>" + text("默认最多处理", "Default max items") + "</dt><dd>" + String(settings.defaultMaxRounds) + "</dd></div>"
      + "<div class=\"cc-summary-row\"><dt>" + text("最近更新", "Updated") + "</dt><dd>" + resolveUpdatedAt(settings) + "</dd></div>"
      + "</dl>";
  }
  function syncSettingsForm(settings) {
    const form = getSettingsForm();
    if (!(form instanceof HTMLFormElement)) { return; }
    const maxMinutesInput = form.elements.namedItem("defaultMaxMinutes");
    const maxRoundsInput = form.elements.namedItem("defaultMaxRounds");
    if (maxMinutesInput instanceof HTMLInputElement) {
      maxMinutesInput.value = String(settings.defaultMaxMinutes);
    }
    if (maxRoundsInput instanceof HTMLInputElement) {
      maxRoundsInput.value = String(settings.defaultMaxRounds);
    }
  }
  function syncHomeDefaults(settings) {
    const maxMinutesInput = document.querySelector("#cc-max-minutes");
    const maxRoundsInput = document.querySelector("#cc-max-rounds");
    const defaultNote = document.querySelector("[data-app-run-limit-default-note]");
    if (maxMinutesInput instanceof HTMLInputElement) {
      maxMinutesInput.value = String(settings.defaultMaxMinutes);
    }
    if (maxRoundsInput instanceof HTMLInputElement) {
      maxRoundsInput.value = String(settings.defaultMaxRounds);
    }
    if (defaultNote instanceof HTMLElement) {
      defaultNote.textContent = text(
        "默认值来自设置页，不由地图决定；这里可以临时改成任意正整数。",
        "Defaults come from Settings, not from maps; you can override them with any positive integers here.",
      );
    }
  }
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
  async function refreshSettings() {
    const settings = await requestJson("/api/app-settings/run-limits");
    viewModel.appRunLimitSettings = settings;
    viewModel.commandDraft.maxRounds = settings.defaultMaxRounds;
    viewModel.commandDraft.maxMinutes = settings.defaultMaxMinutes;
    syncSettingsForm(settings);
    syncSettingsSummary(settings);
    syncHomeDefaults(settings);
    setStatus(text("默认值已加载。", "Defaults loaded."));
  }
  async function submitSettings(form) {
    const formData = new FormData(form);
    const payload = {
      defaultMaxMinutes: Number(formData.get("defaultMaxMinutes") || 0),
      defaultMaxRounds: Number(formData.get("defaultMaxRounds") || 0),
    };
    const settings = await requestJson("/api/app-settings/run-limits", payload);
    viewModel.appRunLimitSettings = settings;
    viewModel.commandDraft.maxRounds = settings.defaultMaxRounds;
    viewModel.commandDraft.maxMinutes = settings.defaultMaxMinutes;
    syncSettingsForm(settings);
    syncSettingsSummary(settings);
    syncHomeDefaults(settings);
    setStatus(text("启动默认值已保存。", "Launch defaults saved."));
  }
  document.addEventListener("submit", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLFormElement) || !target.matches("[data-app-run-limit-settings-form]")) { return; }
    event.preventDefault();
    void submitSettings(target).catch(function (error) {
      setStatus(error instanceof Error ? error.message : text("保存失败", "Save failed"));
    });
  });
  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.closest("[data-app-run-limit-refresh]")) { return; }
    void refreshSettings().catch(function (error) {
      setStatus(error instanceof Error ? error.message : text("刷新失败", "Refresh failed"));
    });
  });
  document.addEventListener("grasseye:page-rendered", function () {
    void refreshSettings().catch(function () {
      setStatus(text("读取默认值失败。", "Failed to load defaults."));
    });
  });
  void refreshSettings().catch(function () {
    setStatus(text("读取默认值失败。", "Failed to load defaults."));
  });
})();`;