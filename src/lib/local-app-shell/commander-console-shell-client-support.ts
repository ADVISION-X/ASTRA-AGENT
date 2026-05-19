export const commanderConsoleShellClientSupport = `
  function getStartForm() {
    return document.querySelector("[data-start-mission-form]");
  }
  function getAmazonInvoiceUploadPage() {
    return pageHost instanceof HTMLElement ? pageHost.querySelector("[data-amazon-invoice-upload-page]") : null;
  }
  function getAmazonAdminOpenForm() {
    return document.querySelector("[data-amazon-admin-open-form]");
  }
  function getAmazonMissionStartForm() {
    return document.querySelector("[data-amazon-invoice-upload-form]");
  }
  function getAmazonAdminResultHost() {
    const page = getAmazonInvoiceUploadPage();
    return page instanceof HTMLElement ? page.querySelector("[data-amazon-admin-result]") : null;
  }
  function getAmazonMissionResultHost() {
    const page = getAmazonInvoiceUploadPage();
    return page instanceof HTMLElement ? page.querySelector("[data-amazon-upload-result]") : null;
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
  function syncPlatformUi() {
    document.querySelectorAll("[data-platform-option]").forEach((card) => {
      if (!(card instanceof HTMLElement)) { return; }
      const platformId = card.getAttribute("data-platform-option") || "";
      card.classList.toggle("is-selected", state.selectedPlatforms.includes(platformId));
      const input = card.querySelector('input[name="selectedPlatforms"]');
      if (input instanceof HTMLInputElement) {
        input.checked = state.selectedPlatforms.includes(input.value);
      }
    });
    const hiddenInput = document.querySelector("[data-selected-history-entry-id]");
    if (hiddenInput instanceof HTMLInputElement) {
      hiddenInput.value = state.selectedHistoryEntryId || "";
    }
    document.querySelectorAll("[data-history-entry-id]").forEach((card) => {
      if (card instanceof HTMLElement) {
        card.classList.toggle("is-selected", card.getAttribute("data-history-entry-id") === state.selectedHistoryEntryId);
      }
    });
  }
  function populateHistoryDraft(button) {
    const requirementInput = document.querySelector("#cc-user-requirement-text");
    const maxRoundsInput = document.querySelector("#cc-max-rounds");
    const maxMinutesInput = document.querySelector("#cc-max-minutes");
    const rawPlatforms = button.getAttribute("data-history-platforms") || "";
    const nextPlatforms = rawPlatforms.split(",").map((item) => item.trim()).filter(Boolean);
    state.selectedPlatforms = nextPlatforms;
    state.selectedHistoryEntryId = button.getAttribute("data-history-reuse") || null;
    if (requirementInput instanceof HTMLTextAreaElement) {
      requirementInput.value = button.getAttribute("data-history-requirement") || "";
    }
    if (maxRoundsInput instanceof HTMLInputElement) {
      maxRoundsInput.value = button.getAttribute("data-history-max-rounds") || String(state.maxRounds);
      state.maxRounds = Number(maxRoundsInput.value || state.maxRounds);
    }
    if (maxMinutesInput instanceof HTMLInputElement) {
      maxMinutesInput.value = button.getAttribute("data-history-max-minutes") || String(state.maxMinutes);
      state.maxMinutes = Number(maxMinutesInput.value || state.maxMinutes);
    }
    syncPlatformUi();
  }
  function syncHomeUi() {
    const startForm = getStartForm();
    if (!(startForm instanceof HTMLFormElement)) { return; }
    syncPlatformUi();
  }
  function presentAmazonAdminResult(payload) {
    state.amazonAdminResult = payload;
    const host = getAmazonAdminResultHost();
    if (!(host instanceof HTMLElement)) { return; }
    if (!payload) {
      host.innerHTML = "<div class=\"cc-empty\">" + escapeHtml(locale === "zh" ? "还没有后台打开结果。" : "No admin open result yet.") + "</div>";
      return;
    }
    host.innerHTML = "<div class=\"cc-developer-grid\"><div><span>status</span><strong>" + escapeHtml(payload.ok ? (locale === "zh" ? "已打开" : "opened") : (locale === "zh" ? "被阻断" : "blocked")) + "</strong></div><div><span>currentUrl</span><strong>" + escapeHtml(payload.currentUrl || "") + "</strong></div><div><span>error</span><strong>" + escapeHtml(payload.error || "none") + "</strong></div><div><span>detail</span><strong>" + escapeHtml(payload.failureReason || (locale === "zh" ? "允许继续下一步。" : "Ready for the next step.")) + "</strong></div></div>";
  }
  function presentAmazonMissionResult(payload) {
    state.amazonMissionResult = payload;
    const host = getAmazonMissionResultHost();
    if (!(host instanceof HTMLElement)) { return; }
    if (!payload) {
      host.innerHTML = "<div class=\"cc-empty\">" + escapeHtml(locale === "zh" ? "还没有任务结果。" : "No mission result yet.") + "</div>";
      return;
    }
    host.innerHTML = "<div class=\"cc-developer-grid\"><div><span>taskId</span><strong>" + escapeHtml(payload.taskId || "none") + "</strong></div><div><span>status</span><strong>" + escapeHtml(payload.status || "unknown") + "</strong></div><div><span>reachedStep</span><strong>" + escapeHtml(payload.reachedStep || "") + "</strong></div><div><span>reason</span><strong>" + escapeHtml(payload.reason || "") + "</strong></div><div><span>evidence</span><strong>" + escapeHtml(payload.evidenceRef || "none") + "</strong></div></div>";
  }
  function syncAmazonInvoiceUploadUi() {
    presentAmazonAdminResult(state.amazonAdminResult);
    presentAmazonMissionResult(state.amazonMissionResult);
  }
  function collectAmazonAdminDraft() {
    const form = getAmazonAdminOpenForm();
    if (!(form instanceof HTMLFormElement)) { return null; }
    const formData = new FormData(form);
    const adminUrl = String(formData.get("adminUrl") || "").trim();
    if (!adminUrl) { throw new Error(locale === "zh" ? "请填写后台地址" : "Provide an admin URL"); }
    return { adminUrl };
  }
  function collectAmazonMissionDraft() {
    const form = getAmazonMissionStartForm();
    if (!(form instanceof HTMLFormElement)) { return null; }
    const formData = new FormData(form);
    const marketplace = String(formData.get("marketplace") || "").trim();
    const amazonOrderId = String(formData.get("amazonOrderId") || "").trim();
    const invoiceNo = String(formData.get("invoiceNo") || "").trim();
    const invoicePdf = formData.get("invoicePdf");
    const sellerCentralEntryUrl = String(formData.get("sellerCentralEntryUrl") || "").trim();
    const adminOrderUrl = String(formData.get("adminOrderUrl") || "").trim();
    if (!marketplace || !amazonOrderId || !invoiceNo || !(invoicePdf instanceof File) || !invoicePdf.name || !sellerCentralEntryUrl) {
      throw new Error(locale === "zh" ? "请完整填写 Amazon 上传任务参数并选择 PDF" : "Provide all required Amazon upload task fields and choose a PDF");
    }
    const payload = new FormData();
    payload.set("mission", JSON.stringify({
      missionType: "amazon_invoice_upload",
      marketplace,
      amazonOrderId,
      invoiceNo,
      invoicePdfPath: "approved-task-file://pending",
      sellerCentralEntryUrl,
      adminOrderUrl: adminOrderUrl || undefined,
      requireHumanFinalSubmit: formData.get("requireHumanFinalSubmit") === "on"
    }));
    payload.set("invoicePdf", invoicePdf);
    return payload;
  }
  function renderActivePage() {
    if (!(pageHost instanceof HTMLElement)) { return; }
    pageHost.innerHTML = pageHtml[state.activePage] || pageHtml.home || "";
    pageHost.setAttribute("data-active-page", state.activePage);
    syncPrimaryNav(state.activePage);
    syncHomeUi();
    syncAmazonInvoiceUploadUi();
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
    const userRequirementText = String(formData.get("userRequirementText") || "").trim();
    if (!userRequirementText) { throw new Error(text.requirementRequired); }
    const selectedPlatforms = formData.getAll("selectedPlatforms").map((value) => String(value).trim()).filter(Boolean);
    if (selectedPlatforms.length === 0) { throw new Error(text.platformRequired); }
    const maxRounds = resolvePositiveInteger(formData.get("maxRounds"));
    const maxMinutes = resolvePositiveInteger(formData.get("maxMinutes"));
    state.maxRounds = maxRounds || viewModel.appRunLimitSettings.defaultMaxRounds;
    state.maxMinutes = maxMinutes || viewModel.appRunLimitSettings.defaultMaxMinutes;
    state.selectedPlatforms = selectedPlatforms;
    state.selectedHistoryEntryId = String(formData.get("historyEntryId") || "").trim() || null;
    return {
      commandType: "start-mission",
      commandSource: "commander-console:start-form-submit",
      userRequirementText,
      selectedPlatforms,
      historyEntryId: state.selectedHistoryEntryId,
      maxRounds: state.maxRounds,
      maxMinutes: state.maxMinutes
    };
  }
  async function requestJson(method, path, body) {
    const response = await fetch(path, {
      method,
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
  async function requestForm(path, formData) {
    const response = await fetch(path, { method: "POST", body: formData });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.actionableMessage || payload.failureReason || payload.error || (locale === "zh" ? "请求失败" : "Request failed"));
      error.payload = payload;
      throw error;
    }
    return payload;
  }
`;
