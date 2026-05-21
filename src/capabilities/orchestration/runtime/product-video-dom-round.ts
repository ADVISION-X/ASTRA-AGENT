import type { OrchestrationChildrenContext } from "../children-context.js";
import type { MissionState } from "../contract.js";
import { startProductVideoDomTask } from "../../../plugins/product-video-dom-runtime/index.js";
import { applyMissionStatus, getMissionState, setActiveMission, upsertMissionState } from "./mission-state.js";
import type { RoundResult } from "./mission-loop-round.js";

type ProductVideoDomRoundInput = {
  missionId: string;
  runId: string;
  roundId: string;
  state: MissionState;
  ctx: OrchestrationChildrenContext;
};

const PRODUCT_VIDEO_HINTS = {
  likeButton: ["like", "like video", "赞", "点赞"],
  commentsButton: ["comments", "comment", "评论", "留言"],
  nextVideoButton: ["next", "next video", "下一个", "下一条"],
};

const failDomRound = (missionId: string, failureReason: string): RoundResult => {
  upsertMissionState(applyMissionStatus(getMissionState(missionId), { status: "failed", failureReason }));
  setActiveMission(null);
  return "stop";
};

const reviewDomRound = (missionId: string, reason: string): RoundResult => {
  upsertMissionState(applyMissionStatus(getMissionState(missionId), {
    status: "review_required",
    reviewRequiredReason: reason,
  }));
  setActiveMission(null);
  return "stop";
};

const emitDomRoundStarted = (input: ProductVideoDomRoundInput): void => {
  input.ctx.runtimeLogger.emit({
    traceId: input.missionId,
    level: "info",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    eventType: "ROUND_STARTED",
    owner: "orchestration",
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    status: "started",
    reason: `DOM product-video round ${input.state.roundIndex ?? 0} started`,
  });
};

export const runProductVideoDomRound = async (
  input: ProductVideoDomRoundInput,
): Promise<RoundResult> => {
  emitDomRoundStarted(input);
  if (!input.state.targetUrl) return failDomRound(input.missionId, "DOM product-video mode requires targetUrl.");
  const task = await startProductVideoDomTask({
    browser: input.ctx.browserController,
    dataDir: input.ctx.dataDir,
    mission: {
      missionType: "product_video_dom_mining",
      platformId: input.state.requestedPlatform ?? "unknown",
      pageUrl: input.state.targetUrl,
      videoVisitId: input.roundId,
      aiDecisionReason: input.state.humanGoal ?? "Find product-seeding videos.",
      targetHints: PRODUCT_VIDEO_HINTS,
    },
  });
  if (task.status === "login_required" || task.status === "captcha_or_2fa_required" || task.status === "review_required") {
    return reviewDomRound(input.missionId, task.reason);
  }
  if (!task.ok) return failDomRound(input.missionId, task.reason);
  return "continue";
};
