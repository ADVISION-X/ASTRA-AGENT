const WORKBENCH_VIDEO_DOWNLOAD_CLIENT = `
const VIDEO_PLATFORM_DEFAULTS = {
  telegram: { childCapabilityId: "download-telegram-web-video-once", maxMegabytes: 500, quality: false, subtitles: false, detect: true },
  youtube: { childCapabilityId: "download-youtube-video-once", maxMegabytes: 500, quality: true, subtitles: true, detect: false },
  universal: { childCapabilityId: "download-web-video-once", maxMegabytes: 200, quality: true, subtitles: false, detect: false },
  facebook: { childCapabilityId: "download-facebook-video-once", maxMegabytes: 200, quality: true, subtitles: false, detect: false },
  tiktok: { childCapabilityId: "download-tiktok-video-once", maxMegabytes: 200, quality: true, subtitles: false, detect: false },
  instagram: { childCapabilityId: "download-instagram-video-once", maxMegabytes: 200, quality: true, subtitles: false, detect: false },
  bilibili: { childCapabilityId: "download-bilibili-video-once", maxMegabytes: 500, quality: true, subtitles: false, detect: false },
  douyin: { childCapabilityId: "download-douyin-video-once", maxMegabytes: 200, quality: true, subtitles: false, detect: false },
  x: { childCapabilityId: "download-x-video-once", maxMegabytes: 200, quality: true, subtitles: false, detect: false },
  xiaohongshu: { childCapabilityId: "download-xiaohongshu-video-once", maxMegabytes: 200, quality: true, subtitles: false, detect: false },
};
const setVideoPlatform = (platform) => {
  const form = qs("[data-video-download-form]");
  const config = VIDEO_PLATFORM_DEFAULTS[platform] || VIDEO_PLATFORM_DEFAULTS.universal;
  if (!form) return;
  form.childCapabilityId.value = config.childCapabilityId;
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
  setText("[data-video-source-state]", config.detect ? "（先播放视频，再点此按钮）" : "-");
};
const detectVideoSourcePage = async (platformId) => {
  const payload = await readJson("/api/video-download/source-page?platform=" + encodeURIComponent(platformId));
  const sourceInput = qs("[data-video-download-form] [name=sourcePageUrl]");
  if (sourceInput) sourceInput.value = payload.sourcePageUrl || "";
  const label = payload.pageTitle || payload.sourcePageUrl || "source page loaded";
  setText("[data-video-source-state]", "✓ 已检测到：" + label);
  writeActivity("② 已检测视频页面：" + label, "ok");
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
      ? "✓ 视频已下载到 ~/Downloads：" + displayArtifact
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
    childCapabilityId: form.childCapabilityId.value,
    preferredQuality: form.preferredQuality.value,
    maxBytes: Math.max(1, maxMegabytes) * 1000000,
    downloadSubtitles: form.downloadSubtitles.checked,
    saveToDownloads: form.saveToDownloads?.checked === true,
  };
  writeActivity("video download submitted: " + request.childCapabilityId);
  const payload = await readJson("/api/video-download/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
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
