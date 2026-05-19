import type { CommanderConsoleTaskTemplate, CommanderConsoleViewModel } from "./types.js";
import { localizeCommanderText } from "./locale.js";

const RUNTIME_STATE_LABELS = {
  idle: ["未启动", "Not Started"],
  running: ["运行中", "Running"],
  paused: ["暂停", "Paused"],
  review_required: ["复核中", "In Review"],
  failed: ["出错", "Error"],
  completed: ["已完成", "Completed"],
} as const;

const HUMAN_STEP_RULES = [
  { keywords: ["capture", "screenshot"], label: ["正在截取当前视频画面", "Capturing the current video frame"] },
  { keywords: ["prepare", "compress", "input"], label: ["正在整理图片给本地 AI", "Preparing the image for local AI"] },
  { keywords: ["ask", "ai", "judge"], label: ["正在询问本地 AI", "Asking the local AI"] },
  { keywords: ["write", "ledger", "evidence", "persist"], label: ["正在保存证据", "Saving evidence"] },
  { keywords: ["browse", "open", "feed"], label: ["正在浏览 TikTok", "Browsing TikTok"] },
] as const;

function safeDate(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getActiveTaskTemplate(viewModel: CommanderConsoleViewModel): CommanderConsoleTaskTemplate | null {
  return viewModel.taskTemplates.find((template) => template.availability === "ready")
    ?? null;
}

function getRuntimeTone(viewModel: CommanderConsoleViewModel): "ok" | "attention" | "blocked" {
  const runtimeStatus = viewModel.rawSnapshot.runtime.runtimeStatus;
  if (runtimeStatus === "failed") {
    return "blocked";
  }
  if (runtimeStatus === "review_required" || runtimeStatus === "paused") {
    return "attention";
  }
  return "ok";
}

function canStopMission(viewModel: CommanderConsoleViewModel): boolean {
  const runtimeStatus = viewModel.rawSnapshot.runtime.runtimeStatus;
  return runtimeStatus === "running" || runtimeStatus === "paused" || runtimeStatus === "review_required";
}

function canEmergencyStopMission(viewModel: CommanderConsoleViewModel): boolean {
  return Boolean(viewModel.rawSnapshot.mission?.missionId) && canStopMission(viewModel);
}

function formatRuntimeState(viewModel: CommanderConsoleViewModel): string {
  const runtimeStatus = viewModel.rawSnapshot.runtime.runtimeStatus;
  const labels = RUNTIME_STATE_LABELS[runtimeStatus as keyof typeof RUNTIME_STATE_LABELS];
  return labels ? localizeCommanderText(viewModel.locale, labels[0], labels[1]) : runtimeStatus;
}

function formatElapsed(viewModel: CommanderConsoleViewModel): string {
  const mission = viewModel.rawSnapshot.mission;
  const startedAt = safeDate(mission?.startedAt ?? null);
  const endedAt = safeDate(mission?.endedAt ?? mission?.updatedAt ?? null);
  if (!startedAt) {
    return localizeCommanderText(viewModel.locale, "尚未开始", "Not started yet");
  }

  const durationMs = Math.max((endedAt ?? Date.now()) - startedAt, 0);
  const totalMinutes = Math.floor(durationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return localizeCommanderText(viewModel.locale, `${hours} 小时 ${minutes} 分钟`, `${hours}h ${minutes}m`);
  }

  return localizeCommanderText(viewModel.locale, `${minutes} 分钟`, `${minutes}m`);
}

function buildHumanStepLabel(viewModel: CommanderConsoleViewModel): string {
  const runtimeStatus = viewModel.rawSnapshot.runtime.runtimeStatus;
  const currentStep = (viewModel.rawSnapshot.runtime.currentStep ?? "").toLowerCase();
  const latestMessage = viewModel.runtimeProofTimeline[0]?.message ?? "";

  if (runtimeStatus === "review_required") {
    return localizeCommanderText(viewModel.locale, "等待你复核", "Waiting for your review");
  }
  if (runtimeStatus === "idle") {
    return localizeCommanderText(viewModel.locale, "等待你启动任务", "Waiting for you to start a task");
  }
  const rule = HUMAN_STEP_RULES.find((candidate) => candidate.keywords.some((keyword) => currentStep.includes(keyword)));
  if (rule) {
    return localizeCommanderText(viewModel.locale, rule.label[0], rule.label[1]);
  }
  if (latestMessage.trim().length > 0) {
    return latestMessage;
  }
  return localizeCommanderText(viewModel.locale, "正在执行当前步骤", "Executing the current step");
}

function buildHumanStepDetail(viewModel: CommanderConsoleViewModel): string {
  const reason = viewModel.rawSnapshot.runtime.reviewReason
    ?? viewModel.rawSnapshot.runtime.lastAiFailureReason
    ?? viewModel.rawSnapshot.mission?.failureReason
    ?? viewModel.runtimeProofTimeline[0]?.message
    ?? "";

  if (reason.trim().length > 0) {
    return reason;
  }

  return localizeCommanderText(viewModel.locale, "系统会持续把关键动作写入运行证明与取证记录。", "The system keeps writing key actions into runtime proof and forensics records.");
}

function formatHealthStatus(viewModel: CommanderConsoleViewModel): string {
  const hasDanger = viewModel.capabilityHealth.some((entry) => entry.tone === "danger");
  const hasWarn = viewModel.capabilityHealth.some((entry) => entry.tone === "warn");
  if (hasDanger) {
    return localizeCommanderText(viewModel.locale, "有阻断风险", "Blocking risk detected");
  }
  if (hasWarn) {
    return localizeCommanderText(viewModel.locale, "有注意项", "Attention needed");
  }
  return localizeCommanderText(viewModel.locale, "运行健康", "Healthy");
}
export { getActiveTaskTemplate, getRuntimeTone, canStopMission, canEmergencyStopMission, formatRuntimeState, formatElapsed, buildHumanStepLabel, buildHumanStepDetail };
