import type { CommanderMissionDashboardView } from "../../../capabilities/commander-console/shared/commander-view-types.js";
import type { Locale } from "../../../lib/localization/dictionaries.js";

import { localizeCommanderText } from "../locale.js";
import type { CommanderConsoleInspectItem, CommanderConsoleMapView } from "../types.js";

function buildMapInspectItems(locale: Locale, mapCatalog: CommanderConsoleMapView[]): CommanderConsoleInspectItem[] {
  return mapCatalog.map((map) => ({
    kind: "map",
    id: map.mapId,
    title: map.title,
    subtitle: localizeCommanderText(locale, "地图详情", "Map details"),
    summary: map.summary,
    owner: localizeCommanderText(locale, "编排层", "orchestration"),
    json: map,
    references: [
      { label: localizeCommanderText(locale, "地图包", "Package"), value: map.packageId },
      { label: localizeCommanderText(locale, "审批", "Approval"), value: map.approvalStatus },
    ],
  }));
}

function buildEvidenceInspectItems(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
): CommanderConsoleInspectItem[] {
  return dashboard.evidencePackets.map((record) => ({
    kind: "evidence",
    id: record.id,
    title: record.primary,
    subtitle: localizeCommanderText(locale, "证据详情", "Evidence details"),
    summary: record.detail,
    owner: localizeCommanderText(locale, "取证记账", "forensics"),
    json: record,
    references: [
      { label: localizeCommanderText(locale, "记录 ID", "Record ID"), value: record.id },
      { label: localizeCommanderText(locale, "副标题", "Secondary"), value: record.secondary },
    ],
  }));
}

function buildRoundInspectItems(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
): CommanderConsoleInspectItem[] {
  return dashboard.runtimeProof.map((entry, index) => ({
    kind: "round",
    id: `${entry.step}-${index}`,
    title: entry.step,
    subtitle: localizeCommanderText(locale, "轮次 / 证明详情", "Round / proof details"),
    summary: entry.message,
    owner: localizeCommanderText(locale, "运行证明", "runtime-proof"),
    json: entry,
    references: [
      { label: localizeCommanderText(locale, "时间", "Time"), value: entry.createdAt },
      { label: localizeCommanderText(locale, "状态", "Status"), value: entry.status },
    ],
  }));
}

function buildHealthInspectItems(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
): CommanderConsoleInspectItem[] {
  return dashboard.health.map((entry) => ({
    kind: "health",
    id: entry.id,
    title: entry.label,
    subtitle: localizeCommanderText(locale, "能力健康详情", "Capability health details"),
    summary: entry.detail,
    owner: localizeCommanderText(locale, "能力健康", "capability-health"),
    json: entry,
    references: [
      { label: localizeCommanderText(locale, "能力 ID", "Capability ID"), value: entry.id },
      { label: localizeCommanderText(locale, "色调", "Tone"), value: entry.tone },
    ],
  }));
}

export function buildInspectItems(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
  mapCatalog: CommanderConsoleMapView[],
): CommanderConsoleInspectItem[] {
  return [
    ...buildMapInspectItems(locale, mapCatalog),
    ...buildEvidenceInspectItems(dashboard, locale),
    ...buildRoundInspectItems(dashboard, locale),
    ...buildHealthInspectItems(dashboard, locale),
  ];
}