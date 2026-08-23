
(function () {
  const viewModel = window.__grasseyeCommanderConsoleViewModel;
  const appViewModel = window.__grasseyeCommanderAppViewModel;
  const pageHtml = window.__grasseyeCommanderConsolePageHtml || {};
  const inspectHtml = window.__grasseyeCommanderConsoleInspectHtml || {};
  if (!viewModel) {
    return;
  }

  const locale = viewModel.locale === 'zh' ? 'zh' : 'en';
  const taskTemplates = new Map((viewModel.taskTemplates || []).map((template) => [template.taskTemplateId, template]));
  const inspectItems = new Map((viewModel.inspectItems || []).map((item) => [item.kind + ':' + item.id, item]));
  const pageHost = document.querySelector('[data-app-page-host]');
  const inspectModal = document.querySelector('[data-inspect-modal]');
  const bottomNav = document.querySelector('[data-bottom-nav]');
  const toast = document.querySelector('[data-cc-toast]');
  const tabDefaults = new Map(((appViewModel && appViewModel.tabGroups) || []).map((group) => [group.groupId, group.defaultTabId]));
  const text = {
    startSubmitted: locale === 'zh' ? '启动任务命令已提交' : 'Start mission command submitted',
    pauseSubmitted: locale === 'zh' ? '暂停命令已提交' : 'Pause mission command submitted',
    resumeSubmitted: locale === 'zh' ? '继续命令已提交' : 'Resume mission command submitted',
    stopSubmitted: locale === 'zh' ? '停止命令已提交' : 'Stop mission command submitted',
    emergencySubmitted: locale === 'zh' ? '急停命令已提交' : 'Emergency stop command submitted',
    reviewSubmitted: locale === 'zh' ? '复核决定已提交' : 'Review decision submitted',
    exportSubmitted: locale === 'zh' ? '导出请求已提交' : 'Export request submitted',
    templateRequired: locale === 'zh' ? '请先选择一个可启动的任务模板' : 'Select a task template that is ready to start',
    bindingRequired: locale === 'zh' ? '所选任务模板缺少内部绑定，无法启动' : 'The selected task template is missing an internal binding and cannot start',
    taskSelected: locale === 'zh' ? '已选择任务: ' : 'Task selected: ',
    jsonCopied: locale === 'zh' ? 'Inspect JSON 已复制' : 'Inspect JSON copied',
    clipboardFailed: locale === 'zh' ? '剪贴板写入失败' : 'Clipboard write failed',
    developerOpened: locale === 'zh' ? '开发者模式已打开' : 'Developer mode opened',
    developerClosed: locale === 'zh' ? '开发者模式已关闭' : 'Developer mode closed',
    inspectClosed: locale === 'zh' ? '检查详情已关闭' : 'Inspect closed'
  };
  const state = {
    activePage: (appViewModel && appViewModel.initialPageId) || 'home',
    developerModeOpen: false,
    selectedTaskTemplateId: viewModel.commandDraft.taskTemplateId || null,
    maxRounds: viewModel.commandDraft.maxRounds,
    maxMinutes: viewModel.commandDraft.maxMinutes,
    activeTabs: {
      mission: tabDefaults.get('mission') || 'mission-overview',
      results: tabDefaults.get('results') || 'results-summary',
      health: tabDefaults.get('health') || 'health-capabilities'
    }
  };

  function getStartForm() {
    return document.querySelector('[data-start-mission-form]');
  }

  function getSelectedTaskDescription() {
    return document.querySelector('[data-selected-task-description]');
  }

  function getInspectNodes() {
    return {
      title: document.querySelector('[data-inspect-title]'),
      subtitle: document.querySelector('[data-inspect-subtitle]'),
      owner: document.querySelector('[data-inspect-owner]'),
      summary: document.querySelector('[data-inspect-summary]'),
      refs: document.querySelector('[data-inspect-refs]'),
      body: document.querySelector('[data-inspect-body]')
    };
  }

  function showToast(message) {
    if (!toast) {
      return;
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 1800);
  }

  function setTextContent(node, value) {
    if (node) {
      node.textContent = value;
    }
  }

  function syncBottomNav(activePage) {
    if (!(bottomNav instanceof HTMLElement)) {
      return;
    }
    bottomNav.querySelectorAll('[data-nav-page]').forEach((button) => {
      if (button instanceof HTMLElement) {
        button.classList.toggle('is-active', button.getAttribute('data-nav-page') === activePage);
      }
    });
  }

  function syncTabUi() {
    Object.entries(state.activeTabs).forEach(([groupId, activeTabId]) => {
      document.querySelectorAll('[data-tab-group="' + groupId + '"] [data-tab-button]').forEach((button) => {
        if (button instanceof HTMLElement) {
          button.classList.toggle('is-active', button.getAttribute('data-tab-button') === activeTabId);
        }
      });
      document.querySelectorAll('[data-page-panel="' + groupId + '"]').forEach((panel) => {
        if (panel instanceof HTMLElement) {
          const panelId = panel.getAttribute('data-tab-panel');
          panel.hidden = panelId !== activeTabId;
          panel.classList.toggle('is-active', panelId === activeTabId);
        }
      });
    });
  }

  function updateTemplateUi(templateId) {
    state.selectedTaskTemplateId = templateId;
    const template = templateId ? taskTemplates.get(templateId) : null;
    const taskTemplateCards = Array.from(document.querySelectorAll('[data-task-template-card]'));
    const selectedTaskDescription = getSelectedTaskDescription();

    taskTemplateCards.forEach((card) => {
      card.classList.toggle('is-selected', card.getAttribute('data-task-template-card') === templateId);
    });

    if (!template) {
      setTextContent(selectedTaskDescription, locale === 'zh' ? '请先选择一个任务模板。' : 'Select a task template first.');
      return;
    }

    setTextContent(selectedTaskDescription, template.description);

    const startForm = getStartForm();
    if (startForm instanceof HTMLFormElement) {
      const maxRoundsInput = startForm.querySelector('#cc-max-rounds');
      const maxMinutesInput = startForm.querySelector('#cc-max-minutes');
      if (maxRoundsInput instanceof HTMLInputElement) {
        maxRoundsInput.max = String(template.maxAllowedRunLimit.maxRounds);
        maxRoundsInput.value = String(state.maxRounds || template.defaultRunLimit.maxRounds);
      }
      if (maxMinutesInput instanceof HTMLInputElement) {
        maxMinutesInput.max = String(template.maxAllowedRunLimit.maxMinutes);
        maxMinutesInput.value = String(state.maxMinutes || template.defaultRunLimit.maxMinutes);
      }
    }
  }

  function syncHomeUi() {
    const startForm = getStartForm();
    if (!(startForm instanceof HTMLFormElement)) {
      return;
    }
    const selectedId = state.selectedTaskTemplateId || viewModel.commandDraft.taskTemplateId || null;
    startForm.querySelectorAll('input[name="taskTemplateId"]').forEach((input) => {
      if (input instanceof HTMLInputElement) {
        input.checked = input.value === selectedId;
      }
    });
    updateTemplateUi(selectedId);
    const maxRoundsInput = startForm.querySelector('#cc-max-rounds');
    const maxMinutesInput = startForm.querySelector('#cc-max-minutes');
    if (maxRoundsInput instanceof HTMLInputElement) {
      maxRoundsInput.value = String(state.maxRounds);
    }
    if (maxMinutesInput instanceof HTMLInputElement) {
      maxMinutesInput.value = String(state.maxMinutes);
    }
  }

  function renderActivePage() {
    if (!(pageHost instanceof HTMLElement)) {
      return;
    }
    const nextPage = state.activePage === 'developer' && !state.developerModeOpen ? 'home' : state.activePage;
    pageHost.innerHTML = pageHtml[nextPage] || pageHtml.home || '';
    pageHost.setAttribute('data-active-page', nextPage);
    syncBottomNav(nextPage);
    syncHomeUi();
    syncTabUi();
  }

  function setDeveloperMode(nextState) {
    state.developerModeOpen = nextState;
    document.body.classList.toggle('cc-developer-open', state.developerModeOpen);
    document.querySelectorAll('[data-developer-nav]').forEach((button) => {
      if (!(button instanceof HTMLElement)) {
        return;
      }
      button.hidden = !state.developerModeOpen;
      button.dataset.developerNav = state.developerModeOpen ? 'visible' : 'hidden';
    });
    if (!state.developerModeOpen && state.activePage === 'developer') {
      state.activePage = 'home';
    }
    renderActivePage();
    showToast(state.developerModeOpen ? text.developerOpened : text.developerClosed);
  }

  function updateInspectModal(item, bodyHtml) {
    if (!(inspectModal instanceof HTMLElement)) {
      return;
    }
    const nodes = getInspectNodes();
    if (nodes.title) {
      nodes.title.textContent = item.title;
    }
    if (nodes.subtitle) {
      nodes.subtitle.textContent = item.subtitle;
    }
    if (nodes.owner) {
      nodes.owner.textContent = item.owner;
    }
    if (nodes.summary) {
      nodes.summary.textContent = item.summary;
    }
    if (nodes.refs) {
      nodes.refs.innerHTML = (item.references || []).map((reference) => '<div class="cc-inspect-ref-row"><span>' + reference.label + '</span><strong>' + reference.value + '</strong></div>').join('') || '<div class="cc-empty">No references.</div>';
    }
    if (nodes.body) {
      nodes.body.innerHTML = bodyHtml || '<div class="cc-empty">No inspect body available.</div>';
    }
    inspectModal.hidden = false;
    inspectModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cc-inspect-open');
  }

  function closeInspect() {
    if (!(inspectModal instanceof HTMLElement)) {
      return;
    }
    inspectModal.hidden = true;
    inspectModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cc-inspect-open');
    showToast(text.inspectClosed);
  }

  function collectDraft() {
    const startForm = getStartForm();
    if (!(startForm instanceof HTMLFormElement)) {
      return null;
    }
    const formData = new FormData(startForm);
    const taskTemplateId = String(formData.get('taskTemplateId') || '').trim() || null;
    const template = taskTemplateId ? taskTemplates.get(taskTemplateId) : null;
    if (!template || template.availability !== 'ready') {
      throw new Error(text.templateRequired);
    }
    if (!template.mapBinding.mapId || !template.mapBinding.requestedPlatformId) {
      throw new Error(text.bindingRequired);
    }
    const maxRounds = Number(formData.get('maxRounds') || template.defaultRunLimit.maxRounds);
    const maxMinutes = Number(formData.get('maxMinutes') || template.defaultRunLimit.maxMinutes);
    state.maxRounds = Math.max(1, Math.min(maxRounds, template.maxAllowedRunLimit.maxRounds));
    state.maxMinutes = Math.max(1, Math.min(maxMinutes, template.maxAllowedRunLimit.maxMinutes));
    return {
      commandType: 'start-mission',
      taskTemplateId,
      selectedMapId: template.mapBinding.mapId,
      requestedPlatformId: template.mapBinding.requestedPlatformId,
      humanGoal: template.defaultHumanGoal,
      targetProfileRef: template.mapBinding.targetProfileRef,
      maxRounds: state.maxRounds,
      maxMinutes: state.maxMinutes,
    };
  }

  async function post(path, body) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Request failed');
    }
    return payload;
  }

  const handlers = {
    onDraftHumanCommand() {},
    async onSubmitHumanCommand(draft) {
      if (!draft.selectedMapId || !draft.requestedPlatformId) {
        throw new Error(text.bindingRequired);
      }
      await post('/api/tasks/start', draft);
      showToast(text.startSubmitted);
    },
    async onPauseMission() {
      await post('/api/tasks/pause');
      showToast(text.pauseSubmitted);
    },
    async onResumeMission() {
      await post('/api/tasks/resume');
      showToast(text.resumeSubmitted);
    },
    async onStopMission() {
      await post('/api/tasks/stop', { reason: 'operator_stop' });
      showToast(text.stopSubmitted);
    },
    async onEmergencyStop() {
      await post('/api/tasks/emergency-stop', { reason: 'operator_emergency_stop' });
      showToast(text.emergencySubmitted);
    },
    async onSubmitReviewDecision(payload) {
      await post('/api/candidates/review-decision', payload);
      showToast(text.reviewSubmitted);
    },
    async onRequestExport(payload) {
      await post('/api/candidates/request-export', payload);
      showToast(text.exportSubmitted);
    },
    onOpenInspect(payload) {
      const key = payload.kind + ':' + payload.id;
      const item = inspectItems.get(key);
      if (item) {
        updateInspectModal(item, inspectHtml[key] || '');
      }
    },
  };

  window.commanderConsoleUi = handlers;

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const inspectButton = target.closest('[data-inspect-kind]');
    if (inspectButton instanceof HTMLElement) {
      const kind = inspectButton.getAttribute('data-inspect-kind');
      const id = inspectButton.getAttribute('data-inspect-id');
      if (kind && id) {
        handlers.onOpenInspect({ kind, id });
      }
      return;
    }

    if (target.hasAttribute('data-open-error-inspect')) {
      updateInspectModal({
        title: locale === 'zh' ? '当前错误详情' : 'Current Error Detail',
        subtitle: locale === 'zh' ? '来自 Home 的动作错误横幅' : 'Opened from the Home actionable error banner',
        owner: 'Commander Console Read Model',
        summary: locale === 'zh' ? '当前错误的完整说明。' : 'Full explanation for the current actionable error.',
        references: []
      }, inspectHtml['error:current'] || '');
      return;
    }

    if (target.hasAttribute('data-close-inspect')) {
      closeInspect();
      return;
    }

    const navTarget = target.getAttribute('data-nav-page');
    if (navTarget) {
      if (navTarget === 'developer' && !state.developerModeOpen) {
        return;
      }
      state.activePage = navTarget;
      renderActivePage();
      return;
    }

    const tabButton = target.getAttribute('data-tab-button');
    if (tabButton) {
      if (tabButton.indexOf('mission-') === 0) {
        state.activeTabs.mission = tabButton;
      } else if (tabButton.indexOf('results-') === 0) {
        state.activeTabs.results = tabButton;
      } else if (tabButton.indexOf('health-') === 0) {
        state.activeTabs.health = tabButton;
      }
      syncTabUi();
      return;
    }

    const commandAction = target.getAttribute('data-command-action');
    if (commandAction === 'pause-mission') {
      handlers.onPauseMission().catch((error) => showToast(error.message));
      return;
    }
    if (commandAction === 'resume-mission') {
      handlers.onResumeMission().catch((error) => showToast(error.message));
      return;
    }
    if (commandAction === 'stop-mission') {
      handlers.onStopMission().catch((error) => showToast(error.message));
      return;
    }
    if (commandAction === 'emergency-stop') {
      handlers.onEmergencyStop().catch((error) => showToast(error.message));
      return;
    }

    const exportType = target.getAttribute('data-export-type');
    if (exportType) {
      handlers.onRequestExport({ exportType: 'candidate-summary' }).catch((error) => showToast(error.message));
      return;
    }

    const reviewCandidateId = target.getAttribute('data-review-candidate');
    const reviewDisposition = target.getAttribute('data-review-disposition');
    if (reviewCandidateId && reviewDisposition) {
      handlers.onSubmitReviewDecision({
        candidateId: reviewCandidateId,
        disposition: reviewDisposition,
      }).catch((error) => showToast(error.message));
      return;
    }

    if (target.hasAttribute('data-copy-inspect-json')) {
      const nodes = getInspectNodes();
      const title = nodes.title ? nodes.title.textContent || 'inspect' : 'inspect';
      const summary = nodes.summary ? nodes.summary.textContent || '' : '';
      const body = nodes.body ? nodes.body.textContent || '' : '';
      navigator.clipboard.writeText(title + '\n' + summary + '\n\n' + body).then(() => showToast(text.jsonCopied)).catch(() => showToast(text.clipboardFailed));
      return;
    }

    if (target.hasAttribute('data-mode-toggle')) {
      setDeveloperMode(!state.developerModeOpen);
    }
  });

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target instanceof HTMLInputElement && target.name === 'taskTemplateId' && target.checked) {
      updateTemplateUi(target.value);
      showToast(text.taskSelected + (taskTemplates.get(target.value)?.displayName || target.value));
      return;
    }
    if (target instanceof HTMLInputElement && target.id === 'cc-max-rounds') {
      state.maxRounds = Number(target.value || state.maxRounds);
      return;
    }
    if (target instanceof HTMLInputElement && target.id === 'cc-max-minutes') {
      state.maxMinutes = Number(target.value || state.maxMinutes);
    }
  });

  document.addEventListener('submit', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLFormElement) || !target.matches('[data-start-mission-form]')) {
      return;
    }
    event.preventDefault();
    try {
      const draft = collectDraft();
      if (!draft) {
        return;
      }
      handlers.onSubmitHumanCommand(draft).catch((error) => showToast(error.message));
    } catch (error) {
      showToast(error.message);
    }
  });

  renderActivePage();
})();
