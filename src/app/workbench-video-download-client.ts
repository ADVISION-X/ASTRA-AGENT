const WORKBENCH_VIDEO_DOWNLOAD_CLIENT = `
const VIDEO_PLATFORM_DEFAULTS = {
  telegram: { platform: "telegram-web", maxMegabytes: 5000, quality: false, subtitles: false, detect: true },
  youtube: { platform: "youtube", maxMegabytes: null, quality: true, subtitles: true, detect: false },
  universal: { platform: "universal", maxMegabytes: 5000, quality: true, subtitles: false, detect: false },
  facebook: { platform: "facebook", maxMegabytes: 5000, quality: true, subtitles: false, detect: false },
  tiktok: { platform: "tiktok", maxMegabytes: 5000, quality: true, subtitles: false, detect: false },
  instagram: { platform: "instagram", maxMegabytes: 5000, quality: true, subtitles: false, detect: false },
  bilibili: { platform: "bilibili", maxMegabytes: 5000, quality: true, subtitles: false, detect: false },
  douyin: { platform: "douyin", maxMegabytes: 5000, quality: true, subtitles: false, detect: false },
  x: { platform: "x", maxMegabytes: 5000, quality: true, subtitles: false, detect: false },
  xiaohongshu: { platform: "xiaohongshu", maxMegabytes: 5000, quality: true, subtitles: false, detect: false },
};
let videoDownloadRun = null;
const formatElapsed = (startedAt) => {
  if (!startedAt) return "00:00";
  const totalSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return (hours ? hours + ":" + String(minutes).padStart(2, "0") : String(minutes).padStart(2, "0")) + ":" + seconds;
};
const formatBytes = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  if (bytes >= 1000000000) return (bytes / 1000000000).toFixed(2) + " GB";
  if (bytes >= 1000000) return (bytes / 1000000).toFixed(1) + " MB";
  return Math.round(bytes / 1000) + " KB";
};
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");
const setVideoDownloadResult = (html, tone = "ready") => {
  const node = qs("[data-video-download-result]");
  if (!node) return;
  node.classList.toggle("hidden", !html);
  node.classList.toggle("ok-state", tone === "ok");
  node.classList.toggle("failed-state", tone === "failed");
  node.innerHTML = html || "";
};
const setVideoDownloadBusy = (form, busy) => {
  if (!form) return;
  form.dataset.videoDownloadBusy = busy ? "true" : "false";
  const button = form.querySelector("button[type=submit]");
  if (button) {
    button.disabled = busy;
    button.textContent = busy ? "Downloading..." : "Start";
  }
  form.querySelectorAll("[data-video-platform], [data-video-detect-source]").forEach((control) => {
    control.disabled = busy;
  });
};
const setVideoPlatform = (platform) => {
  const form = qs("[data-video-download-form]");
  const config = VIDEO_PLATFORM_DEFAULTS[platform] || VIDEO_PLATFORM_DEFAULTS.universal;
  if (!form) return;
  form.platform.value = config.platform;
  form.maxMegabytes.value = config.maxMegabytes === null ? "" : String(config.maxMegabytes);
  if (config.platform === "youtube") {
    form.preferredQuality.value = "best_available";
  }
  if (form.downloadSubtitles) {
    form.downloadSubtitles.checked = config.subtitles;
  }
  document.querySelectorAll("[data-video-platform]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.videoPlatform === platform));
  });
  document.querySelectorAll("[data-video-platform-note]").forEach((note) => {
    note.classList.toggle("hidden", note.dataset.videoPlatformNote !== platform);
  });
  qs("[name=preferredQuality]")?.closest(".field")?.classList.toggle("hidden", !config.quality);
  qs("[name=maxMegabytes]")?.closest(".field")?.classList.toggle("hidden", config.maxMegabytes === null);
  if (form.maxMegabytes) {
    form.maxMegabytes.disabled = config.maxMegabytes === null;
    form.maxMegabytes.required = config.maxMegabytes !== null;
  }
  qs("[data-video-subtitles-field]")?.classList.toggle("hidden", !config.subtitles);
  qs("[data-video-subtitle-languages-field]")?.classList.toggle("hidden", !config.subtitles);
  qs("[data-video-detect-row]")?.classList.toggle("hidden", !config.detect);
  qs("[data-video-candidate-list]")?.classList.add("hidden");
  if (form?.telegramDocumentIdHash) form.telegramDocumentIdHash.value = "";
  setText("[data-video-source-state]", config.detect ? "（先播放视频，再点此按钮）" : "-");
};
const formatDuration = (durationMs) => {
  if (!durationMs) return "-";
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return minutes + ":" + seconds;
};
const renderTelegramVideoCandidates = (candidates) => {
  const list = qs("[data-video-candidate-list]");
  const form = qs("[data-video-download-form]");
  if (!list || !form) return;
  list.replaceChildren();
  if (!Array.isArray(candidates) || candidates.length === 0) {
    list.classList.remove("hidden");
    list.textContent = "未识别到可见 Telegram 视频清单";
    if (form.telegramDocumentIdHash) form.telegramDocumentIdHash.value = "";
    return;
  }
  list.classList.remove("hidden");
  candidates.forEach((candidate, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "candidate-row";
    button.dataset.telegramDocumentIdHash = candidate.documentIdHash || "";
    const status = candidate.cacheComplete ? "cache ready" : "needs page cache";
    const size = candidate.cachedByteSize ? Math.round(candidate.cachedByteSize / 1000000) + " MB" : "-";
    button.textContent = "#" + (index + 1) + "  " + formatDuration(candidate.durationMs) + "  " + (candidate.width || "-") + "x" + (candidate.height || "-") + "  " + status + "  " + size;
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-video-candidate-list] .candidate-row").forEach((item) => item.setAttribute("aria-pressed", "false"));
      button.setAttribute("aria-pressed", "true");
      if (form.telegramDocumentIdHash) form.telegramDocumentIdHash.value = candidate.documentIdHash || "";
      setText("[data-video-source-state]", "✓ 已选择视频：" + button.textContent);
    });
    if (index === 0) {
      button.setAttribute("aria-pressed", "true");
      if (form.telegramDocumentIdHash) form.telegramDocumentIdHash.value = candidate.documentIdHash || "";
    } else {
      button.setAttribute("aria-pressed", "false");
    }
    list.append(button);
  });
};
const updateVideoDownloadProgress = (input) => {
  const wrap = qs("[data-video-download-progress]");
  const progress = qs("[data-video-download-progress] progress");
  const label = qs("[data-video-download-progress-label]");
  if (!wrap || !progress || !label) return;
  wrap.classList.toggle("hidden", input.state === "idle");
  if (input.state === "running") {
    progress.removeAttribute("value");
    label.textContent = input.label || "下载中";
    return;
  }
  progress.value = input.state === "done" ? 100 : 0;
  label.textContent = input.label || "";
};
const startVideoDownloadTimer = (platform) => {
  if (videoDownloadRun?.timerId) clearInterval(videoDownloadRun.timerId);
  videoDownloadRun = { startedAt: Date.now(), platform, lastActivitySeconds: 0, timerId: null };
  const tick = () => {
    if (!videoDownloadRun) return;
    const elapsed = formatElapsed(videoDownloadRun.startedAt);
    updateVideoDownloadProgress({ state: "running", label: "下载中：" + elapsed + "，正在通过授权页面组装媒体分片；服务器仍在处理 " + videoDownloadRun.platform + " 请求" });
    const elapsedSeconds = Math.floor((Date.now() - videoDownloadRun.startedAt) / 1000);
    if (elapsedSeconds > 0 && elapsedSeconds % 30 === 0 && elapsedSeconds !== videoDownloadRun.lastActivitySeconds) {
      videoDownloadRun.lastActivitySeconds = elapsedSeconds;
      writeActivity("video download still running: " + elapsed + " / " + videoDownloadRun.platform, "running");
    }
  };
  tick();
  videoDownloadRun.timerId = setInterval(tick, 1000);
};
const stopVideoDownloadTimer = () => {
  if (videoDownloadRun?.timerId) clearInterval(videoDownloadRun.timerId);
  videoDownloadRun = null;
};
const detectVideoSourcePage = async (platformId) => {
  const sourceInput = qs("[data-video-download-form] [name=sourcePageUrl]");
  const query = new URLSearchParams({ platform: platformId });
  if (sourceInput?.value) query.set("sourcePageUrl", sourceInput.value);
  const payload = await readJson("/api/video-download/source-page?" + query.toString());
  if (sourceInput) sourceInput.value = payload.sourcePageUrl || "";
  const label = payload.pageTitle || payload.sourcePageUrl || "source page loaded";
  renderTelegramVideoCandidates(payload.videoCandidates || []);
  const count = Array.isArray(payload.videoCandidates) ? payload.videoCandidates.length : 0;
  setText("[data-video-source-state]", "✓ 已检测到：" + label + " / 视频 " + count + " 个");
  writeActivity("② 已检测视频页面：" + label + " / 视频 " + count + " 个", count > 0 ? "ok" : "warn");
};
const renderVideoDownloadLedger = (result, downloadsPath) => {
  renderLedger({ record: result });
  const nested = result?.result || result;
  const nestedOutput = nested?.output || {};
  setText("[data-task-status]", nested?.status || result?.status || "-");
  setText("[data-task-reason]", nested?.failureReason || nested?.reviewRequiredReason || nestedOutput.reason || "-");
  setText("[data-evidence-ref]", nestedOutput.artifactRef || nestedOutput.proofRef || nested?.runtimeProof?.artifactRef || nested?.runtimeProof?.proofId || "-");
  if (result?.status === "success") {
    const output = nestedOutput;
    const artifact = downloadsPath || output.filePath || output.artifactRef || "artifact ready";
    const byteSize = output.byteSize || output.fileSizeBytes || output.sizeBytes;
    const sha256 = output.sha256 || output.digest || "-";
    const title = output.displayTitle || output.sourceTitle || "-";
    const dimensions = output.width && output.height ? output.width + "x" + output.height : "-";
    const duration = output.durationMs ? formatDuration(output.durationMs) : "-";
    const subtitleCount = Array.isArray(output.subtitleArtifacts) ? output.subtitleArtifacts.length : 0;
    const downloadsMarker = "/Downloads/";
    const displayArtifact = artifact.includes(downloadsMarker)
      ? artifact.slice(artifact.lastIndexOf(downloadsMarker) + downloadsMarker.length)
      : artifact;
    const msg = downloadsPath
      ? "✓ 视频已下载到 ~/Downloads/GrassEye Video Downloads：" + displayArtifact
      : "✓ 视频下载完成：" + artifact;
    setVideoDownloadResult(
      "<b>" + escapeHtml(title) + "</b><span>文件：" + escapeHtml(displayArtifact) + "</span><span>质量：" + escapeHtml(output.selectedQuality || "-") + " · " + escapeHtml(dimensions) + " · " + escapeHtml(duration) + "</span><span>大小：" + escapeHtml(formatBytes(byteSize)) + " · 字幕：" + escapeHtml(String(subtitleCount)) + "</span><span>SHA-256：" + escapeHtml(sha256) + "</span><span>Proof：" + escapeHtml(output.proofRef || nested?.runtimeProof?.proofId || "-") + "</span>",
      "ok",
    );
    writeActivity(msg, "ok");
    return;
  }
  const reason = nested?.failureReason || nested?.reviewRequiredReason || nestedOutput.reason || "unknown";
  setVideoDownloadResult("<b>下载未完成</b><span>原因：" + escapeHtml(reason) + "</span>", "failed");
  writeActivity("视频下载需要检查：" + reason, "warn");
};
const startVideoDownload = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.dataset.videoDownloadBusy === "true") return;
  const request = {
    sourcePageUrl: form.sourcePageUrl.value,
    platform: form.platform.value,
    preferredQuality: form.preferredQuality.value,
    downloadSubtitles: form.downloadSubtitles.checked,
    subtitleLanguages: form.subtitleLanguages?.value
      ? form.subtitleLanguages.value.split(",").map((item) => item.trim()).filter(Boolean)
      : undefined,
    saveToDownloads: form.saveToDownloads?.checked === true,
    telegramDocumentIdHash: form.telegramDocumentIdHash?.value || undefined,
  };
  if (form.platform.value !== "youtube") {
    const maxMegabytes = Number(form.maxMegabytes.value);
    request.maxBytes = Math.max(1, maxMegabytes) * 1000000;
    request.timeoutMs = 3600000;
  }
  writeActivity("video download submitted: " + request.platform);
  setVideoDownloadResult("<b>下载已开始</b><span>等待服务器返回最终文件、大小、SHA-256 和保存位置。</span>", "ready");
  setVideoDownloadBusy(form, true);
  startVideoDownloadTimer(request.platform);
  try {
    const started = await readJson("/api/video-download/start-async", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!started.taskId) throw new Error("video download task id missing");
    writeActivity("video download running: " + started.taskId, "running");
    let payload = started;
    while (payload.status === "running") {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      payload = await readJson("/api/video-download/status?taskId=" + encodeURIComponent(started.taskId));
      updateVideoDownloadProgress({ state: "running", label: "下载中：" + formatElapsed(videoDownloadRun?.startedAt) + "，服务器任务 " + payload.status });
    }
    updateVideoDownloadProgress({ state: payload.status === "success" ? "done" : "failed", label: payload.status === "success" ? "下载完成：" + formatElapsed(videoDownloadRun?.startedAt) : "需要检查：" + formatElapsed(videoDownloadRun?.startedAt) });
    if (!payload.record) throw new Error(payload.failureReason || "video download ended without result record");
    renderVideoDownloadLedger(payload.record, payload.downloadsPath ?? null);
  } catch (error) {
    updateVideoDownloadProgress({ state: "failed", label: "下载失败：" + formatElapsed(videoDownloadRun?.startedAt) });
    setVideoDownloadResult("<b>下载失败</b><span>原因：" + escapeHtml(error.message) + "</span>", "failed");
    writeActivity("video download failed: " + error.message, "failed");
  } finally {
    stopVideoDownloadTimer();
    setVideoDownloadBusy(form, false);
  }
};
document.addEventListener("DOMContentLoaded", () => {
  const form = qs("[data-video-download-form]");
  if (form) form.addEventListener("submit", startVideoDownload);
  document.querySelectorAll("[data-video-platform]").forEach((button) => {
    button.addEventListener("click", () => setVideoPlatform(button.dataset.videoPlatform));
  });
  qs("[data-video-detect-source]")?.addEventListener("click", () => {
    detectVideoSourcePage("telegram-web").catch((error) => writeActivity("video source detect failed: " + error.message, "bad"));
  });
  setVideoPlatform("telegram");
});
`;

export const renderWorkbenchVideoDownloadClient = (): string => WORKBENCH_VIDEO_DOWNLOAD_CLIENT;
