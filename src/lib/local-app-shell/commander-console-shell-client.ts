import { commanderConsoleShellClientEvents } from "./commander-console-shell-client-events.js";
import { commanderConsoleShellClientSupport } from "./commander-console-shell-client-support.js";

export const commanderConsoleShellClient = `(function () {
  const viewModel = window.__grasseyeCommanderConsoleViewModel;
  const appViewModel = window.__grasseyeCommanderAppViewModel;
  const pageHtml = window.__grasseyeCommanderConsolePageHtml || {};
  const inspectHtml = window.__grasseyeCommanderConsoleInspectHtml || {};
  if (!viewModel) { return; }

  const locale = viewModel.locale === "zh" ? "zh" : "en";
  const inspectItems = new Map((viewModel.inspectItems || []).map((item) => [item.kind + ":" + item.id, item]));
  const pageHost = document.querySelector("[data-app-page-host]");
  const inspectModal = document.querySelector("[data-inspect-modal]");
  const primaryNav = document.querySelector("[data-primary-nav]");
  const toast = document.querySelector("[data-cc-toast]");
  const tabDefaults = new Map(((appViewModel && appViewModel.tabGroups) || []).map((group) => [group.groupId, group.defaultTabId]));
  const text = {
    startSubmitted: locale === "zh" ? "启动任务命令已提交" : "Start mission command submitted",
    amazonAdminOpened: locale === "zh" ? "Amazon 后台页打开请求已提交" : "Amazon admin open submitted",
    amazonAdminBlocked: locale === "zh" ? "Amazon 后台页未打开" : "Amazon admin page not opened",
    amazonMissionSubmitted: locale === "zh" ? "Amazon 上传任务已提交" : "Amazon upload task submitted",
    amazonMissionFailed: locale === "zh" ? "Amazon 上传任务未完成" : "Amazon upload task did not complete",
    pauseSubmitted: locale === "zh" ? "暂停命令已提交" : "Pause mission command submitted",
    resumeSubmitted: locale === "zh" ? "继续命令已提交" : "Resume mission command submitted",
    stopSubmitted: locale === "zh" ? "停止命令已提交" : "Stop mission command submitted",
    emergencySubmitted: locale === "zh" ? "急停命令已提交" : "Emergency stop command submitted",
    exportUnavailable: locale === "zh" ? "当前构建未开放导出请求" : "Export requests are unavailable in this build",
    requirementRequired: locale === "zh" ? "请先填写用户需求" : "Provide a user requirement first",
    platformRequired: locale === "zh" ? "至少选择一个平台" : "Select at least one platform",
    historyReused: locale === "zh" ? "已填充历史需求" : "Requirement history loaded",
    historyDeleted: locale === "zh" ? "历史需求已删除" : "Requirement history deleted",
    copied: locale === "zh" ? "检查详情已复制" : "Inspect detail copied",
    clipboardFailed: locale === "zh" ? "剪贴板写入失败" : "Clipboard write failed",
    inspectClosed: locale === "zh" ? "检查详情已关闭" : "Inspect closed"
  };
  const state = {
    activePage: (appViewModel && appViewModel.initialPageId) || "home",
    maxRounds: viewModel.commandDraft.maxRounds,
    maxMinutes: viewModel.commandDraft.maxMinutes,
    selectedPlatforms: Array.isArray(viewModel.commandDraft.selectedPlatforms) ? [...viewModel.commandDraft.selectedPlatforms] : [],
    selectedHistoryEntryId: viewModel.commandDraft.historyEntryId || null,
    runtimeStartError: null,
    amazonAdminResult: null,
    amazonMissionResult: null,
    activeTabs: {
      mission: tabDefaults.get("mission") || "mission-overview",
      results: tabDefaults.get("results") || "results-summary",
      health: tabDefaults.get("health") || "health-capabilities"
    }
  };

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
  function showToast(message) {
    if (!toast) { return; }
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => toast.classList.remove("is-visible"), 1800);
  }
  function setTextContent(node, value) {
    if (node) { node.textContent = value; }
  }
  function buildUiUrl(overrides) {
    const url = new URL(window.location.href);
    const nextPage = overrides && overrides.page ? overrides.page : state.activePage;
    const nextLocale = overrides && overrides.locale ? overrides.locale : locale;
    if (nextLocale === "zh") { url.searchParams.set("lang", "zh"); } else { url.searchParams.delete("lang"); }
    if (nextPage && nextPage !== "home") { url.searchParams.set("page", nextPage); } else { url.searchParams.delete("page"); }
    return url;
  }
  function syncUrlState() {
    window.history.replaceState({}, "", buildUiUrl().toString());
  }
${commanderConsoleShellClientSupport}

  const handlers = {
    async onSubmitHumanCommand(draft) {
      try {
        await requestJson("POST", "/api/tasks/start", draft);
        clearRuntimeStartError();
        showToast(text.startSubmitted);
      } catch (error) {
        if (error && error.payload) { presentRuntimeStartError(error.payload); }
        showToast(error.message);
      }
    },
    async onOpenAmazonAdmin(input) {
      const payload = await requestJson("POST", "/api/plugins/amazon-invoice-upload/open-admin", input);
      presentAmazonAdminResult(payload);
      showToast(payload.ok ? text.amazonAdminOpened : text.amazonAdminBlocked);
    },
    async onStartAmazonInvoiceUpload(input) {
      const payload = await requestForm("/api/plugins/amazon-invoice-upload/start", input);
      presentAmazonMissionResult(payload);
      showToast(payload.ok ? text.amazonMissionSubmitted : text.amazonMissionFailed);
    },
    async onPauseMission() { await requestJson("POST", "/api/tasks/pause"); showToast(text.pauseSubmitted); },
    async onResumeMission() { await requestJson("POST", "/api/tasks/resume"); showToast(text.resumeSubmitted); },
    async onStopMission() { await requestJson("POST", "/api/tasks/stop", { reason: "operator_stop" }); showToast(text.stopSubmitted); },
    async onEmergencyStop() { await requestJson("POST", "/api/tasks/emergency-stop", { reason: "operator_emergency_stop" }); showToast(text.emergencySubmitted); },
    async onReuseHistoryEntry(historyId) { await requestJson("POST", "/api/user-requirements/history/" + encodeURIComponent(historyId) + "/reuse"); },
    async onDeleteHistoryEntry(historyId) {
      await requestJson("DELETE", "/api/user-requirements/history/" + encodeURIComponent(historyId));
      window.location.reload();
    },
    onRequestExport() { showToast(text.exportUnavailable); },
    onOpenInspect(payload) {
      const key = payload.kind + ":" + payload.id;
      const item = inspectItems.get(key);
      if (item) { updateInspectModal(item, inspectHtml[key] || ""); }
    }
  };
  window.commanderConsoleUi = handlers;
${commanderConsoleShellClientEvents}
})();`;
