import type { CommanderConsoleTaskTemplate, CommanderConsoleViewModel } from "./types.js";
import { localizeCommanderText } from "./locale.js";

function safeDate(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getActiveTaskTemplate(viewModel: CommanderConsoleViewModel): CommanderConsoleTaskTemplate | null {
  return viewModel.taskTemplates.find((template) => template.availability === "ready"
    && template.developerBinding?.mapId === (viewModel.rawSnapshot.mission.selectedMapId ?? null)
    && template.developerBinding?.requestedPlatformId === (viewModel.rawSnapshot.mission.requestedPlatform ?? null))
    ?? viewModel.taskTemplates.find((template) => template.taskTemplateId === viewModel.commandDraft.taskTemplateId)
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

function canPauseMission(viewModel: CommanderConsoleViewModel): boolean {
  return viewModel.rawSnapshot.runtime.runtimeStatus === "running";
}

function canResumeMission(viewModel: CommanderConsoleViewModel): boolean {
  return viewModel.rawSnapshot.runtime.runtimeStatus === "paused";
}

function canStopMission(viewModel: CommanderConsoleViewModel): boolean {
  const runtimeStatus = viewModel.rawSnapshot.runtime.runtimeStatus;
  return runtimeStatus === "running" || runtimeStatus === "paused" || runtimeStatus === "review_required";
}

function canEmergencyStopMission(viewModel: CommanderConsoleViewModel): boolean {
  return Boolean(viewModel.rawSnapshot.mission.missionId) && canStopMission(viewModel);
}

function canRequestCandidateExport(_viewModel: CommanderConsoleViewModel): boolean {
  return false;
}

function formatRuntimeState(viewModel: CommanderConsoleViewModel): string {
  const runtimeStatus = viewModel.rawSnapshot.runtime.runtimeStatus;
  if (runtimeStatus === "idle") {
    return localizeCommanderText(viewModel.locale, "未启动", "Not Started");
  }
  if (runtimeStatus === "running") {
    return localizeCommanderText(viewModel.locale, "运行中", "Running");
  }
  if (runtimeStatus === "paused") {
    return localizeCommanderText(viewModel.locale, "暂停", "Paused");
  }
  if (runtimeStatus === "review_required") {
    return localizeCommanderText(viewModel.locale, "复核中", "In Review");
  }
  if (runtimeStatus === "failed") {
    return localizeCommanderText(viewModel.locale, "出错", "Error");
  }
  if (runtimeStatus === "completed") {
    return localizeCommanderText(viewModel.locale, "已完成", "Completed");
  }
  return runtimeStatus;
}

function formatElapsed(viewModel: CommanderConsoleViewModel): string {
  const mission = viewModel.rawSnapshot.mission;
  const startedAt = safeDate(mission.startedAt);
  const endedAt = safeDate(mission.endedAt ?? mission.updatedAt);
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
  if (currentStep.includes("capture") || currentStep.includes("screenshot")) {
    return localizeCommanderText(viewModel.locale, "正在截取当前视频画面", "Capturing the current video frame");
  }
  if (currentStep.includes("prepare") || currentStep.includes("compress") || currentStep.includes("input")) {
    return localizeCommanderText(viewModel.locale, "正在整理图片给本地 AI", "Preparing the image for local AI");
  }
  if (currentStep.includes("ask") || currentStep.includes("ai") || currentStep.includes("judge")) {
    return localizeCommanderText(viewModel.locale, "正在询问本地 AI", "Asking the local AI");
  }
  if (currentStep.includes("write") || currentStep.includes("ledger") || currentStep.includes("evidence") || currentStep.includes("persist")) {
    return localizeCommanderText(viewModel.locale, "正在保存证据", "Saving evidence");
  }
  if (currentStep.includes("browse") || currentStep.includes("open") || currentStep.includes("feed")) {
    return localizeCommanderText(viewModel.locale, "正在浏览 TikTok", "Browsing TikTok");
  }
  if (latestMessage.trim().length > 0) {
    return latestMessage;
  }
  return localizeCommanderText(viewModel.locale, "正在执行当前步骤", "Executing the current step");
}

function buildHumanStepDetail(viewModel: CommanderConsoleViewModel): string {
  const reason = viewModel.rawSnapshot.runtime.reviewReason
    ?? viewModel.rawSnapshot.runtime.lastAiFailureReason
    ?? viewModel.rawSnapshot.mission.failureReason
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

type ActionableErrorView = {
  id: string;
  tone: "ok" | "attention" | "blocked";
  title: string;
  whatHappened: string;
  why: string;
  nextAction: string;
  owner: string;
};

function buildActionableErrors(viewModel: CommanderConsoleViewModel): ActionableErrorView[] {
  const locale = viewModel.locale;
  const items: ActionableErrorView[] = [];
  const reviewReason = viewModel.rawSnapshot.runtime.reviewReason ?? viewModel.rawSnapshot.mission.reviewRequiredReason;
  const aiFailure = viewModel.rawSnapshot.runtime.lastAiFailureReason;
  const missionFailure = viewModel.rawSnapshot.mission.failureReason;
  const missionBindingHealth = viewModel.capabilityHealth.find((entry) => entry.id === "mission" && entry.tone !== "good");
  const localAiHealth = viewModel.capabilityHealth.find((entry) => entry.id === "localAi" && entry.tone === "danger");

  if (reviewReason) {
    items.push({
      id: "review-required",
      tone: "attention",
      title: localizeCommanderText(locale, "任务进入人工复核", "Task requires human review"),
      whatHappened: localizeCommanderText(locale, "系统已经暂停自动推进，并把当前结果挂起等待你决定。", "The system stopped automatic progress and held the current result for your decision."),
      why: reviewReason,
      nextAction: localizeCommanderText(locale, "打开复核队列，检查当前记录后选择批准、拒绝，或继续保持待复核。", "Open the review queue, inspect the current record, then approve, reject, or keep it pending."),
      owner: "Commander Console / Orchestration Review",
    });
  }

  if (aiFailure) {
    items.push({
      id: "ai-failure",
      tone: "blocked",
      title: localizeCommanderText(locale, "本地 AI 没有完成当前判断", "Local AI could not complete the current judgement"),
      whatHappened: localizeCommanderText(locale, "系统在判断当前视频时被本地 AI 拒绝或中断。", "The system was rejected or interrupted by the local AI while judging the current video."),
      why: aiFailure,
      nextAction: localizeCommanderText(locale, "停止任务，打开调试包，检查截图到 AI 输入链路是否完整，再重新开始。", "Stop the task, open the debug bundle, verify the screenshot-to-AI input chain, then restart."),
      owner: "AI / Screenshot / Orchestration Map Dependency",
    });
  }

  if (!aiFailure && localAiHealth) {
    items.push({
      id: "local-ai-readiness",
      tone: "blocked",
      title: localizeCommanderText(locale, "本地 AI 当前不可用", "Local AI is currently unavailable"),
      whatHappened: localizeCommanderText(locale, "控制台已经启动，但当前任务启动前预检会被本地 AI 阻断。", "The console is running, but mission preflight is currently blocked by Local AI readiness."),
      why: localAiHealth.detail,
      nextAction: localizeCommanderText(locale, "启动 Ollama 或修复本地模型配置，然后重新运行预检。", "Start Ollama or repair the local model configuration, then run preflight again."),
      owner: "AI Capability / Local AI Runtime",
    });
  }

  if (missionBindingHealth) {
    items.push({
      id: "mission-binding",
      tone: missionBindingHealth.tone === "warn" ? "attention" : "blocked",
      title: localizeCommanderText(locale, "当前没有可执行的地图绑定", "No governed launch binding is currently available"),
      whatHappened: localizeCommanderText(locale, "启动链路当前无法从已批准任务模板解析出受治理地图绑定。", "The launch flow cannot currently resolve a governed map binding from the approved task-template feed."),
      why: missionBindingHealth.detail,
      nextAction: missionBindingHealth.actionableMessage
        ?? localizeCommanderText(locale, "先激活一个已批准任务模板，再重新开始任务。", "Activate an approved task template, then retry mission start."),
      owner: missionBindingHealth.ownerResponsible ?? "Commander Console / Orchestration",
    });
  }

  if (missionFailure) {
    items.push({
      id: "mission-failure",
      tone: "blocked",
      title: localizeCommanderText(locale, "任务没有继续推进", "The mission stopped progressing"),
      whatHappened: localizeCommanderText(locale, "任务已经离开正常推进状态。", "The mission has left its normal execution path."),
      why: missionFailure,
      nextAction: localizeCommanderText(locale, "打开调试钻取查看最近关键事件，必要时急停后把调试包交给开发者。", "Open the debug drilldown for recent key events, then emergency stop and hand the debug bundle to a developer if needed."),
      owner: "Commander Console / Nerve Bus / Orchestration",
    });
  }

  if (items.length === 0) {
    items.push({
      id: "clear",
      tone: "ok",
      title: localizeCommanderText(locale, "当前没有阻断问题", "No blocking issue right now"),
      whatHappened: localizeCommanderText(locale, "主流程没有发现需要你立即接管的错误。", "The main flow has not surfaced an error that needs immediate takeover."),
      why: localizeCommanderText(locale, "最近的运行证明没有暴露阻断信号。", "Recent runtime proof does not expose a blocking signal."),
      nextAction: localizeCommanderText(locale, "继续观察当前步骤；若状态停住不变，打开调试钻取。", "Keep watching the current step; open the debug drilldown if the state stops changing."),
      owner: "Commander Console Read Model",
    });
  }

  return items;
}

export { getActiveTaskTemplate, getRuntimeTone, canPauseMission, canResumeMission, canStopMission, canEmergencyStopMission, canRequestCandidateExport, formatRuntimeState, formatElapsed, buildHumanStepLabel, buildHumanStepDetail, formatHealthStatus, buildActionableErrors };
export type { ActionableErrorView };
