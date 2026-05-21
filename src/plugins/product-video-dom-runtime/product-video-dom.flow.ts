import type { BrowserController } from "../../lib/browser/browser-controller.js";
import { runProductVideoDomRoundRuntime } from "./product-video-dom-round.js";
import type { ProductVideoDomMissionInput, ProductVideoDomTaskRecord } from "./product-video-dom.schema.js";
import {
  buildReceivedProductVideoTaskRecord,
  createProductVideoDomTaskId,
  saveProductVideoTaskRecord,
  updateProductVideoTaskRecord,
} from "./product-video-task-storage.js";

type ProductVideoFlowResult = Pick<ProductVideoDomTaskRecord, "status" | "ok" | "reason" | "reachedStep" | "evidenceRefs" | "evidencePacketPath">;
type ProductVideoFlowInput = {
  browser: BrowserController;
  dataDir: string;
  taskId: string;
  mission: ProductVideoDomMissionInput;
};

const mapRoundRuntimeResult = (
  result: Awaited<ReturnType<typeof runProductVideoDomRoundRuntime>>,
): ProductVideoFlowResult => {
  if (result.roundResult.status === "review_required") {
    return {
      status: "review_required",
      ok: false,
      reason: result.roundResult.reason,
      reachedStep: "review_required",
      evidencePacketPath: result.savedRecord?.rawDomEvidenceRef ?? undefined,
      evidenceRefs: result.savedRecord?.evidenceRefs ?? [],
    };
  }
  if (result.roundResult.status === "stop") {
    return {
      status: "failed",
      ok: false,
      reason: result.roundResult.reason,
      reachedStep: "stopped",
      evidencePacketPath: result.savedRecord?.rawDomEvidenceRef ?? undefined,
      evidenceRefs: result.savedRecord?.evidenceRefs ?? [],
    };
  }
  return {
    status: "advanced_to_next_video",
    ok: true,
    reason: result.roundResult.reason,
    reachedStep: result.savedRecord ? "record_saved" : "advanced_to_next_video",
    evidencePacketPath: result.savedRecord?.rawDomEvidenceRef ?? undefined,
    evidenceRefs: result.savedRecord?.evidenceRefs ?? [],
  };
};

export const runProductVideoDomMining = async (input: ProductVideoFlowInput): Promise<ProductVideoFlowResult> => {
  const missionOverride = input.mission.aiDecision
    ? {
        aiDecision: input.mission.aiDecision,
        ...(input.mission.aiDecisionReason ? { aiDecisionReason: input.mission.aiDecisionReason } : {}),
      }
    : null;
  return mapRoundRuntimeResult(await runProductVideoDomRoundRuntime({
    browser: input.browser,
    dataDir: input.dataDir,
    missionId: input.taskId,
    runId: input.taskId,
    roundId: input.taskId,
    roundIndex: 0,
    platformId: input.mission.platformId,
    productVideoPageUrl: input.mission.pageUrl,
    userRequirementText: input.mission.aiDecisionReason ?? "Find product-seeding videos.",
    consecutiveAdvanceFailures: 0,
    ...(missionOverride ? { missionOverride } : {}),
  }));
};

export const startProductVideoDomTask = async (input: {
  browser: BrowserController;
  dataDir: string;
  mission: ProductVideoDomMissionInput;
}): Promise<ProductVideoDomTaskRecord> => {
  const taskId = createProductVideoDomTaskId();
  const received = buildReceivedProductVideoTaskRecord({ taskId, mission: input.mission });
  saveProductVideoTaskRecord(input.dataDir, received);
  const running = updateProductVideoTaskRecord(received, {
    status: "running",
    ok: false,
    reason: "Product video DOM mining started.",
    reachedStep: "running",
  });
  saveProductVideoTaskRecord(input.dataDir, running);
  const result = await runProductVideoDomMining({ ...input, taskId });
  const completed = updateProductVideoTaskRecord(running, result);
  saveProductVideoTaskRecord(input.dataDir, completed);
  return completed;
};
