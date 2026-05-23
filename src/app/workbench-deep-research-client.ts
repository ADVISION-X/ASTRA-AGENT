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
  const listValue = (value) => Array.isArray(value) ? value.filter(Boolean).join(" · ") : value;
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
  const deriveDeepResearchOverview = (payload) => {
    const overview = payload?.overview || {};
    const answers = payload?.answers || [];
    const timeline = payload?.timeline || [];
    const exports = payload?.exports || [];
    const subQuestions = payload?.subQuestions || [];
    return {
      currentPhase: overview.currentPhase || payload?.job?.phase || "-",
      interactionCount: overview.interactionCount ?? timeline.length,
      subQuestionCount: overview.subQuestionCount ?? subQuestions.length,
      positiveCount: overview.positiveCount ?? answers.filter((record) => record.answerKind === "positive").length,
      falsificationCount: overview.falsificationCount ?? answers.filter((record) => record.answerKind === "falsification").length,
      exportCount: overview.exportCount ?? exports.length,
    };
  };
  const getFinalReportTitle = (report) =>
    report?.finalJudgment || report?.executiveConclusion || report?.executiveSummary || "Final report is available.";
  const renderDeepResearchOverview = (payload) => {
    const job = payload?.job || {};
    const overview = deriveDeepResearchOverview(payload);
    setResearchHtml("[data-deep-research-overview]", [
      renderMetric("status", job.status),
      renderMetric("phase", job.phase || overview.currentPhase),
      renderMetric("interactions", overview.interactionCount),
      renderMetric("exports", overview.exportCount),
    ].join(""));
    setResearchHtml("[data-deep-research-summary]", [
      renderMetric("sub questions", overview.subQuestionCount),
      renderMetric("positive", overview.positiveCount),
      renderMetric("falsification", overview.falsificationCount),
      renderMetric("reason", job.failureReason || job.reviewReason || "-"),
    ].join(""));
    renderLedger({ record: { ...job, reason: job.failureReason || job.reviewReason || "-", evidence: overview.exportCount ? "export artifacts recorded" : "-" } });
  };
  const renderDeepResearchProgress = (payload) => {
    const phase = String(payload?.job?.phase || payload?.overview?.currentPhase || "");
    const completed = payload?.job?.status === "completed";
    const stages = [
      ["Intake", "INTAKE"],
      ["Decompose", "DECOMPOSE"],
      ["Positive", "POSITIVE"],
      ["Falsify", "FALSIFY"],
      ["Final", "FINAL"],
      ["Export", "EXPORT"],
    ];
    setResearchHtml("[data-deep-research-progress]", stages.map(([label, key]) => {
      const active = completed || phase.toUpperCase().includes(key);
      return \`<span class="\${active ? "active" : ""}">\${label}</span>\`;
    }).join(""));
  };
  const renderExportLedger = (exports) => \`
    <div class="research-export-ledger" data-deep-research-export-ledger>
      \${exports.length ? exports.map((record) => \`
        <article class="research-export-item">
          <div><b>\${escapeText(record.exportKind)}</b><span class="muted">\${escapeText(record.createdAt || "")}</span></div>
          <code>\${escapeText(record.fileHash || "-")}</code>
          <span class="muted">\${escapeText(record.filePath || "-")}</span>
          <button class="btn secondary" type="button" data-deep-research-export="\${escapeText(record.exportKind)}">Open artifact</button>
        </article>\`).join("") : "<p class=\\"muted\\">No export artifact recorded yet.</p>"}
    </div>\`;
  const renderDeepResearchDelivery = (payload) => {
    const job = payload?.job || {};
    const report = payload?.finalReport;
    const overview = deriveDeepResearchOverview(payload);
    const exports = payload?.exports || [];
    const statusClass = job.status === "completed" ? "ok" : job.status === "failed" ? "bad" : job.status === "review_required" ? "warn" : "";
    setResearchHtml("[data-deep-research-delivery]", \`
      <section class="research-delivery-card">
        <div class="research-delivery-kicker">
          <span class="\${statusClass}">\${escapeText(job.status || "-")}</span>
          <span class="muted">\${escapeText(job.id || deepResearchState.jobId || "-")}</span>
        </div>
        <h2>\${escapeText(report ? getFinalReportTitle(report) : "No final report persisted yet.")}</h2>
        <div class="research-delivery-grid">
          \${renderMetric("sub questions", overview.subQuestionCount)}
          \${renderMetric("positive answers", overview.positiveCount)}
          \${renderMetric("falsification answers", overview.falsificationCount)}
          \${renderMetric("export files", overview.exportCount)}
        </div>
        \${report ? \`
          <div class="research-delivery-sections">
            \${section("Confidence", report.confidence || report.confidenceLevel)}
            \${section("Evidence Gaps", report.evidenceGaps)}
            \${section("Reverse Conditions", report.reverseConditions)}
            \${section("Limitations", report.limitations)}
          </div>
        \` : ""}
        \${renderExportLedger(exports)}
        \${renderRawDetails("Raw result record", researchJson(payload), "raw-json-pre")}
      </section>\`);
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
      <div class="actions">
        <button class="btn secondary" type="button" data-copy-text="\${escapeText(entry.promptText || "")}">Copy prompt</button>
        <button class="btn secondary" type="button" data-copy-text="\${escapeText(entry.rawResponseText || "")}">Copy response</button>
      </div>
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
      <p>\${escapeText(listValue(value) || "-")}</p>
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
      renderExportLedger(payload.exports || []),
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
  const renderSubQuestionSummary = (payload) => {
    const subQuestions = payload?.subQuestions || [];
    if (!subQuestions.length) return;
    setResearchHtml("[data-research-view='overview']", \`
      <div class="research-summary-grid" data-deep-research-summary>\${qs("[data-deep-research-summary]")?.innerHTML || ""}</div>
      <div class="research-question-list">
        \${subQuestions.map((record) => \`
          <article class="research-question-item">
            <b>Q\${escapeText(record.ordinal + 1)} · \${escapeText(record.question.title || record.modelQuestionId)}</b>
            <p>\${escapeText(record.question.questionText)}</p>
          </article>\`).join("")}
      </div>\`);
  };
  const renderDeepResearchPayload = (payload) => {
    renderDeepResearchOverview(payload);
    renderDeepResearchProgress(payload);
    renderDeepResearchDelivery(payload);
    renderDeepResearchTimeline(payload);
    renderDeepResearchFinalReport(payload);
    renderDeepResearchEvidence(payload);
    renderSubQuestionSummary(payload);
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
