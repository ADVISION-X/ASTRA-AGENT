import type { CommanderMissionDashboardView } from "../../../capabilities/commander-console/shared/commander-view-types.js";
import type { Locale } from "../../localization/dictionaries.js";

import { localizeCommanderText } from "../locale.js";
import type {
  CommanderConsoleBadge,
  CommanderConsoleFailureItem,
  CommanderConsolePreflightCheck,
  CommanderConsoleViewModel,
} from "../types.js";

function hasHealthAttention(dashboard: CommanderMissionDashboardView): boolean {
  return dashboard.health.some((entry) => entry.tone === "danger" || entry.tone === "warn");
}

function resolveRuntimeMetricTone(status: CommanderMissionDashboardView["runtime"]["runtimeStatus"]): "blocked" | "attention" | "ok" {
  if (status === "failed") {
    return "blocked";
  }
  if (status === "review_required") {
    return "attention";
  }
  return "ok";
}

function buildReadyRatio(dashboard: CommanderMissionDashboardView, locale: Locale): string {
  const totals = dashboard.auditSummary.totals;
  return totals ? `${totals.passed}/${totals.inspectors}` : localizeCommanderText(locale, "未知", "unknown");
}

function buildPendingReviewLabel(pendingReviews: number, locale: Locale): string {
  return pendingReviews === 0
    ? localizeCommanderText(locale, "0 复核", "0 reviews")
    : localizeCommanderText(locale, `${pendingReviews} 个复核`, `${pendingReviews} reviews`);
}

function createFailureItem(
  id: string,
  label: string,
  severity: CommanderConsoleFailureItem["severity"],
  detail: string,
): CommanderConsoleFailureItem {
  return { id, label, severity, detail };
}

function getStartupReadinessEntry(dashboard: CommanderMissionDashboardView) {
  return dashboard.health.find((entry) => entry.id === "startup-readiness");
}

function createStartupReadinessFailure(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
): CommanderConsoleFailureItem | null {
  const startupReadiness = getStartupReadinessEntry(dashboard);
  if (!startupReadiness || (startupReadiness.tone !== "danger" && startupReadiness.tone !== "warn" && startupReadiness.missionRuntimeAvailable !== false)) {
    return null;
  }

  return createFailureItem(
    "startup-readiness",
    localizeCommanderText(locale, "启动门禁", "Startup readiness gate"),
    startupReadiness.tone === "danger" || startupReadiness.missionRuntimeAvailable === false ? "blocked" : "attention",
    startupReadiness.failureReason ? `${startupReadiness.failureReason}; ${startupReadiness.detail}` : startupReadiness.detail,
  );
}

function createReviewReasonFailure(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
): CommanderConsoleFailureItem | null {
  return dashboard.runtime.reviewReason
    ? createFailureItem(
        "review-reason",
        localizeCommanderText(locale, "人工复核原因", "Review reason"),
        "attention",
        dashboard.runtime.reviewReason,
      )
    : null;
}

function createAiFailure(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
): CommanderConsoleFailureItem | null {
  return dashboard.runtime.lastAiFailureReason
    ? createFailureItem(
        "ai-failure",
        localizeCommanderText(locale, "最近 AI 失败", "Latest AI failure"),
        "blocked",
        dashboard.runtime.lastAiFailureReason,
      )
    : null;
}

function createMissingStartBindingFailure(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
): CommanderConsoleFailureItem | null {
  return dashboard.runtime.runtimeStatus !== "idle" && (!dashboard.mission.requestedPlatform || !dashboard.mission.selectedMapId)
    ? createFailureItem(
        "missing-start-binding",
        localizeCommanderText(locale, "启动草案缺字段", "Start draft missing fields"),
        "blocked",
        localizeCommanderText(locale, "运行中的任务缺少已解析绑定，这是非法状态。", "A running mission is missing its resolved binding, which is an invalid state."),
      )
    : null;
}

function collectBlockingFailures(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
): CommanderConsoleFailureItem[] {
  return [
    createStartupReadinessFailure(dashboard, locale),
    createReviewReasonFailure(dashboard, locale),
    createAiFailure(dashboard, locale),
    createMissingStartBindingFailure(dashboard, locale),
  ].filter((failure): failure is CommanderConsoleFailureItem => Boolean(failure));
}

function createClearFailure(locale: Locale): CommanderConsoleFailureItem {
  return createFailureItem(
    "clear",
    localizeCommanderText(locale, "当前无阻断项", "No blocking findings"),
    "ok",
    localizeCommanderText(locale, "当前没有从 snapshot 派生出的阻断信号。", "No blocking signal is derived from the current snapshot."),
  );
}

function applyReviewStatusSummary(
  summary: CommanderConsoleViewModel["reviewQueueSummary"],
  reviewStatus: CommanderMissionDashboardView["candidates"][number]["reviewStatus"],
): CommanderConsoleViewModel["reviewQueueSummary"] {
  if (reviewStatus === "approved") {
    summary.gatePassedCount += 1;
    return summary;
  }
  if (reviewStatus === "rejected") {
    summary.rejectedCount += 1;
    return summary;
  }
  if (reviewStatus === "archived" || reviewStatus === "hold") {
    summary.archivedCount += 1;
    return summary;
  }

  summary.pendingCount += 1;
  return summary;
}

function resolveStartupReadinessStatus(
  startupReadiness: ReturnType<typeof getStartupReadinessEntry>,
): CommanderConsolePreflightCheck["status"] {
  if (startupReadiness?.missionRuntimeAvailable) {
    return "ok";
  }
  if (startupReadiness?.tone === "warn") {
    return "attention";
  }
  return startupReadiness ? "blocked" : "attention";
}

function buildStartupReadinessDetail(
  startupReadiness: ReturnType<typeof getStartupReadinessEntry>,
  locale: Locale,
): string {
  if (!startupReadiness) {
    return localizeCommanderText(locale, "当前会话没有 startup readiness 上下文。", "This session has no startup readiness context.");
  }

  const prefix = `missionRuntimeAvailable=${startupReadiness.missionRuntimeAvailable ? "true" : "false"}`;
  const detail = startupReadiness.failureReason
    ? `${prefix}; ${startupReadiness.failureReason}; ${startupReadiness.detail}`
    : `${prefix}; ${startupReadiness.detail}`;
  return localizeCommanderText(locale, detail, detail);
}

function createPlatformBindingCheck(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
): CommanderConsolePreflightCheck {
  return {
    id: "platform-binding",
    label: localizeCommanderText(locale, "平台绑定", "Platform binding"),
    status: dashboard.mission.requestedPlatform ? "ok" : "attention",
    detail: dashboard.mission.requestedPlatform
      ? localizeCommanderText(locale, `已指定 ${dashboard.mission.requestedPlatform}`, `Requested ${dashboard.mission.requestedPlatform}`)
      : localizeCommanderText(locale, "待启动时由已批准任务模板解析平台绑定。", "Platform binding will be resolved from the approved task template at launch time."),
  };
}

function createMapSelectionCheck(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
): CommanderConsolePreflightCheck {
  return {
    id: "map-selection",
    label: localizeCommanderText(locale, "地图选择", "Map selection"),
    status: dashboard.mission.selectedMapId ? "ok" : "attention",
    detail: dashboard.mission.selectedMapId
      ? localizeCommanderText(locale, "已绑定受治理任务程序", "Governed task program is bound.")
      : localizeCommanderText(locale, "待启动时由 active approved task template 解析运行地图。", "The active approved task template will resolve the runtime map at launch time."),
  };
}

function createBrowserLoginCheck(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
): CommanderConsolePreflightCheck {
  return {
    id: "browser-login",
    label: localizeCommanderText(locale, "浏览器登录态", "Browser login"),
    status: dashboard.browser.loginState === "logged-in" ? "ok" : "attention",
    detail: localizeCommanderText(locale, `当前状态：${dashboard.browser.loginState}`, `Current state: ${dashboard.browser.loginState}`),
  };
}

function createAuditFreshnessCheck(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
): CommanderConsolePreflightCheck {
  return {
    id: "audit-freshness",
    label: localizeCommanderText(locale, "审计快照", "Audit snapshot"),
    status: dashboard.auditSummary.lastGeneratedAt ? "ok" : "attention",
    detail: dashboard.auditSummary.lastGeneratedAt
      ? localizeCommanderText(locale, `最近生成：${dashboard.auditSummary.lastGeneratedAt}`, `Last generated: ${dashboard.auditSummary.lastGeneratedAt}`)
      : localizeCommanderText(locale, "当前没有新鲜 audit 时间戳。", "No fresh audit generation timestamp is present."),
  };
}

export function buildBadges(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
  activeTaskTemplateLabel: string | null,
): CommanderConsoleBadge[] {
  const healthAttention = hasHealthAttention(dashboard);

  return [
    { label: localizeCommanderText(locale, "运行状态", "runtime"), value: dashboard.runtime.runtimeStatus, tone: healthAttention ? "attention" : "ok" },
    { label: localizeCommanderText(locale, "任务", "mission"), value: dashboard.mission.missionId ?? localizeCommanderText(locale, "待命", "standby"), tone: dashboard.mission.missionId ? "ok" : "attention" },
    { label: localizeCommanderText(locale, "健康", "health"), value: healthAttention ? localizeCommanderText(locale, "需要关注", "attention needed") : localizeCommanderText(locale, "稳定", "stable"), tone: healthAttention ? "attention" : "ok" },
    { label: localizeCommanderText(locale, "任务模板", "task template"), value: activeTaskTemplateLabel ?? localizeCommanderText(locale, "未选择", "unselected"), tone: activeTaskTemplateLabel ? "ok" : "attention" },
  ];
}

export function buildTopMetrics(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
  activeTaskTemplateLabel: string | null,
): CommanderConsoleViewModel["topMetrics"] {
  const pendingReviews = dashboard.candidates.filter((candidate) => candidate.reviewStatus === "pending").length;

  return [
    { id: "runtime", label: localizeCommanderText(locale, "运行", "runtime"), value: dashboard.runtime.runtimeStatus, tone: resolveRuntimeMetricTone(dashboard.runtime.runtimeStatus) },
    { id: "task-template", label: localizeCommanderText(locale, "任务", "task"), value: activeTaskTemplateLabel ?? localizeCommanderText(locale, "未选择", "unselected"), tone: activeTaskTemplateLabel ? "ok" : "attention" },
    { id: "round", label: localizeCommanderText(locale, "轮次", "round"), value: `rnd_${String(dashboard.mission.currentRoundIndex).padStart(3, "0")}`, tone: dashboard.mission.currentRoundIndex > 0 ? "attention" : "ok" },
    { id: "health", label: localizeCommanderText(locale, "健康", "health"), value: buildReadyRatio(dashboard, locale), tone: dashboard.auditSummary.totals?.blocking ? "attention" : "ok" },
    { id: "pending", label: localizeCommanderText(locale, "待处理", "pending"), value: buildPendingReviewLabel(pendingReviews, locale), tone: pendingReviews > 0 ? "attention" : "ok" },
  ];
}

export function buildPreflightSummary(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
): CommanderConsolePreflightCheck[] {
  const startupReadiness = getStartupReadinessEntry(dashboard);
  return [
    {
      id: "startup-readiness",
      label: localizeCommanderText(locale, "启动门禁", "Startup readiness gate"),
      status: resolveStartupReadinessStatus(startupReadiness),
      detail: buildStartupReadinessDetail(startupReadiness, locale),
    },
    createPlatformBindingCheck(dashboard, locale),
    createMapSelectionCheck(dashboard, locale),
    createBrowserLoginCheck(dashboard, locale),
    createAuditFreshnessCheck(dashboard, locale),
  ];
}

export function buildFailureRadar(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
): CommanderConsoleFailureItem[] {
  const failures = collectBlockingFailures(dashboard, locale);
  return failures.length > 0 ? failures : [createClearFailure(locale)];
}

export function buildReviewSummary(
  dashboard: CommanderMissionDashboardView,
): CommanderConsoleViewModel["reviewQueueSummary"] {
  return dashboard.candidates.reduce<CommanderConsoleViewModel["reviewQueueSummary"]>((summary, candidate) => {
    return applyReviewStatusSummary(summary, candidate.reviewStatus);
  }, { pendingCount: 0, gatePassedCount: 0, rejectedCount: 0, archivedCount: 0 });
}
