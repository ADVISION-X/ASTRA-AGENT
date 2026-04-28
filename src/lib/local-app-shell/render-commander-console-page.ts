import type { Locale } from "../localization/dictionaries.js";
import { createTranslator } from "../localization/render-text.js";
import { buildCommanderConsolePageModel } from "../../capabilities/commander-console/read-models.js";
import type { CommanderConsolePageLog, CommanderConsolePageMetric, CommanderConsolePageRecord, CommanderMissionDashboard } from "../../capabilities/commander-console/shared/view-model-types.js";
import { commanderConsolePageClient } from "./commander-console-page-client.js";
import { commanderConsolePageStyles } from "./commander-console-page-styles.js";
import { buildLocaleHref as buildShellLocaleHref, escapeHtml, safeJsonScript } from "./render-helpers.js";

function buildLocaleHref(requestUrl: URL, locale: Locale): string {
  return buildShellLocaleHref(requestUrl, locale);
}

const renderMetrics = (metrics: CommanderConsolePageMetric[]): string => metrics.map((metric) => `
  <div class="metric-row">
    <span class="metric-label">${escapeHtml(metric.label)}</span>
    <span class="metric-value${metric.tone ? ` tone-${metric.tone}` : ""}">${escapeHtml(metric.value)}</span>
  </div>
`).join("");

const renderRecords = (records: CommanderConsolePageRecord[], emptyLabel: string): string => {
  if (records.length === 0) {
    return `<p class="empty">${escapeHtml(emptyLabel)}</p>`;
  }

  return `<div class="record-list">${records.map((record) => `
    <article class="record">
      <h3>${escapeHtml(record.primary)}</h3>
      <p><code>${escapeHtml(record.id)}</code></p>
      <p>${escapeHtml(record.secondary)}</p>
      <p>${escapeHtml(record.detail)}</p>
    </article>
  `).join("")}</div>`;
};

const renderLogs = (logs: CommanderConsolePageLog[], emptyLabel: string): string => {
  if (logs.length === 0) {
    return `<p class="empty">${escapeHtml(emptyLabel)}</p>`;
  }

  return `<table class="log-table">
    <thead>
      <tr><th>time</th><th>step</th><th>status</th><th>message</th></tr>
    </thead>
    <tbody>
      ${logs.map((log) => `
        <tr>
          <td>${escapeHtml(log.createdAt)}</td>
          <td><code>${escapeHtml(log.step)}</code></td>
          <td>${escapeHtml(log.status)}</td>
          <td>${escapeHtml(log.message)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>`;
};

const renderCandidates = (payload: ReturnType<typeof buildCommanderConsolePageModel>, emptyLabel: string, actions: {
  approve: string;
  reject: string;
  archive: string;
  remove: string;
}): string => {
  if (payload.candidates.length === 0) {
    return `<p class="empty">${escapeHtml(emptyLabel)}</p>`;
  }

  return `<div class="record-list">${payload.candidates.map((candidate) => `
    <article class="record">
      <h3>${escapeHtml(candidate.category)} · ${escapeHtml(candidate.useCase)}</h3>
      <p><code>${escapeHtml(candidate.id)}</code></p>
      <p>score=${escapeHtml(candidate.score)} · intent=${escapeHtml(candidate.purchaseIntent)} · review=${escapeHtml(candidate.reviewStatus)}</p>
      <p>evidence=${escapeHtml(String(candidate.evidenceCount))} · created=${escapeHtml(candidate.createdAt)}</p>
      ${candidate.notes.length > 0 ? `<p>${escapeHtml(candidate.notes.join(" | "))}</p>` : ""}
      <div class="record-actions">
        <button onclick="commanderConsoleShell.markCandidate('${escapeHtml(candidate.id)}', 'approve')">${escapeHtml(actions.approve)}</button>
        <button class="warn" onclick="commanderConsoleShell.markCandidate('${escapeHtml(candidate.id)}', 'hold')">${escapeHtml(actions.archive)}</button>
        <button class="danger" onclick="commanderConsoleShell.markCandidate('${escapeHtml(candidate.id)}', 'reject')">${escapeHtml(actions.reject)}</button>
        <button class="danger" onclick="commanderConsoleShell.deleteCandidate('${escapeHtml(candidate.id)}')">${escapeHtml(actions.remove)}</button>
      </div>
    </article>
  `).join("")}</div>`;
};

export function renderCommanderConsolePage(dashboard: CommanderMissionDashboard, options: {
  locale: Locale;
  requestUrl: URL;
}): string {
  const t = createTranslator(options.locale);
  const payload = buildCommanderConsolePageModel(dashboard, options.locale);

  return `<!doctype html>
<html lang="${options.locale === "zh" ? "zh-CN" : "en"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(t("app.title"))}</title>
    <style>${commanderConsolePageStyles}</style>
  </head>
  <body>
    <main>
      <section class="card hero">
        <div>
          <h1>${escapeHtml(t("app.title"))}</h1>
          <p>${escapeHtml(payload.missionSummary)}</p>
          <div class="status-line">
            <span class="badge">${escapeHtml(payload.missionStatus)}</span>
            <span class="badge">${escapeHtml(payload.auditSummary.totals)}</span>
            <span class="badge">${escapeHtml(payload.auditSummary.generatedAt)}</span>
          </div>
        </div>
        <div>
          <div class="actions">
            <button class="primary" onclick="commanderConsoleShell.issueCommand('/api/tasks/start')">${escapeHtml(t("actions.start"))}</button>
            <button class="warn" onclick="commanderConsoleShell.issueCommand('/api/tasks/pause')">${escapeHtml(t("actions.pause"))}</button>
            <button class="danger" onclick="commanderConsoleShell.issueCommand('/api/tasks/stop', { reason: 'operator_stop' })">${escapeHtml(t("actions.stop"))}</button>
            <button onclick="location.reload()">${escapeHtml(t("actions.refresh"))}</button>
            <a class="action-link" href="/api/candidates/export" target="_blank" rel="noreferrer">${escapeHtml(t("actions.exportCandidates"))}</a>
          </div>
          <div class="language-switch" aria-label="${escapeHtml(t("language.label"))}">
            <span>${escapeHtml(t("language.label"))}</span>
            <a class="action-link" href="${escapeHtml(buildLocaleHref(options.requestUrl, "en"))}">${escapeHtml(t("language.english"))}</a>
            <a class="action-link" href="${escapeHtml(buildLocaleHref(options.requestUrl, "zh"))}">${escapeHtml(t("language.chinese"))}</a>
          </div>
        </div>
      </section>

      <section class="card span-4">
        <h2 class="section-title">mission</h2>
        <div class="metric-list">${renderMetrics(payload.missionMetrics)}</div>
      </section>
      <section class="card span-4">
        <h2 class="section-title">runtime</h2>
        <div class="metric-list">${renderMetrics(payload.runtimeMetrics)}</div>
      </section>
      <section class="card span-4">
        <h2 class="section-title">browser</h2>
        <div class="metric-list">${renderMetrics(payload.browserMetrics)}</div>
      </section>

      <section class="card span-4">
        <h2 class="section-title">health</h2>
        <div class="metric-list">${renderMetrics(payload.healthMetrics)}</div>
      </section>
      <section class="card span-4">
        <h2 class="section-title">review queue</h2>
        ${renderRecords(payload.reviewQueue, t("empty.noOperatorNotes"))}
      </section>
      <section class="card span-4">
        <h2 class="section-title">audit summary</h2>
        <div class="metric-list">
          ${renderMetrics([
            { label: "phase", value: payload.auditSummary.phase, tone: "muted" },
            { label: "active domains", value: String(payload.auditSummary.activeDomains), tone: "muted" },
            { label: "totals", value: payload.auditSummary.totals },
            { label: "generated", value: payload.auditSummary.generatedAt, tone: "muted" },
          ])}
        </div>
      </section>

      <section class="card span-8">
        <h2 class="section-title">candidate pool</h2>
        ${renderCandidates(payload, t("empty.noCandidates"), {
          approve: t("actions.markApproved"),
          reject: t("actions.markRejected"),
          archive: t("actions.archive"),
          remove: t("actions.delete"),
        })}
      </section>
      <section class="card span-4">
        <h2 class="section-title">runtime proof</h2>
        ${renderLogs(payload.runtimeProof, t("empty.noActionLogs"))}
      </section>

      <section class="card span-4">
        <h2 class="section-title">evidence packets</h2>
        ${renderRecords(payload.evidencePackets, t("empty.noEvidence"))}
      </section>
      <section class="card span-4">
        <h2 class="section-title">browse ledger</h2>
        ${renderRecords(payload.browseLedger, t("empty.noEvidenceLinked"))}
      </section>
      <section class="card span-4">
        <h2 class="section-title">failed records</h2>
        ${renderRecords(payload.failedRecords, t("runtime.noActiveErrors"))}
      </section>
    </main>
    <script>window.__grasseyeCommanderConsolePayload = ${safeJsonScript(payload)};</script>
    <script>${commanderConsolePageClient}</script>
  </body>
</html>`;
}
