import type { CommanderMissionDashboardView } from "../../../capabilities/commander-console/shared/commander-view-types.js";
import type { Locale } from "../../../lib/localization/dictionaries.js";

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
  const totals = dashboard.auditSummary.totals;
  const readyRatio = totals ? `${totals.passed}/${totals.inspectors}` : localizeCommanderText(locale, "未知", "unknown");
  const pendingReviews = dashboard.candidates.filter((candidate) => candidate.reviewStatus === "pending").length;

  return [
    { id: "runtime", label: localizeCommanderText(locale, "运行", "runtime"), value: dashboard.runtime.runtimeStatus, tone: dashboard.runtime.runtimeStatus === "failed" ? "blocked" : dashboard.runtime.runtimeStatus === "review_required" ? "attention" : "ok" },
    { id: "task-template", label: localizeCommanderText(locale, "任务", "task"), value: activeTaskTemplateLabel ?? localizeCommanderText(locale, "未选择", "unselected"), tone: activeTaskTemplateLabel ? "ok" : "attention" },
    { id: "round", label: localizeCommanderText(locale, "轮次", "round"), value: `rnd_${String(dashboard.mission.currentRoundIndex).padStart(3, "0")}`, tone: dashboard.mission.currentRoundIndex > 0 ? "attention" : "ok" },
    { id: "health", label: localizeCommanderText(locale, "健康", "health"), value: readyRatio, tone: totals?.blocking ? "attention" : "ok" },
    { id: "pending", label: localizeCommanderText(locale, "待处理", "pending"), value: pendingReviews === 0 ? localizeCommanderText(locale, "0 复核", "0 reviews") : localizeCommanderText(locale, `${pendingReviews} 个复核`, `${pendingReviews} reviews`), tone: pendingReviews > 0 ? "attention" : "ok" },
  ];
}

export function buildPreflightSummary(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
): CommanderConsolePreflightCheck[] {
  return [
    { id: "platform-binding", label: localizeCommanderText(locale, "平台绑定", "Platform binding"), status: dashboard.mission.requestedPlatform ? "ok" : "attention", detail: dashboard.mission.requestedPlatform ? localizeCommanderText(locale, `已指定 ${dashboard.mission.requestedPlatform}`, `Requested ${dashboard.mission.requestedPlatform}`) : localizeCommanderText(locale, "待启动时由已批准任务模板解析平台绑定。", "Platform binding will be resolved from the approved task template at launch time.") },
    { id: "map-selection", label: localizeCommanderText(locale, "地图选择", "Map selection"), status: dashboard.mission.selectedMapId ? "ok" : "attention", detail: dashboard.mission.selectedMapId ? localizeCommanderText(locale, "已绑定受治理任务程序", "Governed task program is bound.") : localizeCommanderText(locale, "待启动时由 active approved task template 解析运行地图。", "The active approved task template will resolve the runtime map at launch time.") },
    { id: "browser-login", label: localizeCommanderText(locale, "浏览器登录态", "Browser login"), status: dashboard.browser.loginState === "logged-in" ? "ok" : "attention", detail: localizeCommanderText(locale, `当前状态：${dashboard.browser.loginState}`, `Current state: ${dashboard.browser.loginState}`) },
    { id: "audit-freshness", label: localizeCommanderText(locale, "审计快照", "Audit snapshot"), status: dashboard.auditSummary.lastGeneratedAt ? "ok" : "attention", detail: dashboard.auditSummary.lastGeneratedAt ? localizeCommanderText(locale, `最近生成：${dashboard.auditSummary.lastGeneratedAt}`, `Last generated: ${dashboard.auditSummary.lastGeneratedAt}`) : localizeCommanderText(locale, "当前没有新鲜 audit 时间戳。", "No fresh audit generation timestamp is present.") },
  ];
}

export function buildFailureRadar(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
): CommanderConsoleFailureItem[] {
  const failures: CommanderConsoleFailureItem[] = [];

  if (dashboard.runtime.reviewReason) {
    failures.push({ id: "review-reason", label: localizeCommanderText(locale, "人工复核原因", "Review reason"), severity: "attention", detail: dashboard.runtime.reviewReason });
  }

  if (dashboard.runtime.lastAiFailureReason) {
    failures.push({ id: "ai-failure", label: localizeCommanderText(locale, "最近 AI 失败", "Latest AI failure"), severity: "blocked", detail: dashboard.runtime.lastAiFailureReason });
  }

  if (dashboard.runtime.runtimeStatus !== "idle" && (!dashboard.mission.requestedPlatform || !dashboard.mission.selectedMapId)) {
    failures.push({ id: "missing-start-binding", label: localizeCommanderText(locale, "启动草案缺字段", "Start draft missing fields"), severity: "blocked", detail: localizeCommanderText(locale, "运行中的任务缺少已解析绑定，这是非法状态。", "A running mission is missing its resolved binding, which is an invalid state.") });
  }

  if (failures.length === 0) {
    failures.push({ id: "clear", label: localizeCommanderText(locale, "当前无阻断项", "No blocking findings"), severity: "ok", detail: localizeCommanderText(locale, "当前没有从 snapshot 派生出的阻断信号。", "No blocking signal is derived from the current snapshot.") });
  }

  return failures;
}

export function buildReviewSummary(
  dashboard: CommanderMissionDashboardView,
): CommanderConsoleViewModel["reviewQueueSummary"] {
  return dashboard.candidates.reduce<CommanderConsoleViewModel["reviewQueueSummary"]>((summary, candidate) => {
    if (candidate.reviewStatus === "approved") {
      summary.approvedCount += 1;
    } else if (candidate.reviewStatus === "rejected") {
      summary.rejectedCount += 1;
    } else if (candidate.reviewStatus === "archived" || candidate.reviewStatus === "hold") {
      summary.archivedCount += 1;
    } else {
      summary.pendingCount += 1;
    }

    return summary;
  }, { pendingCount: 0, approvedCount: 0, rejectedCount: 0, archivedCount: 0 });
}