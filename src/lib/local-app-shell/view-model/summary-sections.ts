import type { CommanderMissionDashboardView } from "../../../capabilities/commander-console/shared/commander-view-types.js";
import type { Locale } from "../../localization/dictionaries.js";

import { localizeCommanderText } from "../locale.js";
import type { CommanderConsoleTaskTemplate, CommanderConsoleViewModel } from "../types.js";

export function buildMissionSummary(dashboard: CommanderMissionDashboardView, locale: Locale): string {
  if (!dashboard.mission.missionId) {
    return localizeCommanderText(locale, "当前无活动任务。先选择任务模板并设定运行限制，再开始执行。", "No active mission. Choose a task template and run limits before starting execution.");
  }

  return localizeCommanderText(locale, `任务 ${dashboard.mission.missionId} 正在 ${dashboard.mission.status}，当前目标：${dashboard.mission.humanGoal || "未填写"}。`, `Mission ${dashboard.mission.missionId} is ${dashboard.mission.status} with goal ${dashboard.mission.humanGoal || "unspecified"}.`);
}

export function buildActiveMissionSummary(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
  activeTaskTemplate: CommanderConsoleTaskTemplate | null,
): CommanderConsoleViewModel["activeMissionSummary"] {
  return [
    { label: localizeCommanderText(locale, "任务 ID", "Mission ID"), value: dashboard.mission.missionId ?? localizeCommanderText(locale, "待命", "standby"), tone: dashboard.mission.missionId ? "ok" : "attention" },
    { label: localizeCommanderText(locale, "状态", "Status"), value: dashboard.mission.status },
    { label: localizeCommanderText(locale, "平台", "Platform"), value: dashboard.mission.requestedPlatform ?? localizeCommanderText(locale, "未指派", "unassigned"), tone: dashboard.mission.requestedPlatform ? "ok" : "attention" },
    { label: localizeCommanderText(locale, "任务模板", "Task Template"), value: activeTaskTemplate?.displayName ?? localizeCommanderText(locale, "未选择", "unselected"), tone: activeTaskTemplate ? "ok" : "attention" },
    { label: localizeCommanderText(locale, "目标", "Goal"), value: dashboard.mission.humanGoal || localizeCommanderText(locale, "未填写", "unspecified") },
  ];
}

export function buildActiveRoundSummary(
  dashboard: CommanderMissionDashboardView,
  locale: Locale,
): CommanderConsoleViewModel["activeRoundSummary"] {
  return [
    { label: localizeCommanderText(locale, "轮次", "Round index"), value: String(dashboard.mission.currentRoundIndex) },
    { label: localizeCommanderText(locale, "当前步骤", "Current step"), value: dashboard.runtime.currentStep ?? localizeCommanderText(locale, "空闲", "idle") },
    { label: localizeCommanderText(locale, "累计浏览", "Total seen"), value: String(dashboard.runtime.totalSeenCount) },
    { label: localizeCommanderText(locale, "候选数", "Candidate count"), value: String(dashboard.runtime.candidateCount) },
    { label: localizeCommanderText(locale, "最后人类命令", "Last human command"), value: dashboard.mission.lastHumanCommand ?? localizeCommanderText(locale, "无", "none") },
  ];
}

export function buildCommandDraft(
  dashboard: CommanderMissionDashboardView,
  activeTaskTemplate: CommanderConsoleTaskTemplate | null,
): CommanderConsoleViewModel["commandDraft"] {
  return {
    commandType: "start-mission",
    commandSource: "commander-console:start-form-submit",
    taskTemplateId: activeTaskTemplate?.taskTemplateId ?? null,
    humanGoal: activeTaskTemplate?.defaultHumanGoal ?? (dashboard.mission.humanGoal || ""),
    maxRounds: activeTaskTemplate?.defaultRunLimit.maxRounds ?? 3,
    maxMinutes: activeTaskTemplate?.defaultRunLimit.maxMinutes ?? 20,
  };
}

export function buildStructuredLogPreview(
  dashboard: CommanderMissionDashboardView,
): CommanderConsoleViewModel["structuredLogPreview"] {
  return dashboard.runtimeProof.slice(0, 8).map((entry, index) => ({
    id: `${entry.step}-${index}`,
    createdAt: entry.createdAt,
    step: entry.step,
    status: entry.status,
    message: entry.message,
  }));
}
