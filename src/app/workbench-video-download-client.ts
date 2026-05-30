const WORKBENCH_VIDEO_DOWNLOAD_CLIENT = `
const VIDEO_PLATFORM_DEFAULTS = {
  telegram: { platform: "telegram-web", maxMegabytes: 5000, quality: false, subtitles: false, detect: true },
  youtube: { platform: "youtube", maxMegabytes: 5000, quality: true, subtitles: true, detect: false },
  universal: { platform: "universal", maxMegabytes: 5000, quality: true, subtitles: false, detect: false },
  facebook: { platform: "facebook", maxMegabytes: 5000, quality: true, subtitles: false, detect: false },
  tiktok: { platform: "tiktok", maxMegabytes: 5000, quality: true, subtitles: false, detect: false },
  instagram: { platform: "instagram", maxMegabytes: 5000, quality: true, subtitles: false, detect: false },
  bilibili: { platform: "bilibili", maxMegabytes: 5000, quality: true, subtitles: false, detect: false },
  douyin: { platform: "douyin", maxMegabytes: 5000, quality: true, subtitles: false, detect: false },
  x: { platform: "x", maxMegabytes: 5000, quality: true, subtitles: false, detect: false },
  xiaohongshu: { platform: "xiaohongshu", maxMegabytes: 5000, quality: true, subtitles: false, detect: false },
};
const setVideoPlatform = (platform) => {
  const form = qs("[data-video-download-form]");
  const config = VIDEO_PLATFORM_DEFAULTS[platform] || VIDEO_PLATFORM_DEFAULTS.universal;
  if (!form) return;
  form.platform.value = config.platform;
  form.maxMegabytes.value = String(config.maxMegabytes);
  document.querySelectorAll("[data-video-platform]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.videoPlatform === platform));
  });
  document.querySelectorAll("[data-video-platform-note]").forEach((note) => {
    note.classList.toggle("hidden", note.dataset.videoPlatformNote !== platform);
  });
  qs("[name=preferredQuality]")?.closest(".field")?.classList.toggle("hidden", !config.quality);
  qs("[data-video-subtitles-field]")?.classList.toggle("hidden", !config.subtitles);
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
  const progress = qs("[data-video-download-progress]");
  const label = qs("[data-video-download-progress-label]");
  if (!progress || !label) return;
  progress.classList.toggle("hidden", input.state === "idle");
  if (input.state === "running") {
    progress.removeAttribute("value");
    label.textContent = input.label || "下载中";
    return;
  }
  progress.value = input.state === "done" ? 100 : 0;
  label.textContent = input.label || "";
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
  if (result?.status === "success") {
    const output = result?.result?.output || result?.output || {};
    const artifact = downloadsPath || output.filePath || output.artifactRef || "artifact ready";
    const downloadsMarker = "/Downloads/";
    const displayArtifact = artifact.includes(downloadsMarker)
      ? artifact.slice(artifact.lastIndexOf(downloadsMarker) + downloadsMarker.length)
      : artifact;
    const msg = downloadsPath
      ? "✓ 视频已下载到 ~/Downloads/GrassEye Video Downloads：" + displayArtifact
      : "✓ 视频下载完成：" + artifact;
    writeActivity(msg, "ok");
    return;
  }
  const nested = result?.result || result;
  writeActivity("视频下载需要检查：" + (nested?.failureReason || nested?.reviewRequiredReason || nested?.output?.reason || "unknown"), "warn");
};
const startVideoDownload = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const maxMegabytes = Number(form.maxMegabytes.value);
  const request = {
    sourcePageUrl: form.sourcePageUrl.value,
    platform: form.platform.value,
    preferredQuality: form.preferredQuality.value,
    maxBytes: Math.max(1, maxMegabytes) * 1000000,
    downloadSubtitles: form.downloadSubtitles.checked,
    saveToDownloads: form.saveToDownloads?.checked === true,
    telegramDocumentIdHash: form.telegramDocumentIdHash?.value || undefined,
  };
  writeActivity("video download submitted: " + request.platform);
  updateVideoDownloadProgress({ state: "running", label: "下载中：正在通过授权页面组装媒体分片" });
  const payload = await readJson("/api/video-download/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  updateVideoDownloadProgress({ state: payload.record?.status === "success" ? "done" : "failed", label: payload.record?.status === "success" ? "下载完成" : "需要检查" });
  renderVideoDownloadLedger(payload.record, payload.downloadsPath ?? null);
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
