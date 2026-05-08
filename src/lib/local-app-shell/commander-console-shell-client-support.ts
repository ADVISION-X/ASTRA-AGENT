export const commanderConsoleShellClientSupport = `
  function getStartForm() {
    return document.querySelector("[data-start-mission-form]");
  }
  function getSelectedTaskDescription() {
    return document.querySelector("[data-selected-task-description]");
  }
  function getHomePage() {
    return pageHost instanceof HTMLElement ? pageHost.querySelector("[data-home-page]") : null;
  }
  function getRuntimeStartErrorBanner() {
    const homePage = getHomePage();
    if (!(homePage instanceof HTMLElement)) { return null; }
    const banner = homePage.querySelector("[data-runtime-start-error]");
    return banner instanceof HTMLElement ? banner : null;
  }
  function getInspectNodes() {
    if (!(inspectModal instanceof HTMLElement)) {
      return { title: null, subtitle: null, owner: null, summary: null, refs: null, body: null };
    }
    return {
      title: inspectModal.querySelector("[data-inspect-title]"),
      subtitle: inspectModal.querySelector("[data-inspect-subtitle]"),
      owner: inspectModal.querySelector("[data-inspect-owner]"),
      summary: inspectModal.querySelector("[data-inspect-summary]"),
      refs: inspectModal.querySelector("[data-inspect-refs]"),
      body: inspectModal.querySelector("[data-inspect-body]")
    };
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
  function resolvePositiveInteger(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
  }
  function clearRuntimeStartError() {
    state.runtimeStartError = null;
    const banner = getRuntimeStartErrorBanner();
    if (banner instanceof HTMLElement) { banner.remove(); }
  }
  function presentRuntimeStartError(payload) {
    state.runtimeStartError = payload;
    state.activePage = "home";
    renderActivePage();
    const homePage = getHomePage();
    if (!(homePage instanceof HTMLElement)) { return; }
    let banner = getRuntimeStartErrorBanner();
    if (!(banner instanceof HTMLElement)) {
      banner = document.createElement("section");
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
    if (startForm instanceof HTMLFormElement) { return; }
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
    const maxRounds = resolvePositiveInteger(formData.get("maxRounds"));
    const maxMinutes = resolvePositiveInteger(formData.get("maxMinutes"));
    state.maxRounds = maxRounds || viewModel.appRunLimitSettings.defaultMaxRounds;
    state.maxMinutes = maxMinutes || viewModel.appRunLimitSettings.defaultMaxMinutes;
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
`;