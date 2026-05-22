import { RuntimeLogEventType, type RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { FacebookNavigationSignature } from "./facebook-product-video-mining.navigation-scripts.js";

type FacebookMiningStatus = "started" | "success" | "failed" | "review_required" | "skipped";

const buildNavigationPreview = (signature?: FacebookNavigationSignature): string => {
  if (!signature) {
    return "";
  }
  return JSON.stringify({
    url: signature.url,
    videoCount: signature.videoCount,
    videoFacts: signature.videoFacts,
    metricTexts: signature.metricTexts,
    nextCandidates: signature.nextCandidates,
    dialogs: signature.activeDialogCount,
  });
};

const buildActionPreview = (action?: unknown): string => action ? JSON.stringify(action) : "";

export const logFacebookMiningFlow = (input: {
  logger: RuntimeLogger;
  eventType: typeof RuntimeLogEventType[keyof typeof RuntimeLogEventType];
  runId: string;
  missionId: string;
  roundId?: string;
  status: FacebookMiningStatus;
  reason?: string | null;
}): void => input.logger.emit({
  traceId: input.runId,
  ...(input.roundId ? { roundId: input.roundId } : {}),
  level: input.status === "failed" ? "error" : "info",
  modeVisibility: ["FLOW"],
  eventType: input.eventType,
  owner: "facebook-product-video-mining",
  missionId: input.missionId,
  runId: input.runId,
  status: input.status,
  ...(input.reason ? { reason: input.reason } : {}),
});

export const logFacebookNavigationDebug = (input: {
  logger: RuntimeLogger;
  runId: string;
  missionId: string;
  roundId?: string;
  status: FacebookMiningStatus;
  reason?: string | null;
  before?: FacebookNavigationSignature;
  after?: FacebookNavigationSignature;
  action?: unknown;
}): void => input.logger.emit({
  traceId: input.runId,
  ...(input.roundId ? { roundId: input.roundId } : {}),
  level: input.status === "failed" ? "error" : "debug",
  modeVisibility: ["DEBUG", "TRACE"],
  eventType: RuntimeLogEventType.DOM_AUTOMATION_STEP_COMPLETED,
  owner: "facebook-product-video-mining",
  missionId: input.missionId,
  runId: input.runId,
  status: input.status,
  ...(input.reason ? { reason: input.reason } : {}),
  preview: {
    before: buildNavigationPreview(input.before),
    after: buildNavigationPreview(input.after),
    action: buildActionPreview(input.action),
  },
});