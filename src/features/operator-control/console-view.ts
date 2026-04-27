import type { GrassEyeWorkbench } from "../../lib/local-runtime/workbench.js";
import type { Locale } from "../../lib/localization/dictionaries.js";
import { createTranslator, type Translator } from "../../lib/localization/render-text.js";
import type { EvidenceRef } from "../../types/evidence.js";
import type { ActionLog } from "../../types/platform-action.js";
import type { ProductOpportunityCandidate } from "../../types/product-opportunity.js";
import type { RuntimeComponentHealth } from "../../types/runtime.js";

type OperatorSnapshot = Awaited<ReturnType<GrassEyeWorkbench["getOperatorSnapshot"]>>;

interface RenderOperatorConsoleOptions {
  locale: Locale;
  requestUrl: URL;
}

type CandidateReviewStatus = "pending" | "approved" | "rejected" | "archived";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeDisplayText(value: string, hiddenPathLabel: string): string {
  return value
    .replace(/\/Users\/[^\s<]+/g, hiddenPathLabel)
    .replace(/\/var\/folders\/[^\s<]+/g, hiddenPathLabel)
    .replace(/[A-Za-z]:\\[^\s<]+/g, hiddenPathLabel);
}

function summarizeRuntimeStatus(components: RuntimeComponentHealth[], t: Translator): { label: string; tone: "ok" | "warn" } {
  const allOk = components.every((component) => component.ok);
  return {
    label: allOk ? t("runtime.summaryHealthy") : t("runtime.summaryAttention"),
    tone: allOk ? "ok" : "warn",
  };
}

function mapReviewStatus(status: ProductOpportunityCandidate["reviewStatus"]): CandidateReviewStatus {
  switch (status) {
    case "approve":
      return "approved";
    case "reject":
      return "rejected";
    case "hold":
      return "archived";
    default:
      return "pending";
  }
}

function formatReviewAction(status: CandidateReviewStatus): ProductOpportunityCandidate["reviewStatus"] {
  switch (status) {
    case "approved":
      return "approve";
    case "rejected":
      return "reject";
    case "archived":
      return "hold";
    default:
      return "pending";
  }
}

function translateReviewStatus(status: CandidateReviewStatus, t: Translator): string {
  switch (status) {
    case "approved":
      return t("candidate.review.approved");
    case "rejected":
      return t("candidate.review.rejected");
    case "archived":
      return t("candidate.review.archived");
    default:
      return t("candidate.review.pending");
  }
}

function formatAgentStatus(status: string | undefined, t: Translator): string {
  switch (status) {
    case undefined:
      return t("agentStatus.idle");
    case "running":
      return t("agentStatus.running");
    case "paused":
      return t("agentStatus.paused");
    case "stopped":
      return t("agentStatus.stopped");
    case "failed":
      return t("agentStatus.failed");
    case "completed":
      return t("agentStatus.completed");
    case "review_required":
      return t("agentStatus.reviewRequired");
    default:
      return status;
  }
}

function buildLocaleHref(requestUrl: URL, locale: Locale): string {
  const nextUrl = new URL(requestUrl.toString());
  nextUrl.searchParams.set("lang", locale);
  const query = nextUrl.searchParams.toString();
  return `${nextUrl.pathname}${query.length > 0 ? `?${query}` : ""}`;
}

function buildEvidencePreview(evidenceRefs: EvidenceRef[], t: Translator): string {
  if (evidenceRefs.length === 0) {
    return `<p class="empty">${escapeHtml(t("empty.noEvidenceLinked"))}</p>`;
  }

  return `<ul class="evidence-list">${evidenceRefs
    .map((evidenceRef) => {
      const hasLocalFile = Boolean(evidenceRef.filePath);
      const localFilePath = evidenceRef.filePath ? escapeHtml(evidenceRef.filePath) : "";
      return `<li class="evidence-item">
  <div class="evidence-head">
    <span class="badge subtle">${escapeHtml(evidenceRef.kind)}</span>
    <span class="mono">${escapeHtml(evidenceRef.id)}</span>
  </div>
  <div>${escapeHtml(evidenceRef.summary)}</div>
  ${hasLocalFile ? `<details>
    <summary>${escapeHtml(t("evidence.localOnlyPath"))}</summary>
    <div class="mono break-all">${localFilePath}</div>
  </details>` : ""}
</li>`;
    })
    .join("")}</ul>`;
}

function buildCandidateCard(candidate: ProductOpportunityCandidate, t: Translator): string {
  const reviewStatus = mapReviewStatus(candidate.reviewStatus);
  return `<article class="candidate-card">
  <header class="candidate-header">
    <div>
      <h3>${escapeHtml(candidate.category)}</h3>
      <p class="muted">${escapeHtml(candidate.useCase)}</p>
    </div>
    <span class="badge ${reviewStatus}">${escapeHtml(translateReviewStatus(reviewStatus, t))}</span>
  </header>
  <dl class="candidate-grid">
    <div><dt>${escapeHtml(t("candidate.sellingPoints"))}</dt><dd>${escapeHtml(candidate.sellingPoints.join(" / "))}</dd></div>
    <div><dt>${escapeHtml(t("candidate.painPoints"))}</dt><dd>${escapeHtml(candidate.painPoints.join(" / "))}</dd></div>
    <div><dt>${escapeHtml(t("candidate.purchaseIntent"))}</dt><dd>${escapeHtml(candidate.purchaseIntent)}</dd></div>
    <div><dt>${escapeHtml(t("candidate.risk"))}</dt><dd>${escapeHtml(candidate.risk)}</dd></div>
    <div><dt>${escapeHtml(t("candidate.score"))}</dt><dd>${candidate.score.toFixed(2)}</dd></div>
    <div><dt>${escapeHtml(t("candidate.evidenceCount"))}</dt><dd>${candidate.evidenceRefs.length}</dd></div>
    <div><dt>${escapeHtml(t("candidate.created"))}</dt><dd>${escapeHtml(candidate.createdAt)}</dd></div>
    <div><dt>${escapeHtml(t("candidate.updated"))}</dt><dd>${escapeHtml(candidate.updatedAt)}</dd></div>
  </dl>
  <div class="candidate-actions">
    <button onclick="reviewCandidate('${candidate.id}', 'approved')">${escapeHtml(t("actions.markApproved"))}</button>
    <button onclick="reviewCandidate('${candidate.id}', 'rejected')">${escapeHtml(t("actions.markRejected"))}</button>
    <button onclick="reviewCandidate('${candidate.id}', 'archived')">${escapeHtml(t("actions.archive"))}</button>
    <button class="danger" onclick="deleteCandidate('${candidate.id}')">${escapeHtml(t("actions.delete"))}</button>
  </div>
  <details>
    <summary>${escapeHtml(t("candidate.evidencePreview"))}</summary>
    ${buildEvidencePreview(candidate.evidenceRefs, t)}
  </details>
  <details>
    <summary>${escapeHtml(t("candidate.notes"))}</summary>
    ${candidate.notes.length > 0 ? `<ul>${candidate.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>` : `<p class="empty">${escapeHtml(t("empty.noOperatorNotes"))}</p>`}
  </details>
</article>`;
}

function buildActionLogs(actionLogs: ActionLog[], t: Translator): string {
  if (actionLogs.length === 0) {
    return `<p class="empty">${escapeHtml(t("empty.noActionLogs"))}</p>`;
  }

  return `<ul class="log-list">${actionLogs
    .slice(-8)
    .reverse()
    .map((actionLog) => `<li>
  <div class="log-head">
    <span class="badge subtle">${escapeHtml(actionLog.status)}</span>
    <span>${escapeHtml(actionLog.actionType)}</span>
    <span class="muted">${escapeHtml(actionLog.createdAt)}</span>
  </div>
  <div>${escapeHtml(actionLog.message)}</div>
</li>`)
    .join("")}</ul>`;
}

export function renderOperatorConsole(snapshot: OperatorSnapshot, options: RenderOperatorConsoleOptions): string {
  const t = createTranslator(options.locale);
  const hiddenPathLabel = t("runtime.localOnlyPathHidden");
  const runtimeSummary = summarizeRuntimeStatus(snapshot.runtime.components, t);
  const currentTask = snapshot.agent.currentTask;
  const currentRound = snapshot.state.agentRounds
    .filter((round) => round.taskRunId === currentTask?.id)
    .sort((left, right) => right.index - left.index)[0] ?? null;
  const lastError = currentTask?.status === "failed"
    ? sanitizeDisplayText(currentTask.note ?? t("runtime.failedDefault"), hiddenPathLabel)
    : null;
  const lastUpdated = currentTask?.updatedAt ?? snapshot.runtime.generatedAt;
  const delivery = snapshot.delivery;
  const candidateCards = snapshot.state.candidates.length > 0
    ? snapshot.state.candidates.map((candidate) => buildCandidateCard(candidate, t)).join("\n")
    : `<div class="empty-panel"><h3>${escapeHtml(t("section.candidatePool"))}</h3><p class="empty">${escapeHtml(t("empty.noCandidates"))}</p></div>`;
  const evidencePreview = snapshot.state.candidates.length > 0
    ? snapshot.state.candidates.slice(0, 2).map((candidate) => `<article class="preview-card">
  <h3>${escapeHtml(candidate.category)}</h3>
  ${buildEvidencePreview(candidate.evidenceRefs.slice(0, 3), t)}
</article>`).join("\n")
    : `<p class="empty">${escapeHtml(t("empty.noEvidence"))}</p>`;
  const modeBadge = "ok";
  const dataModeDisplay = t("mode.realPlatform");
  const platformDisplay = snapshot.mode.platformId;
  const realPlatformDisplay = snapshot.mode.realPlatformConnection;
  const browserModeDisplay = snapshot.mode.browserMode;
  const browserExecutableDisplay = sanitizeDisplayText(snapshot.mode.browserExecutable ?? t("mode.notConnected"), hiddenPathLabel);
  const browserProfileRefDisplay = snapshot.mode.browserProfileRef;
  const browserProfileStatusDisplay = snapshot.mode.browserProfileStatus;
  const browserProfileDirectoryDisplay = snapshot.mode.browserProfileDirectory;
  const browserProfileProvisioningDisplay = snapshot.mode.browserProfileProvisioning;
  const browserProfileVerificationStatusDisplay = snapshot.mode.browserProfileVerificationStatus;
  const browserProfileVerificationReasonDisplay = sanitizeDisplayText(snapshot.mode.browserProfileVerificationReason ?? t("runtime.noActiveErrors"), hiddenPathLabel);
  const loginStateDisplay = snapshot.mode.loginState;
  const lastLoginCheckDisplay = snapshot.mode.lastLoginCheckAt ?? t("mode.notConnected");
  const loginRequiredReasonDisplay = sanitizeDisplayText(snapshot.mode.loginRequiredReason ?? t("runtime.noActiveErrors"), hiddenPathLabel);
  const browserReviewReasonDisplay = sanitizeDisplayText(snapshot.mode.reviewRequiredReason ?? t("runtime.noActiveErrors"), hiddenPathLabel);
  const dialogMessages = JSON.stringify({
    requestFailed: t("dialogs.requestFailed"),
    optionalOperatorNote: t("dialogs.optionalOperatorNote"),
    reviewUpdateFailed: t("dialogs.reviewUpdateFailed"),
    deleteConfirm: t("dialogs.deleteConfirm"),
    deleteFailed: t("dialogs.deleteFailed"),
    resetStoreConfirm: t("dialogs.resetStoreConfirm"),
    resetFailed: t("dialogs.resetFailed"),
  });

  return `<!doctype html>
<html lang="${options.locale === "zh" ? "zh-CN" : "en"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(t("app.title"))}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f1e8;
        --panel: #fffaf2;
        --ink: #1c1b18;
        --muted: #6c6459;
        --line: #d9ccb9;
        --accent: #165d52;
        --accent-soft: #dcebe6;
        --warn: #8a4b17;
        --warn-soft: #f5e0cf;
        --danger: #8a2d2d;
        --danger-soft: #f4d7d7;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Georgia, "Iowan Old Style", serif;
        background: radial-gradient(circle at top, #fff8ee 0%, var(--bg) 60%, #efe4d3 100%);
        color: var(--ink);
      }
      main {
        max-width: 1240px;
        margin: 0 auto;
        padding: 28px 20px 48px;
      }
      .hero, .panel, .candidate-card, .preview-card {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 18px;
        box-shadow: 0 10px 30px rgba(28, 27, 24, 0.06);
      }
      .hero {
        padding: 24px;
        margin-bottom: 18px;
      }
      h1, h2, h3 { margin: 0; }
      .hero p, .muted, .empty { color: var(--muted); }
      .summary-grid, .runtime-grid, .candidate-grid, .preview-grid {
        display: grid;
        gap: 12px;
      }
      .summary-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-top: 18px; }
      .runtime-grid, .preview-grid { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
      .candidate-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin: 16px 0; }
      .metric, .panel, .candidate-card, .preview-card { padding: 18px; }
      .metric-label, dt { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
      .metric-value, dd { margin: 6px 0 0; font-size: 16px; }
      .toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
      .language-switch {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 16px;
      }
      .locale-link {
        color: var(--accent);
        text-decoration: none;
        font-weight: 600;
      }
      .locale-link.active {
        text-decoration: underline;
      }
      button, .action-link {
        appearance: none;
        border: 1px solid var(--accent);
        background: var(--accent);
        color: #fff;
        padding: 10px 14px;
        border-radius: 999px;
        cursor: pointer;
        font: inherit;
        text-decoration: none;
      }
      button.secondary, .action-link.secondary { background: transparent; color: var(--accent); }
      button.danger { background: var(--danger); border-color: var(--danger); }
      .section-title { margin: 0 0 12px; }
      .panel-stack { display: grid; gap: 18px; margin-top: 18px; }
      .runtime-head, .candidate-header, .log-head, .evidence-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
      }
      .badge.ok, .badge.approved { background: var(--accent-soft); color: var(--accent); }
      .badge.warn, .badge.archived { background: var(--warn-soft); color: var(--warn); }
      .badge.rejected { background: var(--danger-soft); color: var(--danger); }
      .badge.pending, .badge.subtle { background: #eee4d5; color: #6b5f52; }
      .mono { font-family: "SFMono-Regular", Menlo, monospace; font-size: 12px; }
      .break-all { word-break: break-all; }
      details { margin-top: 12px; }
      summary { cursor: pointer; color: var(--accent); }
      .log-list, .evidence-list { list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 10px; }
      .log-list li, .evidence-item { border-top: 1px solid var(--line); padding-top: 10px; }
      .candidate-list, .preview-grid { display: grid; gap: 18px; }
      .empty-panel { padding: 28px; border: 1px dashed var(--line); border-radius: 18px; background: rgba(255, 250, 242, 0.55); }
      .error-panel { border-color: #d9a1a1; background: #fff5f5; }
      @media (max-width: 720px) {
        main { padding: 18px 14px 36px; }
        .runtime-head, .candidate-header, .log-head, .evidence-head { flex-direction: column; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div class="runtime-head">
          <div>
            <h1>${escapeHtml(t("app.title"))}</h1>
            <p>${escapeHtml(t("app.subtitle"))}</p>
          </div>
          <span class="badge ${runtimeSummary.tone}">${runtimeSummary.label}</span>
        </div>
        <div class="language-switch" aria-label="${escapeHtml(t("language.label"))}">
          <span class="metric-label">${escapeHtml(t("language.label"))}</span>
          <a class="locale-link ${options.locale === "en" ? "active" : ""}" href="${escapeHtml(buildLocaleHref(options.requestUrl, "en"))}">${escapeHtml(t("language.english"))}</a>
          <span class="muted">|</span>
          <a class="locale-link ${options.locale === "zh" ? "active" : ""}" href="${escapeHtml(buildLocaleHref(options.requestUrl, "zh"))}">${escapeHtml(t("language.chinese"))}</a>
        </div>
        <div class="summary-grid">
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.dataMode"))}</div><div class="metric-value"><span class="badge ${modeBadge}">${escapeHtml(dataModeDisplay)}</span></div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.platform"))}</div><div class="metric-value">${escapeHtml(platformDisplay)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.adapter"))}</div><div class="metric-value">${escapeHtml(snapshot.mode.platformLabel)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.realPlatform"))}</div><div class="metric-value">${escapeHtml(realPlatformDisplay)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.browserMode"))}</div><div class="metric-value">${escapeHtml(browserModeDisplay)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.browserExecutable"))}</div><div class="metric-value mono break-all">${escapeHtml(browserExecutableDisplay)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.browserProfileRef"))}</div><div class="metric-value mono">${escapeHtml(browserProfileRefDisplay)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.browserProfileStatus"))}</div><div class="metric-value">${escapeHtml(browserProfileStatusDisplay)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.browserProfileDirectory"))}</div><div class="metric-value mono">${escapeHtml(browserProfileDirectoryDisplay)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.browserProfileProvisioning"))}</div><div class="metric-value">${escapeHtml(browserProfileProvisioningDisplay)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.browserProfileVerificationStatus"))}</div><div class="metric-value">${escapeHtml(browserProfileVerificationStatusDisplay)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.browserProfileVerificationReason"))}</div><div class="metric-value">${escapeHtml(browserProfileVerificationReasonDisplay)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.loginState"))}</div><div class="metric-value">${escapeHtml(loginStateDisplay)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.lastLoginCheckAt"))}</div><div class="metric-value mono">${escapeHtml(lastLoginCheckDisplay)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.loginRequiredReason"))}</div><div class="metric-value">${escapeHtml(loginRequiredReasonDisplay)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.browserReviewReason"))}</div><div class="metric-value">${escapeHtml(browserReviewReasonDisplay)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.storeScope"))}</div><div class="metric-value">${escapeHtml(snapshot.mode.storeScope)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.executionMode"))}</div><div class="metric-value">${escapeHtml(snapshot.mode.executionMode)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.fallbackMode"))}</div><div class="metric-value">${escapeHtml(snapshot.mode.fallbackMode)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.geometryGuard"))}</div><div class="metric-value">${escapeHtml(snapshot.mode.geometryGuard)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.viewport"))}</div><div class="metric-value mono">${escapeHtml(snapshot.mode.viewport)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.calibration"))}</div><div class="metric-value mono">${escapeHtml(snapshot.mode.calibration)}</div></div>
        </div>
        <div class="summary-grid">
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.serviceStatus"))}</div><div class="metric-value">${runtimeSummary.label}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.agentStatus"))}</div><div class="metric-value">${escapeHtml(formatAgentStatus(currentTask?.status, t))}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.currentTaskId"))}</div><div class="metric-value mono">${escapeHtml(currentTask?.id ?? "none")}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.currentRoundId"))}</div><div class="metric-value mono">${escapeHtml(currentRound?.id ?? "none")}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.currentRoundStep"))}</div><div class="metric-value">${escapeHtml(delivery.currentRoundStep)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.pageReadyStatus"))}</div><div class="metric-value">${escapeHtml(delivery.pageReadyStatus)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.localAiStatus"))}</div><div class="metric-value">${escapeHtml(delivery.localAiStatus)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.evidenceCount"))}</div><div class="metric-value">${delivery.evidenceCount}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.candidateCount"))}</div><div class="metric-value">${snapshot.state.candidates.length}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.actionLogCount"))}</div><div class="metric-value">${snapshot.state.actionLogs.length}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.lastUpdated"))}</div><div class="metric-value mono">${escapeHtml(lastUpdated)}</div></div>
          <div class="metric"><div class="metric-label">${escapeHtml(t("metric.runtimeNote"))}</div><div class="metric-value">${escapeHtml(sanitizeDisplayText(currentTask?.note ?? t("runtime.noActiveErrors"), hiddenPathLabel))}</div></div>
        </div>
        <div class="toolbar" aria-label="Operator Controls">
          <button onclick="runCommand('/api/tasks/start', 'POST')">${escapeHtml(t("actions.start"))}</button>
          <button class="secondary" onclick="runCommand('/api/tasks/pause', 'POST')">${escapeHtml(t("actions.pause"))}</button>
          <button class="secondary" onclick="runCommand('/api/tasks/stop', 'POST')">${escapeHtml(t("actions.stop"))}</button>
          <button class="secondary" onclick="resetStore('/api/runtime/reset-store', messages.resetStoreConfirm)">${escapeHtml(t("actions.clearLocalStore"))}</button>
          <button class="secondary" onclick="location.reload()">${escapeHtml(t("actions.refresh"))}</button>
          <a class="action-link secondary" href="/api/candidates/export" target="_blank" rel="noreferrer">${escapeHtml(t("actions.exportCandidates"))}</a>
        </div>
      </section>

      ${lastError ? `<section class="panel error-panel"><h2 class="section-title">${escapeHtml(t("section.error"))}</h2><p>${escapeHtml(lastError)}</p></section>` : ""}

      <div class="panel-stack">
        <section class="panel">
          <h2 class="section-title">${escapeHtml(t("section.runtimeStatus"))}</h2>
          <div class="runtime-grid">
            ${snapshot.runtime.components.map((component) => `<article class="preview-card">
  <div class="runtime-head">
    <h3>${escapeHtml(component.name)}</h3>
    <span class="badge ${component.ok ? "ok" : "warn"}">${escapeHtml(component.ok ? t("runtime.ok") : t("runtime.warn"))}</span>
  </div>
  <p>${escapeHtml(sanitizeDisplayText(component.detail, hiddenPathLabel))}</p>
</article>`).join("")}
          </div>
        </section>

        <section class="panel">
          <h2 class="section-title">${escapeHtml(t("section.deliveryStatus"))}</h2>
          <div class="runtime-grid">
            <article class="preview-card">
              <h3>${escapeHtml(t("metric.currentUrl"))}</h3>
              <p class="mono break-all">${escapeHtml(delivery.currentUrl || "about:blank")}</p>
            </article>
            <article class="preview-card">
              <h3>${escapeHtml(t("metric.targetUrl"))}</h3>
              <p class="mono break-all">${escapeHtml(delivery.targetUrl ?? "none")}</p>
            </article>
            <article class="preview-card">
              <h3>${escapeHtml(t("metric.navigationError"))}</h3>
              <p>${escapeHtml(delivery.lastNavigationError ?? "none")}</p>
            </article>
            <article class="preview-card">
              <h3>${escapeHtml(t("metric.reviewReason"))}</h3>
              <p>${escapeHtml(delivery.reviewRequiredReason ?? "none")}</p>
            </article>
            <article class="preview-card">
              <h3>${escapeHtml(t("metric.stopReason"))}</h3>
              <p>${escapeHtml(delivery.lastStopReason ?? "none")}</p>
            </article>
            <article class="preview-card">
              <h3>${escapeHtml(t("metric.latestScreenshot"))}</h3>
              <p class="mono break-all">${escapeHtml(delivery.latestScreenshotEvidenceId ?? "none")}</p>
              <p class="mono break-all">${escapeHtml(delivery.latestScreenshotPath ?? "none")}</p>
            </article>
            <article class="preview-card">
              <h3>${escapeHtml(t("metric.latestAiResult"))}</h3>
              <p class="mono break-all">${escapeHtml(delivery.latestAiResultId ?? "none")}</p>
              <p>${escapeHtml(delivery.latestAiResultSummary ?? "none")}</p>
            </article>
            <article class="preview-card">
              <h3>${escapeHtml(t("metric.latestAction"))}</h3>
              <p class="mono break-all">${escapeHtml(delivery.latestActionLogId ?? "none")}</p>
              <p>${escapeHtml(delivery.latestActionResult ?? "none")}</p>
            </article>
            <article class="preview-card">
              <h3>${escapeHtml(t("metric.noCandidateReason"))}</h3>
              <p>${escapeHtml(delivery.noCandidateReason ?? "none")}</p>
            </article>
            <article class="preview-card">
              <h3>${escapeHtml(t("metric.lastError"))}</h3>
              <p>${escapeHtml(delivery.lastError ?? "none")}</p>
            </article>
          </div>
        </section>

        <section class="panel">
          <h2 class="section-title">${escapeHtml(t("section.candidatePool"))}</h2>
          <div class="candidate-list">${candidateCards}</div>
        </section>

        <section class="panel">
          <h2 class="section-title">${escapeHtml(t("section.evidencePreview"))}</h2>
          <div class="preview-grid">${evidencePreview}</div>
        </section>

        <section class="panel">
          <h2 class="section-title">${escapeHtml(t("section.actionLogs"))}</h2>
          <details open>
            <summary>${escapeHtml(t("logs.recentActionLogs"))}</summary>
            ${buildActionLogs(snapshot.state.actionLogs, t)}
          </details>
        </section>

        <section class="panel">
          <h2 class="section-title">${escapeHtml(t("section.jsonDebug"))}</h2>
          <p class="muted">${escapeHtml(t("debug.description"))}</p>
          <details>
            <summary>${escapeHtml(t("debug.openEndpoints"))}</summary>
            <ul>
              <li><a href="/api/runtime/health" target="_blank" rel="noreferrer">${escapeHtml(t("debug.runtimeHealth"))}</a></li>
              <li><a href="/api/runtime/snapshot" target="_blank" rel="noreferrer">${escapeHtml(t("debug.runtimeSnapshot"))}</a></li>
            </ul>
          </details>
        </section>
      </div>
    </main>
    <script>
      const messages = ${dialogMessages};

      async function runCommand(url, method) {
        const response = await fetch(url, { method });
        if (!response.ok) {
          const body = await response.text();
          window.alert(messages.requestFailed + ': ' + body);
          return;
        }
        location.reload();
      }

      async function reviewCandidate(candidateId, reviewStatus) {
        const note = window.prompt(messages.optionalOperatorNote, '') || '';
        const response = await fetch('/api/candidates/' + candidateId + '/review', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reviewStatus, note })
        });
        if (!response.ok) {
          const body = await response.text();
          window.alert(messages.reviewUpdateFailed + ': ' + body);
          return;
        }
        location.reload();
      }

      async function deleteCandidate(candidateId) {
        const confirmed = window.confirm(messages.deleteConfirm);
        if (!confirmed) {
          return;
        }
        const response = await fetch('/api/candidates/' + candidateId, { method: 'DELETE' });
        if (!response.ok && response.status !== 204) {
          const body = await response.text();
          window.alert(messages.deleteFailed + ': ' + body);
          return;
        }
        location.reload();
      }

      async function resetStore(url, message) {
        const confirmed = window.confirm(message);
        if (!confirmed) {
          return;
        }
        const response = await fetch(url, { method: 'POST' });
        if (!response.ok) {
          const body = await response.text();
          window.alert(messages.resetFailed + ': ' + body);
          return;
        }
        location.reload();
      }
    </script>
  </body>
</html>`;
}

export function mapReviewStatusToDisposition(status: CandidateReviewStatus): ProductOpportunityCandidate["reviewStatus"] {
  return formatReviewAction(status);
}