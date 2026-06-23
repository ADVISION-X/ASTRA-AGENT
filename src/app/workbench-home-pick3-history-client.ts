const PICK3_HISTORY_CLIENT = `
const isPick3ResumableStatus = (status) => status === "running" || status === "paused_rate_limited";

const updatePick3HistoryContinueButton = (summary) => {
  const button = qs("[data-pick3-history-continue]");
  if (!button) return;
  const canContinue = Boolean(summary?.taskId && isPick3ResumableStatus(summary.status));
  button.disabled = !canContinue;
  button.dataset.pick3HistorySelectedTaskId = summary?.taskId || "";
};

const markPick3HistorySelectedRow = (taskId) => {
  document.querySelectorAll("button.record-item[data-pick3-history-task-id]").forEach((item) => {
    const selected = item.dataset.pick3HistoryTaskId === taskId;
    item.classList.toggle("selected", selected);
    item.setAttribute("aria-pressed", selected ? "true" : "false");
  });
};

const renderPick3HistoryRows = (tasks) => {
  const list = qs("[data-pick3-history-list]");
  if (!list) return;
  list.innerHTML = "";
  const records = Array.isArray(tasks) ? tasks : [];
  setText("[data-pick3-history-count]", String(records.length));
  for (const task of records) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "record-item";
    item.dataset.pick3HistoryTaskId = task.taskId;
    item.dataset.pick3HistoryStatus = task.status || "";
    item.dataset.pick3HistoryResumable = isPick3ResumableStatus(task.status) ? "true" : "false";
    item.setAttribute("aria-pressed", "false");
    const title = document.createElement("strong");
    title.textContent = (task.newestOfficialPhase || "-") + " -> " + (task.targetPhase || "-");
    const meta = document.createElement("div");
    meta.className = "record-meta";
    meta.textContent = [
      task.taskMode || "-",
      task.status,
      task.providerKind || "-",
      "batch " + (task.batchId || "-"),
      "repeat " + (task.repeatCount ?? "-"),
    ].join(" · ");
    const proof = document.createElement("div");
    proof.textContent = "raw " + task.rawAnswerCount + "/" + task.expectedRepeatResults + " · " + task.taskId;
    item.append(title, meta, proof);
    item.addEventListener("click", () => loadPick3HistoryTask(task.taskId));
    list.append(item);
  }
};

const clearPick3HistoryDetail = () => {
  state.pick3HistorySelectedTask = null;
  updatePick3HistoryContinueButton(null);
  markPick3HistorySelectedRow("");
  setText("[data-pick3-history-task-id]", "-");
  setText("[data-pick3-history-status]", "-");
  setText("[data-pick3-history-phase]", "-");
  setText("[data-pick3-history-window]", "-");
  setText("[data-pick3-history-provider]", "-");
  setText("[data-pick3-history-scoring]", "-");
  setText("[data-pick3-history-repeats]", "-");
  setText("[data-pick3-history-completeness]", "-");
  setText("[data-pick3-history-distribution]", "-");
  const imageList = qs("[data-pick3-history-image-list]");
  const phaseReportList = qs("[data-pick3-history-phase-report-list]");
  const lessonList = qs("[data-pick3-history-lesson-list]");
  const repeatList = qs("[data-pick3-history-repeat-list]");
  if (imageList) imageList.innerHTML = "";
  if (phaseReportList) phaseReportList.innerHTML = "";
  if (lessonList) lessonList.innerHTML = "";
  if (repeatList) repeatList.innerHTML = "";
};

const renderPick3HistoryImages = (images) => {
  const list = qs("[data-pick3-history-image-list]");
  if (!list) return;
  list.innerHTML = "";
  for (const image of images || []) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "record-item";
    const title = document.createElement("strong");
    title.textContent = image.position + " · " + image.imageId;
    const meta = document.createElement("div");
    meta.className = "record-meta";
    meta.textContent = (image.targetPhase || "-") + " · " + (image.visibleStartPhase || "-") + "..." + (image.visibleEndPhase || "-");
    const proof = document.createElement("div");
    proof.textContent = "sha256 " + (image.imageSha256 || "-");
    item.append(title, meta, proof);
    item.addEventListener("click", () => openInspector({ kind: "pick3 history image", title: title.textContent, payload: image }));
    list.append(item);
  }
};

const renderPick3ObservedDistribution = (distribution) => {
  const node = qs("[data-pick3-history-distribution]");
  if (!node) return;
  const positionEntries = Object.entries(distribution || {});
  node.textContent = positionEntries.length
    ? positionEntries.map(([position, labelCounts]) => position + " [" + Object.entries(labelCounts || {}).map(([label, count]) => label + ": " + count).join(" · ") + "]").join("  ||  ")
    : "-";
};

const runPick3ManualPlaybookReview = async (taskId, phase, position) => {
  const result = await readJson("/api/pick3-is-blind-eval/playbook-review", {
    method: "POST",
    body: JSON.stringify({ taskId, phase, position }),
  });
  writeActivity("pick3 playbook lesson reviewed: " + result.position + " " + result.phase, "completed");
  await loadPick3HistoryTask(taskId);
};

const renderPick3PhaseReports = (taskId, phaseReports) => {
  const list = qs("[data-pick3-history-phase-report-list]");
  if (!list) return;
  list.innerHTML = "";
  for (const report of phaseReports || []) {
    const item = document.createElement("div");
    item.className = "record-item";
    const title = document.createElement("strong");
    title.textContent = (report.phase || "-") + " · " + (report.status || "-");
    const meta = document.createElement("div");
    meta.className = "record-meta";
    meta.textContent = (report.positions || []).map((pos) =>
      pos.position + ": " + (pos.predictionLabel || "-") + " -> " + (pos.answerLabel || "-") + " · " + (pos.hit === true ? "hit" : pos.hit === false ? "miss" : "pending")
    ).join("  |  ");
    const proof = document.createElement("div");
    proof.textContent = report.errorReason || "all three positions matched";
    const actions = document.createElement("div");
    actions.className = "record-actions";
    const inspect = document.createElement("button");
    inspect.type = "button";
    inspect.className = "btn secondary";
    inspect.textContent = "Inspect";
    inspect.addEventListener("click", () => openInspector({ kind: "pick3 phase report", title: title.textContent, payload: report }));
    actions.append(inspect);
    for (const pos of report.positions || []) {
      if (pos.hit !== false) continue;
      const review = document.createElement("button");
      review.type = "button";
      review.className = "btn secondary";
      review.setAttribute("data-pick3-manual-playbook-review", pos.position);
      review.textContent = "Review " + pos.position;
      review.addEventListener("click", () => runPick3ManualPlaybookReview(taskId, report.phase, pos.position).catch((error) => writeActivity("pick3 manual lesson review failed: " + error.message, "failed")));
      actions.append(review);
    }
    item.append(title, meta, proof, actions);
    list.append(item);
  }
};

const renderPick3PlaybookLessons = (lessons) => {
  const list = qs("[data-pick3-history-lesson-list]");
  if (!list) return;
  list.innerHTML = "";
  for (const lesson of lessons || []) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "record-item";
    item.dataset.pick3PlaybookLessonPosition = lesson.position;
    const title = document.createElement("strong");
    title.textContent = lesson.position + " · " + lesson.phase + " · " + lesson.status;
    const meta = document.createElement("div");
    meta.className = "record-meta";
    meta.textContent = [
      lesson.source,
      lesson.aggregateKey,
      lesson.predictedLabel + " -> " + lesson.answerLabel,
    ].join(" · ");
    const proof = document.createElement("div");
    proof.textContent = lesson.candidateLesson || lesson.rootCause || "-";
    item.append(title, meta, proof);
    item.addEventListener("click", () => openInspector({ kind: "pick3 playbook lesson", title: title.textContent, payload: lesson }));
    list.append(item);
  }
};

const openPick3AiAnswer = async (taskId, repeat) => {
  const answer = await readJson(
    "/api/pick3-is-blind-eval/interaction?taskId=" + encodeURIComponent(taskId) + "&interactionId=" + encodeURIComponent(repeat.interactionId),
  );
  openInspector({
    kind: "pick3 ai answer",
    title: repeat.position + " repeat " + repeat.repeatIndex,
    payload: {
      interactionId: repeat.interactionId,
      imageId: repeat.imageId,
      predictionLabel: repeat.predictionLabel,
      visiblePredictionLabel: repeat.visiblePredictionLabel,
      confidence: repeat.confidence,
      parseStatus: repeat.parseStatus,
      rawResponseText: answer.rawResponseText,
      renderedPromptText: answer.renderedPromptText,
      promptPackageId: answer.promptPackageId,
      promptContractId: answer.promptContractId,
      promptHash: answer.promptHash,
      rawResponseHash: answer.rawResponseHash,
      rawOutputRef: answer.rawOutputRef,
      providerProofJson: answer.providerProofJson,
    },
  });
};

const renderPick3HistoryRepeats = (taskId, repeats) => {
  const list = qs("[data-pick3-history-repeat-list]");
  if (!list) return;
  list.innerHTML = "";
  for (const repeat of repeats || []) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "record-item";
    const title = document.createElement("strong");
    title.textContent = repeat.position + " · repeat " + repeat.repeatIndex + " · " + (repeat.visiblePredictionLabel || "-");
    const meta = document.createElement("div");
    meta.className = "record-meta";
    meta.textContent = [
      "confidence " + (repeat.confidence ?? "-"),
      repeat.parseStatus || "-",
      repeat.sameImageForPosition ? "same image" : "image mismatch",
    ].join(" · ");
    const proof = document.createElement("div");
    proof.textContent = repeat.interactionId + " · " + (repeat.rawResponseHash || "-");
    item.append(title, meta, proof);
    item.addEventListener("click", () => openPick3AiAnswer(taskId, repeat).catch((error) => writeActivity("pick3 ai answer load failed: " + error.message, "failed")));
    list.append(item);
  }
};

const renderPick3HistoryDetail = (detail) => {
  if (!detail?.summary) return;
  const summary = detail.summary;
  state.pick3TaskId = summary.taskId || state.pick3TaskId;
  state.pick3HistorySelectedTask = summary;
  updatePick3HistoryContinueButton(summary);
  markPick3HistorySelectedRow(summary.taskId || "");
  setText("[data-pick3-history-task-id]", summary.taskId);
  setText("[data-pick3-history-status]", summary.status);
  setText("[data-pick3-history-phase]", (summary.newestOfficialPhase || "-") + " -> " + (summary.targetPhase || "-"));
  setText("[data-pick3-history-window]", (summary.visibleStartPhase || "-") + "..." + (summary.visibleEndPhase || "-"));
  setText("[data-pick3-history-provider]", summary.providerKind || "-");
  setText("[data-pick3-history-scoring]", summary.scoring ? String(summary.scoring.hits) + "/" + String(summary.scoring.total) + " hit · " + String(summary.scoring.abstains) + " abstain" : "-");
  setText("[data-pick3-history-repeats]", String(summary.actualRepeatResults) + "/" + String(summary.expectedRepeatResults));
  setText("[data-pick3-history-completeness]", summary.evidenceCompleteness?.status || "-");
  renderPick3ObservedDistribution(detail.observedDistribution);
  renderPick3PhaseReports(summary.taskId, detail.phaseReports);
  renderPick3PlaybookLessons(detail.playbookLessons);
  renderPick3HistoryImages(detail.images);
  renderPick3HistoryRepeats(summary.taskId, detail.repeats);
};

const loadPick3HistoryTask = async (taskId) => {
  const detail = await readJson("/api/pick3-is-blind-eval/task?taskId=" + encodeURIComponent(taskId));
  renderPick3HistoryDetail(detail);
};

const refreshPick3History = async () => {
  const payload = await readJson("/api/pick3-is-blind-eval/history");
  const tasks = payload.tasks || [];
  renderPick3HistoryRows(tasks);
  if (tasks[0]?.taskId) await loadPick3HistoryTask(tasks[0].taskId);
  if (!tasks[0]?.taskId) clearPick3HistoryDetail();
};

const deletePick3SelectedHistoryTask = async () => {
  const taskId = state.pick3TaskId;
  if (!taskId) return writeActivity("pick3 history task id is required", "manual-required");
  const confirmed = window.confirm("物理删除，不可恢复。将永久删除这个 Pick3 历史任务、任务证据、AI 回答和 artifact 文件。确认删除 " + taskId + " ?");
  if (!confirmed) return writeActivity("pick3 history physical delete canceled", "manual-required");
  const result = await readJson("/api/pick3-is-blind-eval/task?taskId=" + encodeURIComponent(taskId), { method: "DELETE" });
  writeActivity("pick3 history physically deleted: " + result.taskId, "completed");
  await refreshPick3History();
};

const continuePick3SelectedHistoryTask = async () => {
  const selected = state.pick3HistorySelectedTask;
  const taskId = selected?.taskId;
  if (!taskId) return writeActivity("pick3 history task id is required", "manual-required");
  if (!isPick3ResumableStatus(selected.status)) {
    updatePick3HistoryContinueButton(selected);
    return writeActivity("pick3 history continue is allowed only for unfinished tasks", "manual-required");
  }
  writeActivity("pick3 history continue started: " + taskId, "running");
  const payload = { taskId };
  if (selected.providerKind) payload.providerKind = selected.providerKind;
  const task = await readJson("/api/pick3-is-blind-eval/task/resume", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  renderPick3Task(task);
  await refreshPick3History();
  if (task?.taskId && (task.status === "running" || task.status === "paused_rate_limited")) {
    await pollPick3Task(task.taskId);
  }
};

document.addEventListener("click", (event) => {
  if (event.target?.closest?.("[data-pick3-history-continue]")) continuePick3SelectedHistoryTask().catch((error) => writeActivity("pick3 history continue failed: " + error.message, "failed"));
});
`;

export const renderPick3HistoryClient = (): string => PICK3_HISTORY_CLIENT;
