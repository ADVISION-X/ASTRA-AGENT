const WORKBENCH_DEEP_RESEARCH_CLIENT = `
(() => {
  const deepResearchState = {
    jobId: localStorage.getItem("grasseye:lastDeepResearchJobId") || "",
    poll: null,
  };
  const researchJson = (value) => JSON.stringify(value ?? null, null, 2);
  const escapeText = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\\"": "&quot;",
    "'": "&#39;",
  })[char]);
  const setResearchHtml = (selector, html) => {
    const node = qs(selector);
    if (node) node.innerHTML = html;
  };
  const phaseLabel = (entry) => {
    const prefix = entry.subQuestionId ? entry.subQuestionId + " " : "";
    return prefix + String(entry.phase || "").replace("_", " ").toUpperCase();
  };
  const renderRawDetails = (label, value, className) => \`
    <details>
      <summary>\${escapeText(label)}</summary>
      <pre class="\${className}">\${escapeText(value)}</pre>
    </details>\`;
  const renderMetric = (label, value) => \`
    <div class="research-metric"><b>\${escapeText(value ?? "-")}</b><span class="muted">\${escapeText(label)}</span></div>\`;
  const renderDeepResearchOverview = (payload) => {
    const job = payload?.job || {};
    const overview = payload?.overview || {};
    setResearchHtml("[data-deep-research-overview]", [
      renderMetric("status", job.status),
      renderMetric("phase", job.phase || overview.currentPhase),
      renderMetric("interactions", overview.interactionCount || 0),
      renderMetric("exports", overview.exportCount || 0),
    ].join(""));
    setResearchHtml("[data-deep-research-summary]", [
      renderMetric("sub questions", overview.subQuestionCount || 0),
      renderMetric("positive", overview.positiveCount || 0),
      renderMetric("falsification", overview.falsificationCount || 0),
      renderMetric("reason", job.failureReason || job.reviewReason || "-"),
    ].join(""));
    renderLedger({ record: { ...job, reason: job.failureReason || job.reviewReason || "-" } });
  };
  const renderDeepResearchProgress = (payload) => {
    const phase = payload?.job?.phase || payload?.overview?.currentPhase || "";
    const stages = ["Intake", "Decompose", "Positive", "Falsify", "Final", "Export"];
    setResearchHtml("[data-deep-research-progress]", stages.map((stage) => {
      const active = phase.toLowerCase().includes(stage.toLowerCase().slice(0, 6));
      return \`<span class="\${active ? "active" : ""}">\${stage}</span>\`;
    }).join(""));
  };
  const renderTimelineItem = (entry) => \`
    <article class="research-step">
      <header>
        <span class="phase-badge">\${escapeText(phaseLabel(entry))}</span>
        <span class="status-chip">\${escapeText(entry.promptReconstructionStatus || "parsed")}</span>
        <span class="hash-chip">prompt sha256:\${escapeText(entry.promptHash || "-")}</span>
        <span class="hash-chip">response sha256:\${escapeText(entry.rawResponseHash || "-")}</span>
      </header>
      <p>\${escapeText(entry.parsedSummary || "-")}</p>
      <button class="btn secondary" type="button" data-copy-text="\${escapeText(entry.promptText || "")}">Copy prompt</button>
      <button class="btn secondary" type="button" data-copy-text="\${escapeText(entry.rawResponseText || "")}">Copy response</button>
      \${renderRawDetails("Full prompt", entry.promptText || "", "prompt-pre")}
      \${renderRawDetails("AI response", entry.rawResponseText || "", "response-pre")}
      \${renderRawDetails("Parsed JSON", researchJson(entry.parsedJson), "raw-json-pre")}
    </article>\`;
  const renderDeepResearchTimeline = (payload) => {
    const timeline = payload?.timeline || [];
    setResearchHtml(
      "[data-deep-research-timeline]",
      timeline.length ? timeline.map(renderTimelineItem).join("") : "<p class=\\"muted\\">No timeline yet.</p>",
    );
  };
  const section = (title, value) => \`
    <section class="research-final-section">
      <h3>\${escapeText(title)}</h3>
      <p>\${escapeText(Array.isArray(value) ? value.join(" | ") : value || "-")}</p>
    </section>\`;
  const renderDeepResearchFinalReport = (payload) => {
    const report = payload?.finalReport;
    if (!report) {
      setResearchHtml("[data-deep-research-final-report]", "<p class=\\"muted\\">No final report yet.</p>");
      return;
    }
    const jobId = payload.job?.id || deepResearchState.jobId;
    setResearchHtml("[data-deep-research-final-report]", [
      section("Executive Summary", report.executiveSummary || report.executiveConclusion),
      section("Final Judgment", report.finalJudgment || report.executiveConclusion),
      section("Confidence", report.confidence || report.confidenceLevel),
      section("Supporting Reasons", report.supportingReasons || report.positiveReasons),
      section("Strongest Opposing Arguments", report.strongestOpposingArguments),
      section("Conflict Matrix Summary", report.conflictMatrixSummary || report.conflictMatrix?.map((row) => row.evidenceGap)),
      section("Evidence Gaps", report.evidenceGaps),
      section("Reverse Conditions", report.reverseConditions),
      section("Follow-up Signals", report.followUpSignals),
      section("Limitations", report.limitations),
      \`<div class="actions">
        <button class="btn secondary" type="button" data-deep-research-export="final-report.md">Download final-report.md</button>
        <button class="btn secondary" type="button" data-deep-research-export="research-bundle.json">Download research-bundle.json</button>
        <button class="btn secondary" type="button" data-deep-research-export="evidence-index.json">Download evidence-index.json</button>
      </div>\`,
      renderRawDetails("View raw final report JSON", researchJson(report), "raw-json-pre"),
    ].join(""));
    deepResearchState.jobId = jobId;
  };
  const renderDeepResearchEvidence = (payload) => {
    const rows = (payload?.timeline || []).map((entry) => \`
      <tr>
        <td>\${escapeText(entry.interactionId)}</td>
        <td>\${escapeText(entry.phase)}</td>
        <td>\${escapeText(entry.subQuestionId || "-")}</td>
        <td>\${escapeText(entry.promptHash)}</td>
        <td>\${escapeText(entry.rawResponseHash)}</td>
        <td>\${escapeText((entry.parsedRecordIds || []).join(", "))}</td>
        <td>\${escapeText(entry.domRef || "-")}</td>
        <td>\${escapeText(entry.createdAt)}</td>
      </tr>\`);
    setResearchHtml("[data-deep-research-evidence]", \`
      <table><thead><tr><th>interactionId</th><th>phase</th><th>subQuestionId</th><th>promptHash</th><th>rawResponseHash</th><th>parsedRecordId</th><th>domRef</th><th>createdAt</th></tr></thead>
      <tbody>\${rows.join("") || "<tr><td colspan=\\"8\\">No evidence yet.</td></tr>"}</tbody></table>\`);
  };
  const renderDeepResearchPayload = (payload) => {
    renderDeepResearchOverview(payload);
    renderDeepResearchProgress(payload);
    renderDeepResearchTimeline(payload);
    renderDeepResearchFinalReport(payload);
    renderDeepResearchEvidence(payload);
  };
  const stopDeepResearchPolling = () => {
    if (deepResearchState.poll) clearInterval(deepResearchState.poll);
    deepResearchState.poll = null;
  };
  const refreshDeepResearchJob = async (jobId) => {
    const payload = await readJson("/api/deep-research-analysis/timeline?jobId=" + encodeURIComponent(jobId));
    renderDeepResearchPayload(payload);
    const status = payload?.job?.status;
    if (status && status !== "queued" && status !== "running") stopDeepResearchPolling();
  };
  const startDeepResearchPolling = (jobId) => {
    deepResearchState.jobId = jobId;
    localStorage.setItem("grasseye:lastDeepResearchJobId", jobId);
    stopDeepResearchPolling();
    deepResearchState.poll = setInterval(() => refreshDeepResearchJob(jobId).catch((error) => writeActivity("deep research poll failed: " + error.message, "bad")), 5000);
  };
  const refreshDeepResearchLatest = async () => {
    const snapshot = await readJson("/api/deep-research-analysis/latest");
    deepResearchState.jobId = snapshot.job.id;
    localStorage.setItem("grasseye:lastDeepResearchJobId", snapshot.job.id);
    await refreshDeepResearchJob(snapshot.job.id);
  };
  const startDeepResearch = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = await readJson("/api/deep-research-analysis/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userQuestion: form.userQuestion.value,
        analysisGoal: form.analysisGoal.value || null,
        language: form.language.value,
        maxSubQuestions: Number(form.maxSubQuestions.value),
        outputFormat: "markdown",
        providerKind: form.providerKind.value,
      }),
    });
    renderDeepResearchPayload(payload);
    startDeepResearchPolling(payload.jobId);
    writeActivity("deep research started", "ok");
  };
  const downloadDeepResearchExport = async (kind) => {
    if (!deepResearchState.jobId) return writeActivity("deep research job id is required", "warn");
    const exported = await readJson("/api/deep-research-analysis/export?jobId=" + encodeURIComponent(deepResearchState.jobId) + "&kind=" + encodeURIComponent(kind));
    const text = exported.textContent || JSON.stringify(exported.jsonContent, null, 2);
    const blob = new Blob([text], { type: exported.contentType || "application/octet-stream" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = exported.fileName || kind;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const copyText = async (value) => {
    await navigator.clipboard.writeText(value || "");
    writeActivity("copied", "ok");
  };
  document.addEventListener("click", (event) => {
    const copy = event.target.closest("[data-copy-text]");
    if (copy) copyText(copy.dataset.copyText).catch((error) => writeActivity("copy failed: " + error.message, "bad"));
    const exportButton = event.target.closest("[data-deep-research-export]");
    if (exportButton) downloadDeepResearchExport(exportButton.dataset.deepResearchExport).catch((error) => writeActivity("export failed: " + error.message, "bad"));
    const tab = event.target.closest("[data-research-tab]");
    if (tab) {
      document.querySelectorAll("[data-research-view]").forEach((view) => view.classList.toggle("hidden", view.dataset.researchView !== tab.dataset.researchTab));
    }
  });
  document.addEventListener("DOMContentLoaded", () => {
    const form = qs("[data-deep-research-form]");
    if (form) form.addEventListener("submit", startDeepResearch);
    const latest = qs("[data-deep-research-latest]");
    if (latest) latest.addEventListener("click", () => refreshDeepResearchLatest().catch((error) => writeActivity("deep research latest failed: " + error.message, "bad")));
    const refresh = qs("[data-deep-research-refresh]");
    if (refresh) refresh.addEventListener("click", () => deepResearchState.jobId && refreshDeepResearchJob(deepResearchState.jobId).catch((error) => writeActivity("deep research refresh failed: " + error.message, "bad")));
    if (deepResearchState.jobId) refreshDeepResearchJob(deepResearchState.jobId).catch(() => undefined);
  });
})();
`;

export const renderWorkbenchDeepResearchClient = (): string => WORKBENCH_DEEP_RESEARCH_CLIENT;
