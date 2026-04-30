import type { CommanderMissionDashboardView } from "../../../capabilities/commander-console/shared/commander-view-types.js";

import type { CommanderConsoleTaskTemplate } from "../types.js";

function matchesSelectedBinding(template: CommanderConsoleTaskTemplate, dashboard: CommanderMissionDashboardView): boolean {
  return template.developerBinding?.mapId === (dashboard.mission.selectedMapId ?? null)
    && template.developerBinding?.requestedPlatformId === (dashboard.mission.requestedPlatform ?? null);
}

export function selectActiveTaskTemplate(
  taskTemplates: CommanderConsoleTaskTemplate[],
  dashboard: CommanderMissionDashboardView,
): CommanderConsoleTaskTemplate | null {
  return taskTemplates.find((template) => template.availability === "ready" && matchesSelectedBinding(template, dashboard))
    ?? taskTemplates.find((template) => template.availability === "ready")
    ?? null;
}