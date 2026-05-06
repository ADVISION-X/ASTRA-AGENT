export const commanderConsoleShellClientEvents = `  document.addEventListener("click", (event) => {
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
  renderActivePage();`;