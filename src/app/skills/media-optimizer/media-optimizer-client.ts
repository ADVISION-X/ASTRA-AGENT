const MEDIA_OPTIMIZER_CLIENT = `
const MEDIA_OPTIMIZER_PRESETS = {
  "web-image": { childCapabilityId: "optimize-image-for-web-once", outputFormat: "webp", quality: 82, maxWidth: 1600, maxHeight: 1200, variants: "" },
  "web-image-responsive": { childCapabilityId: "generate-responsive-image-variants-once", outputFormat: "webp", quality: 82, maxWidth: 1600, maxHeight: 1200, variants: "480,960,1440" },
  "web-video": { childCapabilityId: "optimize-video-for-web-once", outputFormat: "mp4", quality: 78, maxWidth: 1280, maxHeight: 720, variants: "" },
  "web-video-compressed": { childCapabilityId: "compress-video-for-web-once", outputFormat: "mp4", quality: 64, maxWidth: 1280, maxHeight: 720, variants: "" },
  "web-video-poster": { childCapabilityId: "generate-video-poster-once", outputFormat: "webp", quality: 82, maxWidth: 1280, maxHeight: 720, variants: "" },
};
const escapeMediaOptimizerHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");
const formatMediaOptimizerBytes = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  if (bytes >= 1000000000) return (bytes / 1000000000).toFixed(2) + " GB";
  if (bytes >= 1000000) return (bytes / 1000000).toFixed(1) + " MB";
  return Math.round(bytes / 1000) + " KB";
};
const setMediaOptimizerResult = (html, tone = "ready") => {
  const node = qs("[data-media-optimizer-result]");
  if (!node) return;
  node.classList.toggle("hidden", !html);
  node.classList.toggle("ok-state", tone === "ok");
  node.classList.toggle("failed-state", tone === "failed");
  node.innerHTML = html || "";
};
const setMediaOptimizerBusy = (form, busy) => {
  if (!form) return;
  form.dataset.mediaOptimizerBusy = busy ? "true" : "false";
  const button = form.querySelector("button[type=submit]");
  if (button) {
    button.disabled = busy;
    button.textContent = busy ? "Processing..." : "Start";
  }
};
const updateMediaOptimizerProgress = (status, label) => {
  const wrap = qs("[data-media-optimizer-progress]");
  const progress = qs("[data-media-optimizer-progress] progress");
  const text = qs("[data-media-optimizer-progress-label]");
  if (!wrap || !progress || !text) return;
  wrap.classList.toggle("hidden", status === "idle");
  if (status === "running") {
    progress.removeAttribute("value");
  } else {
    progress.value = status === "success" ? 100 : 0;
  }
  text.textContent = label || "";
};
const parseMediaOptimizerNumbers = (value) => String(value || "")
  .split(",")
  .map((item) => Number(item.trim()))
  .filter((item) => Number.isFinite(item) && item > 0);
const fileToMediaOptimizerBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const value = String(reader.result || "");
    resolve(value.includes(",") ? value.slice(value.indexOf(",") + 1) : value);
  });
  reader.addEventListener("error", () => reject(reader.error || new Error("file read failed")));
  reader.readAsDataURL(file);
});
const applyMediaOptimizerPreset = (presetId) => {
  const form = qs("[data-media-optimizer-form]");
  const preset = MEDIA_OPTIMIZER_PRESETS[presetId] || MEDIA_OPTIMIZER_PRESETS["web-image"];
  if (!form) return;
  form.childCapabilityId.value = preset.childCapabilityId;
  form.outputFormat.value = preset.outputFormat;
  form.quality.value = String(preset.quality);
  form.maxWidth.value = String(preset.maxWidth);
  form.maxHeight.value = String(preset.maxHeight);
  form.variantWidths.value = preset.variants;
  qs("[data-media-optimizer-variant-field]")?.classList.toggle("hidden", preset.childCapabilityId !== "generate-responsive-image-variants-once");
};
const renderMediaOptimizerArtifacts = (result, downloadsPath, downloadsPaths = []) => {
  const list = qs("[data-media-optimizer-artifact-list]");
  const empty = qs("[data-media-optimizer-empty-artifacts]");
  const count = qs("[data-media-optimizer-artifact-count]");
  if (!list) return;
  list.innerHTML = "";
  const output = result?.output?.status === "success" ? result.output : null;
  const artifacts = Array.isArray(output?.outputArtifacts) ? output.outputArtifacts : [];
  const proofRef = output?.proofRef || result?.runtimeProof?.proofId || "";
  if (count) count.textContent = String(artifacts.length);
  if (empty) empty.classList.toggle("hidden", artifacts.length > 0);
  for (const artifact of artifacts) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "record-item";
    const title = document.createElement("strong");
    title.textContent = (artifact.derivativeKind || "artifact") + " · " + (artifact.format || "-");
    const meta = document.createElement("div");
    meta.className = "record-meta";
    meta.textContent = [
      formatMediaOptimizerBytes(artifact.byteSize),
      artifact.width && artifact.height ? artifact.width + "x" + artifact.height : "",
      artifact.durationMs ? Math.round(artifact.durationMs) + "ms" : "",
      artifact.format || "",
      artifact.sha256 ? "sha256 " + artifact.sha256 : "",
      proofRef ? "proof " + proofRef : "",
    ].filter(Boolean).join(" | ");
    const filePath = document.createElement("div");
    filePath.textContent = artifact.filePath || artifact.artifactRef || "-";
    item.append(title, meta, filePath);
    item.addEventListener("click", () => openInspector({ kind: "media artifact", title: title.textContent, payload: { ...artifact, proofRef } }));
    list.append(item);
  }
  const primary = artifacts[0];
  const savedPaths = Array.isArray(downloadsPaths) && downloadsPaths.length > 0
    ? downloadsPaths
    : downloadsPath
      ? [downloadsPath]
      : [];
  const savedPath = savedPaths.length > 0 ? savedPaths.join(", ") : primary?.filePath || primary?.artifactRef || "-";
  if (result?.status === "success") {
    setMediaOptimizerResult(
      "<b>Artifact ready</b><span>File: " + escapeMediaOptimizerHtml(savedPath) + "</span><span>Size: " + escapeMediaOptimizerHtml(formatMediaOptimizerBytes(primary?.byteSize)) + "</span><span>Format: " + escapeMediaOptimizerHtml(primary?.format || "-") + "</span><span>SHA-256: " + escapeMediaOptimizerHtml(primary?.sha256 || "-") + "</span><span>Proof: " + escapeMediaOptimizerHtml(proofRef || "-") + "</span>",
      "ok",
    );
    return;
  }
  const reason = result?.failureReason || result?.reviewRequiredReason || "unknown";
  setMediaOptimizerResult("<b>Processing stopped</b><span>Reason: " + escapeMediaOptimizerHtml(reason) + "</span>", "failed");
};
const startMediaOptimizer = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.dataset.mediaOptimizerBusy === "true") return;
  const file = form.sourceFile.files?.[0];
  if (!file) {
    setMediaOptimizerResult("<b>Source file required</b>", "failed");
    return;
  }
  setMediaOptimizerBusy(form, true);
  updateMediaOptimizerProgress("running", "Processing media artifact");
  setMediaOptimizerResult("<b>Processing started</b><span>Waiting for artifact, proof, size, and SHA-256.</span>", "ready");
  try {
    const request = {
      fileName: file.name,
      fileContentBase64: await fileToMediaOptimizerBase64(file),
      presetId: form.presetId.value,
      childCapabilityId: form.childCapabilityId.value,
      outputFormat: form.outputFormat.value,
      quality: Number(form.quality.value),
      maxWidth: Number(form.maxWidth.value),
      maxHeight: Number(form.maxHeight.value),
      variantWidths: parseMediaOptimizerNumbers(form.variantWidths.value),
      saveToDownloads: form.saveToDownloads?.checked === true,
    };
    const started = await readJson("/api/media-processing/start-async", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    let payload = started;
    writeActivity("media processing running: " + started.taskId, "running");
    while (payload.status === "running") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      payload = await readJson("/api/media-processing/status?taskId=" + encodeURIComponent(started.taskId));
      updateMediaOptimizerProgress("running", "Server task " + payload.status);
    }
    updateMediaOptimizerProgress(payload.status, payload.status === "success" ? "Processing complete" : "Processing needs review");
    if (!payload.record) throw new Error(payload.failureReason || "media processing ended without result record");
    renderLedger(payload.record, { job: "media-processing" });
    renderMediaOptimizerArtifacts(payload.record?.result, payload.downloadsPath ?? null, payload.downloadsPaths ?? []);
    writeActivity("media processing stopped with status " + payload.status, payload.status === "success" ? "completed" : "manual-required");
  } catch (error) {
    updateMediaOptimizerProgress("failed", "Processing failed");
    setMediaOptimizerResult("<b>Processing failed</b><span>Reason: " + escapeMediaOptimizerHtml(error.message) + "</span>", "failed");
    writeActivity("media processing failed: " + error.message, "failed");
  } finally {
    setMediaOptimizerBusy(form, false);
  }
};
document.addEventListener("DOMContentLoaded", () => {
  qs("[data-media-optimizer-form]")?.addEventListener("submit", startMediaOptimizer);
  qs("[data-media-optimizer-preset]")?.addEventListener("change", (event) => applyMediaOptimizerPreset(event.currentTarget.value));
  applyMediaOptimizerPreset("web-image");
});
`;

export const renderMediaOptimizerClient = (): string => MEDIA_OPTIMIZER_CLIENT;
