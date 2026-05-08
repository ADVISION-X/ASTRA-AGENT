import type { CommanderMissionDashboardView } from "../../capabilities/commander-console/shared/commander-view-types.js";
import type { AppRunLimitSettings } from "../local-runtime/app-run-limit-settings-types.js";
import type { Locale } from "../localization/dictionaries.js";

import { buildCommanderTaskTemplates } from "./task-template-registry.js";
import { buildInspectItems } from "./view-model/inspect-items.js";
import { buildMapCatalog } from "./view-model/map-catalog.js";
import { buildExportSummary, buildAppShellReadiness, buildRunLimits, buildSafetyLocks } from "./view-model/policy-sections.js";
import { buildPrimaryPages } from "./view-model/primary-pages.js";
import { buildCommandDraft, buildActiveMissionSummary, buildActiveRoundSummary, buildMissionSummary, buildStructuredLogPreview } from "./view-model/summary-sections.js";
import { buildBadges, buildFailureRadar, buildPreflightSummary, buildReviewSummary, buildTopMetrics } from "./view-model/status-sections.js";
import { selectActiveTaskTemplate } from "./view-model/task-template-selection.js";

import type {
  CommanderConsoleViewModel,
} from "./types.js";

export function buildCommanderConsoleViewModel(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
  appRunLimitSettings: AppRunLimitSettings,
): CommanderConsoleViewModel {
  const primaryPages = buildPrimaryPages(locale);
  const mapCatalog = buildMapCatalog(locale);
  const taskTemplates = buildCommanderTaskTemplates(locale);
  const activeTaskTemplate = selectActiveTaskTemplate(taskTemplates, dashboard);

  return {
    locale,
    appTitle: locale === "zh" ? "GrassEye Commander Console" : "GrassEye Commander Console",
    appSubtitle: locale === "zh" ? "一级页面 + 二级 Tab + 三级 Inspect Drawer 的本地指挥控制台" : "A local command shell with primary pages, secondary tabs, and a right inspect drawer.",
    appRunLimitSettings,
    missionSummary: buildMissionSummary(dashboard, locale),
    badges: buildBadges(dashboard, locale, activeTaskTemplate?.displayName ?? null),
    topMetrics: buildTopMetrics(dashboard, locale, activeTaskTemplate?.displayName ?? null),
    primaryPages,
    activeMissionSummary: buildActiveMissionSummary(dashboard, locale, activeTaskTemplate),
    activeRoundSummary: buildActiveRoundSummary(dashboard, locale),
    availableMaps: mapCatalog,
    taskTemplates,
    preflightSummary: buildPreflightSummary(dashboard, locale),
    commandDraft: buildCommandDraft(dashboard, activeTaskTemplate, appRunLimitSettings),
    capabilityHealth: dashboard.health,
    reviewQueueSummary: buildReviewSummary(dashboard),
    failureRadarSummary: buildFailureRadar(dashboard, locale),
    structuredLogPreview: buildStructuredLogPreview(dashboard),
    evidencePackets: dashboard.evidencePackets,
    browseLedger: dashboard.browseLedger,
    failedRecords: dashboard.failedRecords,
    runtimeProofTimeline: dashboard.runtimeProof,
    exportSummary: buildExportSummary(locale),
    safetyLocks: buildSafetyLocks(locale),
    runLimits: buildRunLimits(locale, appRunLimitSettings),
    appShellReadiness: buildAppShellReadiness(locale),
    inspectItems: buildInspectItems(dashboard, locale, mapCatalog),
    rawSnapshot: dashboard,
  };
}