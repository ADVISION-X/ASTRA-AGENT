const WORKBENCH_VIDEO_DOWNLOAD_CLIENT = `
const renderVideoDownloadLedger = (result) => {
  renderLedger({ record: result });
  if (result?.status === "success") {
    writeActivity("video download completed", "ok");
    return;
  }
  writeActivity("video download needs review: " + (result?.failureReason || result?.reviewRequiredReason || "unknown"), "warn");
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
  };
  writeActivity("video download submitted");
  const payload = await readJson("/api/video-download/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  renderVideoDownloadLedger(payload.record);
};
document.addEventListener("DOMContentLoaded", () => {
  const form = qs("[data-video-download-form]");
  if (form) form.addEventListener("submit", startVideoDownload);
});
`;

export const renderWorkbenchVideoDownloadClient = (): string => WORKBENCH_VIDEO_DOWNLOAD_CLIENT;
