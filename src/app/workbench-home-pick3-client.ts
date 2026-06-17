export const renderPick3Client = (): string => `
const renderPick3Images = (images) => {
  const list = qs("[data-pick3-image-list]");
  if (!list) return;
  list.innerHTML = "";
  const safeImages = Array.isArray(images) ? images : [];
  setText("[data-pick3-image-total]", String(safeImages.length));
  for (const image of safeImages) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "record-item";
    const title = document.createElement("strong");
    title.textContent = image.position + " · " + image.imageId;
    const meta = document.createElement("div");
    meta.className = "record-meta";
    meta.textContent = image.imagePath || "";
    const hash = document.createElement("div");
    hash.textContent = "sha256 " + (image.imageSha256 || "-");
    item.append(title, meta, hash);
    item.addEventListener("click", () => openInspector({ kind: "pick3 image", title: title.textContent, payload: image }));
    list.append(item);
  }
};
const renderPick3Task = (task) => {
  if (!task) return;
  state.pick3TaskId = task.taskId || state.pick3TaskId;
  renderLedger(task, { job: "pick3-is-blind-eval" });
  setText("[data-pick3-summary-title]", task.taskId || "Pick3 task");
  setText("[data-pick3-status]", task.status || "-");
  setText("[data-pick3-rows-seen]", String(task.sync?.rowsSeen ?? "-"));
  setText("[data-pick3-rows-inserted]", String(task.sync?.rowsInserted ?? "-"));
  setText("[data-pick3-rows-updated]", String(task.sync?.rowsUpdated ?? "-"));
  setText("[data-pick3-newest-phase]", task.sync?.newestPhase || "-");
  setText("[data-pick3-batch-id]", task.batch?.batchId || "-");
  setText("[data-pick3-image-count]", String(task.batch?.imageCount ?? "-"));
  setText("[data-pick3-artifact-dir]", task.batch?.artifactDir || "-");
  renderPick3Images(task.batch?.images || []);
};
const startPick3 = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const positions = [];
  if (form.hundreds.checked) positions.push("hundreds");
  if (form.tens.checked) positions.push("tens");
  if (form.ones.checked) positions.push("ones");
  if (positions.length === 0) return writeActivity("pick3 requires at least one position", "manual-required");
  writeActivity("task started: pick3 official sync", "running");
  const task = await readJson("/api/pick3-is-blind-eval/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: form.mode.value,
      batchSize: Number(form.batchSize.value),
      positions,
      dryRun: true,
    }),
  });
  renderPick3Task(task);
  showWorkspacePage("pick3-is-blind-eval", "images");
  writeActivity("pick3 task completed with status " + task.status, task.status === "success" ? "completed" : "manual-required");
};
const refreshPick3Latest = async () => {
  const task = await readJson("/api/pick3-is-blind-eval/latest");
  renderPick3Task(task);
};
`;
