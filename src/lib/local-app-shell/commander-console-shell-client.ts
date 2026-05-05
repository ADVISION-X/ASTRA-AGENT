export const commanderConsoleShellClient = `(function () {
  const viewModel = window.__grasseyeCommanderConsoleViewModel;
  const appViewModel = window.__grasseyeCommanderAppViewModel;
  const pageHtml = window.__grasseyeCommanderConsolePageHtml || {};
  const inspectHtml = window.__grasseyeCommanderConsoleInspectHtml || {};
  if (!viewModel) { return; }

  const locale = viewModel.locale === "zh" ? "zh" : "en";
  const taskTemplates = new Map((viewModel.taskTemplates || []).map((template) => [template.taskTemplateId, template]));
  const inspectItems = new Map((viewModel.inspectItems || []).map((item) => [item.kind + ":" + item.id, item]));
  const pageHost = document.querySelector("[data-app-page-host]");
  const inspectModal = document.querySelector("[data-inspect-modal]");
  const primaryNav = document.querySelector("[data-primary-nav]");
  const toast = document.querySelector("[data-cc-toast]");
  const tabDefaults = new Map(((appViewModel && appViewModel.tabGroups) || []).map((group) => [group.groupId, group.defaultTabId]));
  const text = {
    startSubmitted: locale === "zh" ? "启动任务命令已提交" : "Start mission command submitted",
    pauseSubmitted: locale === "zh" ? "暂停命令已提交" : "Pause mission command submitted",
    resumeSubmitted: locale === "zh" ? "继续命令已提交" : "Resume mission command submitted",
    stopSubmitted: locale === "zh" ? "停止命令已提交" : "Stop mission command submitted",
    emergencySubmitted: locale === "zh" ? "急停命令已提交" : "Emergency stop command submitted",
    reviewSubmitted: locale === "zh" ? "复核决定已提交" : "Review decision submitted",
    exportUnavailable: locale === "zh" ? "当前构建未开放导出请求" : "Export requests are unavailable in this build",
    templateRequired: locale === "zh" ? "请先选择一个可启动的任务" : "Select a runnable task first",
    taskSelected: locale === "zh" ? "已选择任务: " : "Task selected: ",
    copied: locale === "zh" ? "检查详情已复制" : "Inspect detail copied",
    clipboardFailed: locale === "zh" ? "剪贴板写入失败" : "Clipboard write failed",
    inspectClosed: locale === "zh" ? "检查详情已关闭" : "Inspect closed"
  };
  const state = {
    activePage: (appViewModel && appViewModel.initialPageId) || "home",
    selectedTaskTemplateId: viewModel.commandDraft.taskTemplateId || null,
    maxRounds: viewModel.commandDraft.maxRounds,
    maxMinutes: viewModel.commandDraft.maxMinutes,
    runtimeStartError: null,
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
  function getStartForm() {
    return document.querySelector("[data-start-mission-form]");
  }
  function getSelectedTaskDescription() {
    return document.querySelector("[data-selected-task-description]");
  }
  function localizeSafetyLevel(safetyLevel) {
    switch (String(safetyLevel || "").trim().toLowerCase()) {
      case "guarded autopilot":
        return locale === "zh" ? "守护自动执行" : "Guarded Autopilot";
      case "review-first":
        return locale === "zh" ? "先审后跑" : "Review First";
      case "execution blocked":
        return locale === "zh" ? "禁止直接执行" : "Execution Blocked";
      default:
        return safetyLevel || "";
    }
  }
  function getInspectNodes() {
    return {
      title: document.querySelector("[data-inspect-title]"),
      subtitle: document.querySelector("[data-inspect-subtitle]"),
      owner: document.querySelector("[data-inspect-owner]"),
      summary: document.querySelector("[data-inspect-summary]"),
      refs: document.querySelector("[data-inspect-refs]"),
      body: document.querySelector("[data-inspect-body]")
    };
  }
  function clearRuntimeStartError() {
    state.runtimeStartError = null;
    document.querySelectorAll('[data-runtime-start-error="true"]').forEach((node) => node.remove());
  }
  function presentRuntimeStartError(payload) {
    state.runtimeStartError = payload;
    const homePage = document.querySelector("[data-home-page]");
    if (!(homePage instanceof HTMLElement)) { return; }
    let banner = homePage.querySelector('[data-runtime-start-error="true"]');
    if (!(banner instanceof HTMLElement)) {
      banner = document.createElement("section");
      banner.setAttribute("data-error-banner", "");
      banner.setAttribute("data-runtime-start-error", "true");
      const grid = homePage.querySelector(".cc-home-grid");
      if (grid instanceof HTMLElement) { homePage.insertBefore(banner, grid); } else { homePage.appendChild(banner); }
    }
    banner.className = "cc-error-banner cc-tone-blocked";
    banner.innerHTML = "<div><strong>" + escapeHtml(locale === "zh" ? "任务无法启动，启动前预检未通过" : "Mission start blocked by preflight") + "</strong><p>" + escapeHtml(payload.actionableMessage || payload.failureReason || "") + "</p><small>" + escapeHtml(payload.nextAction || "") + "</small></div><div class=\\"cc-inline-actions\\"><button type=\\"button\\" class=\\"cc-button cc-button-tight\\" data-open-error-inspect>" + escapeHtml(locale === "zh" ? "查看详情" : "Inspect") + "</button><button type=\\"button\\" class=\\"cc-button cc-button-tight\\" data-nav-page=\\"health\\">" + escapeHtml(locale === "zh" ? "打开诊断" : "Open Diagnostics") + "</button></div>";
  }
  function syncPrimaryNav(activePage) {
    if (!(primaryNav instanceof HTMLElement)) { return; }
    primaryNav.querySelectorAll("[data-nav-page]").forEach((button) => {
      if (button instanceof HTMLElement) {
        button.classList.toggle("is-active", button.getAttribute("data-nav-page") === activePage);
      }
    });
  }
  function syncTabUi() {
    Object.entries(state.activeTabs).forEach(([groupId, activeTabId]) => {
      document.querySelectorAll('[data-tab-group="' + groupId + '"] [data-tab-button]').forEach((button) => {
        if (button instanceof HTMLElement) {
          button.classList.toggle("is-active", button.getAttribute("data-tab-button") === activeTabId);
        }
      });
      document.querySelectorAll('[data-page-panel="' + groupId + '"]').forEach((panel) => {
        if (panel instanceof HTMLElement) {
          const panelId = panel.getAttribute("data-tab-panel");
          panel.hidden = panelId !== activeTabId;
          panel.classList.toggle("is-active", panelId === activeTabId);
        }
      });
    });
  }
  function updateTemplateUi(templateId) {
    state.selectedTaskTemplateId = templateId;
    const template = templateId ? taskTemplates.get(templateId) : null;
    document.querySelectorAll("[data-task-template-card]").forEach((card) => {
      card.classList.toggle("is-selected", card.getAttribute("data-task-template-card") === templateId);
    });
    if (!template) {
      setTextContent(getSelectedTaskDescription(), locale === "zh" ? "请先选择一个任务。" : "Select a task first.");
      setTextContent(document.querySelector("[data-selected-task-title]"), locale === "zh" ? "请选择一个地图" : "Choose a map");
      setTextContent(document.querySelector("[data-selected-task-category]"), locale === "zh" ? "未选择" : "None");
      setTextContent(document.querySelector("[data-selected-task-safety]"), locale === "zh" ? "未选择" : "None");
      return;
    }
    setTextContent(getSelectedTaskDescription(), template.description);
    setTextContent(document.querySelector("[data-selected-task-title]"), template.displayName);
    setTextContent(document.querySelector("[data-selected-task-category]"), template.taskCategory);
    setTextContent(document.querySelector("[data-selected-task-safety]"), localizeSafetyLevel(template.safetyLevel));
    const goalInput = document.querySelector("#cc-human-goal");
    if (goalInput instanceof HTMLTextAreaElement && (!goalInput.value.trim() || goalInput.dataset.currentDefaultGoal === goalInput.value)) {
      goalInput.value = template.defaultHumanGoal || "";
      goalInput.dataset.currentDefaultGoal = template.defaultHumanGoal || "";
    }
    const startForm = getStartForm();
    if (startForm instanceof HTMLFormElement) {
      const maxRoundsInput = startForm.querySelector("#cc-max-rounds");
      const maxMinutesInput = startForm.querySelector("#cc-max-minutes");
      if (maxRoundsInput instanceof HTMLInputElement) {
        maxRoundsInput.max = String(template.maxAllowedRunLimit.maxRounds);
        const nextRounds = Math.min(Number(state.maxRounds || template.defaultRunLimit.maxRounds), template.maxAllowedRunLimit.maxRounds);
        state.maxRounds = nextRounds;
        maxRoundsInput.value = String(nextRounds);
      }
      if (maxMinutesInput instanceof HTMLInputElement) {
        maxMinutesInput.max = String(template.maxAllowedRunLimit.maxMinutes);
        const nextMinutes = Math.min(Number(state.maxMinutes || template.defaultRunLimit.maxMinutes), template.maxAllowedRunLimit.maxMinutes);
        state.maxMinutes = nextMinutes;
        maxMinutesInput.value = String(nextMinutes);
      }
    }
  }
  function applyTemplateFilters() {
    const searchInput = document.querySelector("[data-template-search]");
    const query = searchInput instanceof HTMLInputElement ? searchInput.value.trim().toLowerCase() : "";
    const activeFilter = document.querySelector("[data-template-filter].is-active");
    const filter = activeFilter instanceof HTMLElement ? activeFilter.getAttribute("data-template-filter") || "all" : "all";
    document.querySelectorAll("[data-task-template-card]").forEach((card) => {
      if (!(card instanceof HTMLElement)) { return; }
      const text = card.getAttribute("data-template-search-text") || "";
      const category = card.getAttribute("data-template-category") || "";
      const ready = card.getAttribute("data-template-ready") === "true";
      const recommended = card.getAttribute("data-template-recommended") === "true";
      const matchesQuery = !query || text.indexOf(query) >= 0;
      const matchesFilter = filter === "all" || (filter === "ready" && ready) || (filter === "recommended" && recommended) || category === filter;
      card.hidden = !(matchesQuery && matchesFilter);
    });
  }
  function syncHomeUi() {
    const startForm = getStartForm();
    if (!(startForm instanceof HTMLFormElement)) { return; }
    const selectedId = state.selectedTaskTemplateId || viewModel.commandDraft.taskTemplateId || null;
    startForm.querySelectorAll('input[name="taskTemplateId"]').forEach((input) => {
      if (input instanceof HTMLInputElement) { input.checked = input.value === selectedId; }
    });
    updateTemplateUi(selectedId);
  }
  function renderActivePage() {
    if (!(pageHost instanceof HTMLElement)) { return; }
    pageHost.innerHTML = pageHtml[state.activePage] || pageHtml.home || "";
    pageHost.setAttribute("data-active-page", state.activePage);
    syncPrimaryNav(state.activePage);
    syncHomeUi();
    syncTabUi();
    syncUrlState();
    document.dispatchEvent(new CustomEvent("grasseye:page-rendered"));
  }
  function updateInspectModal(item, bodyHtml) {
    if (!(inspectModal instanceof HTMLElement)) { return; }
    const nodes = getInspectNodes();
    if (nodes.title) { nodes.title.textContent = item.title; }
    if (nodes.subtitle) { nodes.subtitle.textContent = item.subtitle; }
    if (nodes.owner) { nodes.owner.textContent = item.owner; }
    if (nodes.summary) { nodes.summary.textContent = item.summary; }
    if (nodes.refs) {
      nodes.refs.innerHTML = (item.references || []).map((reference) => "<div class=\\"cc-inspect-ref-row\\"><span>" + escapeHtml(reference.label) + "</span><strong>" + escapeHtml(reference.value) + "</strong></div>").join("") || "<div class=\\"cc-empty\\">" + (locale === "zh" ? "当前没有引用。" : "No references yet.") + "</div>";
    }
    if (nodes.body) {
      nodes.body.innerHTML = bodyHtml || "<div class=\\"cc-empty\\">" + (locale === "zh" ? "当前没有检查内容。" : "No inspect content available.") + "</div>";
    }
    inspectModal.hidden = false;
    inspectModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("cc-inspect-open");
  }
  function closeInspect() {
    if (!(inspectModal instanceof HTMLElement)) { return; }
    inspectModal.hidden = true;
    inspectModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("cc-inspect-open");
    showToast(text.inspectClosed);
  }
  function collectDraft() {
    const startForm = getStartForm();
    if (!(startForm instanceof HTMLFormElement)) { return null; }
    const formData = new FormData(startForm);
    const taskTemplateId = String(formData.get("taskTemplateId") || "").trim() || null;
    const template = taskTemplateId ? taskTemplates.get(taskTemplateId) : null;
    if (!template || template.availability !== "ready") { throw new Error(text.templateRequired); }
    const maxRounds = Number(formData.get("maxRounds") || template.defaultRunLimit.maxRounds);
    const maxMinutes = Number(formData.get("maxMinutes") || template.defaultRunLimit.maxMinutes);
    state.maxRounds = Math.max(1, Math.min(maxRounds, template.maxAllowedRunLimit.maxRounds));
    state.maxMinutes = Math.max(1, Math.min(maxMinutes, template.maxAllowedRunLimit.maxMinutes));
    const humanGoal = String(formData.get("humanGoal") || template.defaultHumanGoal || "").trim();
    return {
      commandType: "start-mission",
      commandSource: "commander-console:start-form-submit",
      taskTemplateId,
      humanGoal,
      maxRounds: state.maxRounds,
      maxMinutes: state.maxMinutes
    };
  }
  async function post(path, body) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.actionableMessage || payload.failureReason || payload.error || (locale === "zh" ? "请求失败" : "Request failed"));
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  const handlers = {
    async onSubmitHumanCommand(draft) {
      try {
        await post("/api/tasks/start", draft);
        clearRuntimeStartError();
        showToast(text.startSubmitted);
      } catch (error) {
        if (error && error.payload) { presentRuntimeStartError(error.payload); }
        showToast(error.message);
      }
    },
    async onPauseMission() { await post("/api/tasks/pause"); showToast(text.pauseSubmitted); },
    async onResumeMission() { await post("/api/tasks/resume"); showToast(text.resumeSubmitted); },
    async onStopMission() { await post("/api/tasks/stop", { reason: "operator_stop" }); showToast(text.stopSubmitted); },
    async onEmergencyStop() { await post("/api/tasks/emergency-stop", { reason: "operator_emergency_stop" }); showToast(text.emergencySubmitted); },
    async onSubmitReviewDecision(payload) { await post("/api/candidates/review-decision", payload); showToast(text.reviewSubmitted); },
    onRequestExport() { showToast(text.exportUnavailable); },
    onOpenInspect(payload) {
      const key = payload.kind + ":" + payload.id;
      const item = inspectItems.get(key);
      if (item) { updateInspectModal(item, inspectHtml[key] || ""); }
    }
  };
  window.commanderConsoleUi = handlers;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) { return; }
    const inspectButton = target.closest("[data-inspect-kind]");
    if (inspectButton instanceof HTMLElement) {
      const kind = inspectButton.getAttribute("data-inspect-kind");
      const id = inspectButton.getAttribute("data-inspect-id");
      if (kind && id) { handlers.onOpenInspect({ kind, id }); }
      return;
    }
    if (target.closest("[data-open-error-inspect]") instanceof HTMLElement) {
      if (state.runtimeStartError) {
        const payload = state.runtimeStartError;
        updateInspectModal({
          title: locale === "zh" ? "任务启动阻断详情" : "Mission Start Blocked",
          subtitle: locale === "zh" ? "来自启动预检的后端拒绝载荷" : "Backend rejection payload from start preflight",
          owner: payload.ownerResponsible || "Commander Console / Orchestration",
          summary: payload.actionableMessage || payload.failureReason || "",
          references: [
            { label: "traceId", value: payload.traceId || "none" },
            { label: "attemptId", value: payload.attemptId || "none" }
          ]
        }, "<div class=\\"cc-stack\\"><div class=\\"cc-inspect-ref-row\\"><span>" + escapeHtml(locale === "zh" ? "发生了什么" : "What happened") + "</span><strong>" + escapeHtml(payload.actionableMessage || payload.failureReason || "") + "</strong></div><div class=\\"cc-inspect-ref-row\\"><span>" + escapeHtml(locale === "zh" ? "该怎么办" : "What to do") + "</span><strong>" + escapeHtml(payload.nextAction || "") + "</strong></div></div>");
      }
      return;
    }
    if (target.closest("[data-close-inspect]") instanceof HTMLElement) { closeInspect(); return; }
    const localeSwitch = target.closest("[data-locale-switch]");
    const nextLocale = localeSwitch instanceof HTMLElement ? localeSwitch.getAttribute("data-locale-switch") : null;
    if (nextLocale === "zh" || nextLocale === "en") {
      if (nextLocale !== locale) { window.location.assign(buildUiUrl({ locale: nextLocale }).toString()); }
      return;
    }
    const navButton = target.closest("[data-nav-page]");
    const navTarget = navButton instanceof HTMLElement ? navButton.getAttribute("data-nav-page") : null;
    if (navTarget) { state.activePage = pageHtml[navTarget] ? navTarget : "home"; renderActivePage(); return; }
    const tabTrigger = target.closest("[data-tab-button]");
    const tabButton = tabTrigger instanceof HTMLElement ? tabTrigger.getAttribute("data-tab-button") : null;
    if (tabButton) {
      if (tabButton.indexOf("mission-") === 0) { state.activeTabs.mission = tabButton; }
      else if (tabButton.indexOf("results-") === 0) { state.activeTabs.results = tabButton; }
      else if (tabButton.indexOf("health-") === 0) { state.activeTabs.health = tabButton; }
      syncTabUi();
      return;
    }
    const commandTrigger = target.closest("[data-command-action]");
    const commandAction = commandTrigger instanceof HTMLElement ? commandTrigger.getAttribute("data-command-action") : null;
    if (commandAction === "pause-mission") { handlers.onPauseMission().catch((error) => showToast(error.message)); return; }
    if (commandAction === "resume-mission") { handlers.onResumeMission().catch((error) => showToast(error.message)); return; }
    if (commandAction === "stop-mission") { handlers.onStopMission().catch((error) => showToast(error.message)); return; }
    if (commandAction === "emergency-stop") { handlers.onEmergencyStop().catch((error) => showToast(error.message)); return; }
    const exportTrigger = target.closest("[data-export-type]");
    if (exportTrigger instanceof HTMLElement) { handlers.onRequestExport(); return; }
    const reviewTrigger = target.closest("[data-review-candidate][data-review-disposition]");
    const reviewCandidateId = reviewTrigger instanceof HTMLElement ? reviewTrigger.getAttribute("data-review-candidate") : null;
    const reviewDisposition = reviewTrigger instanceof HTMLElement ? reviewTrigger.getAttribute("data-review-disposition") : null;
    if (reviewCandidateId && (reviewDisposition === "approve" || reviewDisposition === "reject" || reviewDisposition === "pending")) {
      handlers.onSubmitReviewDecision({ candidateId: reviewCandidateId, disposition: reviewDisposition }).catch((error) => showToast(error.message));
      return;
    }
    if (target.closest("[data-copy-inspect-json]") instanceof HTMLElement) {
      const nodes = getInspectNodes();
      const title = nodes.title ? nodes.title.textContent || "inspect" : "inspect";
      const summary = nodes.summary ? nodes.summary.textContent || "" : "";
      const body = nodes.body ? nodes.body.textContent || "" : "";
      navigator.clipboard.writeText(title + "\\n" + summary + "\\n\\n" + body).then(() => showToast(text.copied)).catch(() => showToast(text.clipboardFailed));
    }
    const filterButton = target.closest("[data-template-filter]");
    if (filterButton instanceof HTMLElement) {
      document.querySelectorAll("[data-template-filter]").forEach((button) => button.classList.toggle("is-active", button === filterButton));
      applyTemplateFilters();
    }
  });
  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.matches("[data-template-search]")) {
      applyTemplateFilters();
    }
  });
  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) { return; }
    if (target instanceof HTMLInputElement && target.name === "taskTemplateId" && target.checked) {
      updateTemplateUi(target.value);
      showToast(text.taskSelected + (taskTemplates.get(target.value)?.displayName || target.value));
      return;
    }
    if (target instanceof HTMLInputElement && target.id === "cc-max-rounds") { state.maxRounds = Number(target.value || state.maxRounds); return; }
    if (target instanceof HTMLInputElement && target.id === "cc-max-minutes") { state.maxMinutes = Number(target.value || state.maxMinutes); return; }
    if (target instanceof HTMLSelectElement && target.matches("[data-settings-locale-select]")) {
      window.location.assign(buildUiUrl({ locale: target.value === "en" ? "en" : "zh" }).toString());
    }
  });
  document.addEventListener("submit", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLFormElement) || !target.matches("[data-start-mission-form]")) { return; }
    event.preventDefault();
    try {
      const draft = collectDraft();
      if (draft) { handlers.onSubmitHumanCommand(draft); }
    } catch (error) {
      showToast(error.message);
    }
  });
  renderActivePage();
})();`;
