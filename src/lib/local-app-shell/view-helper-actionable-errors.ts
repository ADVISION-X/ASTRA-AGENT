import { localizeCommanderText } from "./locale.js";
import type { CommanderConsoleViewModel } from "./types.js";

type ActionableErrorView = {
  id: string;
  tone: "ok" | "attention" | "blocked";
  title: string;
  whatHappened: string;
  why: string;
  nextAction: string;
  owner: string;
};

function createReviewRequiredError(viewModel: CommanderConsoleViewModel, reviewReason: string): ActionableErrorView {
  return {
    id: "review-required",
    tone: "attention",
    title: localizeCommanderText(viewModel.locale, "任务进入人工复核", "Task requires human review"),
    whatHappened: localizeCommanderText(viewModel.locale, "系统已经暂停自动推进，并把当前结果挂起等待你决定。", "The system stopped automatic progress and held the current result for your decision."),
    why: reviewReason,
    nextAction: localizeCommanderText(viewModel.locale, "打开复核队列，检查当前记录后选择批准、拒绝，或继续保持待复核。", "Open the review queue, inspect the current record, then approve, reject, or keep it pending."),
    owner: "Commander Console / Orchestration Review",
  };
}

function createAiFailureError(viewModel: CommanderConsoleViewModel, aiFailure: string): ActionableErrorView {
  return {
    id: "ai-failure",
    tone: "blocked",
    title: localizeCommanderText(viewModel.locale, "本地 AI 没有完成当前判断", "Local AI could not complete the current judgement"),
    whatHappened: localizeCommanderText(viewModel.locale, "系统在判断当前视频时被本地 AI 拒绝或中断。", "The system was rejected or interrupted by the local AI while judging the current video."),
    why: aiFailure,
    nextAction: localizeCommanderText(viewModel.locale, "停止任务，打开调试包，检查截图到 AI 输入链路是否完整，再重新开始。", "Stop the task, open the debug bundle, verify the screenshot-to-AI input chain, then restart."),
    owner: "AI / Screenshot / Orchestration Map Dependency",
  };
}

function createLocalAiReadinessError(viewModel: CommanderConsoleViewModel, detail: string): ActionableErrorView {
  return {
    id: "local-ai-readiness",
    tone: "blocked",
    title: localizeCommanderText(viewModel.locale, "本地 AI 当前不可用", "Local AI is currently unavailable"),
    whatHappened: localizeCommanderText(viewModel.locale, "控制台已经启动，但当前任务启动前预检会被本地 AI 阻断。", "The console is running, but mission preflight is currently blocked by Local AI readiness."),
    why: detail,
    nextAction: localizeCommanderText(viewModel.locale, "启动 Ollama 或修复本地模型配置，然后重新运行预检。", "Start Ollama or repair the local model configuration, then run preflight again."),
    owner: "AI Capability / Local AI Runtime",
  };
}

function createStartupReadinessError(viewModel: CommanderConsoleViewModel, detail: string, failureReason: string | null, missionRuntimeAvailable: boolean | undefined): ActionableErrorView {
  return {
    id: "startup-readiness",
    tone: missionRuntimeAvailable === false ? "blocked" : "attention",
    title: localizeCommanderText(viewModel.locale, "启动门禁状态异常", "Startup readiness gate is not healthy"),
    whatHappened: localizeCommanderText(viewModel.locale, "控制台当前读取到的启动门禁状态不满足可安全放行任务运行的条件。", "The console is reading a startup gate state that is not safe for mission runtime availability."),
    why: failureReason ? `${failureReason}; ${detail}` : detail,
    nextAction: localizeCommanderText(viewModel.locale, "使用显式 platform 重新执行 grasseye:start，确认 startup gate、平台目标和本地 AI readiness 都通过。", "Relaunch via grasseye:start with an explicit platform target and confirm the startup gate, platform target, and local AI readiness all pass."),
    owner: "Startup Entrypoint / Commander Console / AI Capability",
  };
}

function createMissionBindingError(input: {
  viewModel: CommanderConsoleViewModel;
  detail: string;
  tone: "attention" | "blocked";
  nextAction: string;
  owner: string;
}): ActionableErrorView {
  return {
    id: "mission-binding",
    tone: input.tone,
    title: localizeCommanderText(input.viewModel.locale, "当前没有可执行的地图绑定", "No governed launch binding is currently available"),
    whatHappened: localizeCommanderText(input.viewModel.locale, "启动链路当前无法从已批准任务模板解析出受治理地图绑定。", "The launch flow cannot currently resolve a governed map binding from the approved task-template feed."),
    why: input.detail,
    nextAction: input.nextAction,
    owner: input.owner,
  };
}

function createMissionFailureError(viewModel: CommanderConsoleViewModel, missionFailure: string): ActionableErrorView {
  return {
    id: "mission-failure",
    tone: "blocked",
    title: localizeCommanderText(viewModel.locale, "任务没有继续推进", "The mission stopped progressing"),
    whatHappened: localizeCommanderText(viewModel.locale, "任务已经离开正常推进状态。", "The mission has left its normal execution path."),
    why: missionFailure,
    nextAction: localizeCommanderText(viewModel.locale, "打开调试钻取查看最近关键事件，必要时急停后把调试包交给开发者。", "Open the debug drilldown for recent key events, then emergency stop and hand the debug bundle to a developer if needed."),
    owner: "Commander Console / Nerve Bus / Orchestration",
  };
}

function createClearActionableError(viewModel: CommanderConsoleViewModel): ActionableErrorView {
  return {
    id: "clear",
    tone: "ok",
    title: localizeCommanderText(viewModel.locale, "当前没有阻断问题", "No blocking issue right now"),
    whatHappened: localizeCommanderText(viewModel.locale, "主流程没有发现需要你立即接管的错误。", "The main flow has not surfaced an error that needs immediate takeover."),
    why: localizeCommanderText(viewModel.locale, "最近的运行证明没有暴露阻断信号。", "Recent runtime proof does not expose a blocking signal."),
    nextAction: localizeCommanderText(viewModel.locale, "继续观察当前步骤；若状态停住不变，打开调试钻取。", "Keep watching the current step; open the debug drilldown if the state stops changing."),
    owner: "Commander Console Read Model",
  };
}

function collectRuntimeErrors(viewModel: CommanderConsoleViewModel): ActionableErrorView[] {
  const items: ActionableErrorView[] = [];
  const reviewReason = viewModel.rawSnapshot.runtime.reviewReason ?? viewModel.rawSnapshot.mission.reviewRequiredReason;
  const aiFailure = viewModel.rawSnapshot.runtime.lastAiFailureReason;
  const missionFailure = viewModel.rawSnapshot.mission.failureReason;

  if (reviewReason) {
    items.push(createReviewRequiredError(viewModel, reviewReason));
  }
  if (aiFailure) {
    items.push(createAiFailureError(viewModel, aiFailure));
  }
  if (missionFailure) {
    items.push(createMissionFailureError(viewModel, missionFailure));
  }

  return items;
}

function collectHealthErrors(viewModel: CommanderConsoleViewModel, hasAiFailure: boolean): ActionableErrorView[] {
  const items: ActionableErrorView[] = [];
  const missionBindingHealth = viewModel.capabilityHealth.find((entry) => entry.id === "mission" && entry.tone !== "good");
  const localAiHealth = viewModel.capabilityHealth.find((entry) => entry.id === "localAi" && entry.tone === "danger");
  const startupReadinessHealth = viewModel.capabilityHealth.find((entry) => entry.id === "startup-readiness" && entry.tone !== "good");

  if (!hasAiFailure && localAiHealth) {
    items.push(createLocalAiReadinessError(viewModel, localAiHealth.detail));
  }
  if (startupReadinessHealth) {
    items.push(createStartupReadinessError(viewModel, startupReadinessHealth.detail, startupReadinessHealth.failureReason ?? null, startupReadinessHealth.missionRuntimeAvailable));
  }
  if (missionBindingHealth) {
    items.push(createMissionBindingError({
      viewModel,
      detail: missionBindingHealth.detail,
      tone: missionBindingHealth.tone === "warn" ? "attention" : "blocked",
      nextAction: missionBindingHealth.actionableMessage ?? localizeCommanderText(viewModel.locale, "先激活一个已批准任务模板，再重新开始任务。", "Activate an approved task template, then retry mission start."),
      owner: missionBindingHealth.ownerResponsible ?? "Commander Console / Orchestration",
    }));
  }

  return items;
}

function buildActionableErrors(viewModel: CommanderConsoleViewModel): ActionableErrorView[] {
  const runtimeErrors = collectRuntimeErrors(viewModel);
  const items = runtimeErrors.concat(collectHealthErrors(viewModel, runtimeErrors.some((item) => item.id === "ai-failure")));
  return items.length > 0 ? items : [createClearActionableError(viewModel)];
}

export { buildActionableErrors };
export type { ActionableErrorView };