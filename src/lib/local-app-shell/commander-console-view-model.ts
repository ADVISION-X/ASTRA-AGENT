import type { CommanderMissionDashboardView } from "./commander-console-dashboard.types.js";
import type { AppRunLimitSettings, Locale } from "./types.js";

import { buildInspectItems } from "./view-model/inspect-items.js";
import { buildExportSummary, buildAppShellReadiness, buildRunLimits, buildSafetyLocks } from "./view-model/policy-sections.js";
import { buildPrimaryPages } from "./view-model/primary-pages.js";
import { buildCommandDraft, buildActiveMissionSummary, buildActiveRoundSummary, buildMissionSummary, buildStructuredLogPreview } from "./view-model/summary-sections.js";
import { buildBadges, buildFailureRadar, buildPreflightSummary, buildReviewSummary, buildTopMetrics } from "./view-model/status-sections.js";

import type {
  CommanderConsoleViewModel,
} from "./types.js";

function buildCommanderConsoleShellMeta(
  locale: Locale,
  appRunLimitSettings: AppRunLimitSettings,
) {
  return {
    locale,
    appTitle: "GrassEye Commander Console",
    appSubtitle: locale === "zh"
      ? "一级页面 + 二级 Tab + 三级 Inspect Drawer 的本地指挥控制台"
      : "A local command shell with primary pages, secondary tabs, and a right inspect drawer.",
    appRunLimitSettings,
    primaryPages: buildPrimaryPages(locale),
  };
}

export function buildCommanderConsoleViewModel(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
  appRunLimitSettings: AppRunLimitSettings,
  userRequirementHistory: CommanderConsoleViewModel["userRequirementHistory"],
): CommanderConsoleViewModel {
  const activePlatformLabel = dashboard.mission?.requestedPlatform ?? null;

  return {
    ...buildCommanderConsoleShellMeta(locale, appRunLimitSettings),
    missionSummary: buildMissionSummary(dashboard, locale),
    badges: buildBadges(dashboard, locale, activePlatformLabel),
    topMetrics: buildTopMetrics(dashboard, locale, activePlatformLabel),
    activeMissionSummary: buildActiveMissionSummary(dashboard, locale),
    activeRoundSummary: buildActiveRoundSummary(dashboard, locale),
    availableMaps: [],
    taskTemplates: [],
    preflightSummary: buildPreflightSummary(dashboard, locale),
    commandDraft: buildCommandDraft(dashboard, appRunLimitSettings),
    userRequirementHistory,
    capabilityHealth: dashboard.health,
    reviewQueueSummary: buildReviewSummary(dashboard),
    failureRadarSummary: buildFailureRadar(dashboard, locale),
    structuredLogPreview: buildStructuredLogPreview(dashboard),
    evidencePackets: dashboard.evidencePackets,
    browseRecord: dashboard.browseRecord,
    failedRecords: dashboard.failedRecords,
    runtimeProofTimeline: dashboard.runtimeProof ?? [],
    exportSummary: buildExportSummary(locale),
    safetyLocks: buildSafetyLocks(locale),
    runLimits: buildRunLimits(locale, appRunLimitSettings),
    appShellReadiness: buildAppShellReadiness(locale),
    inspectItems: buildInspectItems(dashboard, locale),
    rawSnapshot: dashboard,
  };
}