import { createId } from "../../lib/local-runtime/ids.js";
import type { LocalAiGateway } from "../../lib/local-ai/local-ai-gateway.js";
import type { EvidenceStoreService } from "../local-data/evidence-store-service.js";
import type { PlatformAdapter } from "../platform-action/platform-adapter.js";
import { AgentRoundSchema, type AgentRound, type RuntimeStatus, type TaskRun } from "../../types/task-run.js";
import { ActionLogSchema, PlatformActionRequestSchema, type ActionLog, type PlatformActionRequest, type PlatformActionResult } from "../../types/platform-action.js";
import {
  type CommentSignalPayload,
  type LocalAiTaskResult,
  type OcrCleanupPayload,
  type ProductSignalPayload,
  type VisionClassificationPayload,
} from "../../types/local-ai.js";
import { ProductOpportunityCandidateSchema, type ProductOpportunityCandidate } from "../../types/product-opportunity.js";
import { OcrTextResultSchema, type EvidenceRef } from "../../types/evidence.js";
import type { RoundLifecycleEventStatus, RoundLifecycleStep } from "../../types/evidence-packet.js";
import type { RuntimeDeliveryState, RuntimeRoundStep } from "../../types/runtime.js";
import { StructuredActionLogSchema, StructuredRuntimeEventSchema } from "../../types/structured-log.js";
import { deriveActionPurpose, derivePlatformActionStep, deriveRoundStepActionPurpose } from "./agent-action-purpose.js";
import { resolveProductPresenceDecision } from "./agent-browse-decision-flow.js";
import { finalizeRoundArtifacts } from "./agent-round-finalizer.js";
import { createRoundLifecycleEvent } from "./agent-round-lifecycle-event.js";

const toStructuredRuntimeEventType = (step: RoundLifecycleStep, status: RoundLifecycleEventStatus): string => {
  if (step === "task_start") {
    return "task_started";
  }
  if (step === "single_video_round_start") {
    return "single_video_round_started";
  }
  if (step === "review_required") {
    return "review_required";
  }
  if (step === "stop") {
    return "task_stopped";
  }
  if (step === "branch") {
    return "branch_decision_completed";
  }
  if (step === "record_video_evidence") {
    return "record_video_evidence_completed";
  }
  if (step === "scroll_next_video" && status === "entered") {
    return "scroll_next_video_started";
  }
  if (step === "wait_video_stable" && status === "entered") {
    return "next_video_wait_started";
  }
  return `${step}_${status === "entered" ? "started" : status}`;
};

const toStructuredRuntimeStatus = (step: RoundLifecycleStep, status: RoundLifecycleEventStatus): "started" | "success" | "failed" | "skipped" | "review_required" => {
  if (status === "entered") {
    return "started";
  }
  if (step === "review_required" || step === "finalize_failed_or_review_record") {
    return "review_required";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "skipped") {
    return "skipped";
  }
  return "success";
};

type AgentControlState = {
  pauseRequested: boolean;
  stopRequested: boolean;
  runningTaskId: string | null;
};

export class AgentService {
  private controlState: AgentControlState = {
    pauseRequested: false,
    stopRequested: false,
    runningTaskId: null
  };

  private currentTask: TaskRun | null = null;
  private deliveryState: RuntimeDeliveryState = {
    currentRoundStep: "idle",
    currentUrl: "about:blank",
    targetUrl: null,
    pageReadyStatus: "idle",
    lastNavigationError: null,
    lastStopReason: null,
    reviewRequiredReason: null,
    geometryGuardStatus: "Not calibrated",
    viewport: "unknown",
    calibration: "Calibration required",
    localAiStatus: "idle",
    latestScreenshotEvidenceId: null,
    latestScreenshotPath: null,
    latestAiResultId: null,
    latestAiResultSummary: null,
    latestActionLogId: null,
    latestActionResult: null,
    latestRoundTraceStep: null,
    latestRoundTraceStatus: null,
    latestRoundTraceDetail: null,
    noCandidateReason: null,
    lastError: null,
  };

  constructor(
    private readonly adapter: PlatformAdapter,
    private readonly evidenceStore: EvidenceStoreService,
    private readonly localAiGateway: LocalAiGateway,
  ) {}

  getHealth(): { ok: boolean; detail: string } {
    return {
      ok: true,
      detail: this.currentTask
        ? `agent ${this.currentTask.status} on ${this.currentTask.id}`
        : "agent ready for bounded local rounds"
    };
  }

  async startOrResumeTask(): Promise<TaskRun> {
    if (this.currentTask && this.currentTask.status === "paused") {
      this.controlState.pauseRequested = false;
      await this.evidenceStore.updateTaskRunStatus(this.currentTask.id, "running");
      this.currentTask.status = "running";
      this.adapter.seek(this.currentTask.currentRoundIndex);
      this.executeCurrentTask().catch((error: unknown) => {
        void this.failCurrentTask(error);
      });
      return this.currentTask;
    }

    if (this.currentTask && this.currentTask.status === "running") {
      return this.currentTask;
    }

    this.adapter.reset();
    this.controlState.pauseRequested = false;
    this.controlState.stopRequested = false;
    this.currentTask = await this.evidenceStore.createTaskRun(this.adapter.platformId, this.adapter.defaultMaxRounds);
    this.controlState.runningTaskId = this.currentTask.id;

    this.executeCurrentTask().catch((error: unknown) => {
      void this.failCurrentTask(error);
    });

    return this.currentTask;
  }

  async pauseTask(): Promise<TaskRun | null> {
    if (!this.currentTask || this.currentTask.status !== "running") {
      return this.currentTask;
    }

    this.controlState.pauseRequested = true;
    this.currentTask = await this.evidenceStore.updateTaskRunStatus(this.currentTask.id, "paused", "pause requested by operator");
    return this.currentTask;
  }

  async stopTask(): Promise<TaskRun | null> {
    if (!this.currentTask) {
      return null;
    }

    this.controlState.stopRequested = true;
    this.currentTask = await this.evidenceStore.updateTaskRunStatus(this.currentTask.id, "stopped", "stop requested by operator");
    return this.currentTask;
  }

  async getSnapshot(): Promise<{
    currentTask: TaskRun | null;
    controlState: AgentControlState;
    deliveryState: RuntimeDeliveryState;
  }> {
    this.refreshDeliveryStateFromAdapter();
    return {
      currentTask: this.currentTask,
      controlState: { ...this.controlState },
      deliveryState: { ...this.deliveryState },
    };
  }

  resetRuntimeState(): void {
    this.controlState = {
      pauseRequested: false,
      stopRequested: false,
      runningTaskId: null,
    };
    this.currentTask = null;
    this.deliveryState = {
      currentRoundStep: "idle",
      currentUrl: "about:blank",
      targetUrl: null,
      pageReadyStatus: "idle",
      lastNavigationError: null,
      lastStopReason: null,
      reviewRequiredReason: null,
      geometryGuardStatus: "Not calibrated",
      viewport: "unknown",
      calibration: "Calibration required",
      localAiStatus: "idle",
      latestScreenshotEvidenceId: null,
      latestScreenshotPath: null,
      latestAiResultId: null,
      latestAiResultSummary: null,
      latestActionLogId: null,
      latestActionResult: null,
      latestRoundTraceStep: null,
      latestRoundTraceStatus: null,
      latestRoundTraceDetail: null,
      noCandidateReason: null,
      lastError: null,
    };
    this.adapter.reset();
  }

  private async executeCurrentTask(): Promise<void> {
    if (!this.currentTask) {
      return;
    }

    const task = this.currentTask;
    await this.recordRoundLifecycleStep({
      taskRunId: task.id,
      roundId: "round_bootstrap",
      step: "task_start",
      status: "completed",
      detail: `task started for ${this.adapter.platformId}`,
    });
    this.setCurrentRoundStep("opening_target_page");
    await this.recordRoundLifecycleStep({
      taskRunId: task.id,
      roundId: "round_bootstrap",
      step: "open_target_page",
      status: "entered",
      detail: `opening ${this.adapter.platformId}`,
    });
    const openFeedRequest = this.createActionRequest(task.id, "round_bootstrap", "open_feed", this.adapter.platformId, "operator started task");
    const openFeedResult = await this.adapter.openFeed(openFeedRequest);
    this.refreshDeliveryStateFromAdapter();
    if (openFeedResult.status !== "success") {
      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId: "round_bootstrap",
        step: "open_target_page",
        status: "failed",
        detail: openFeedResult.message,
      });
      const runtimePageCapture = await this.adapter.captureRuntimePageState(
        this.createActionRequest(task.id, "round_bootstrap", "capture_video_region", "runtime-page-state", "capture runtime page state after open failure"),
      );
      const runtimePageEvidence = await this.evidenceStore.saveImageEvidence({
        kind: "video-screenshot",
        taskRunId: task.id,
        roundId: "round_bootstrap",
        platformId: this.adapter.platformId,
        sourceId: runtimePageCapture.sourceId,
        sourceUrl: runtimePageCapture.capture.pageUrl,
        regionLabel: runtimePageCapture.capture.regionLabel,
        regionType: runtimePageCapture.capture.regionType,
        summary: runtimePageCapture.summary,
        width: runtimePageCapture.capture.width,
        height: runtimePageCapture.capture.height,
        ...(runtimePageCapture.capture.contentLines ? { contentLines: runtimePageCapture.capture.contentLines } : {}),
        ...(runtimePageCapture.capture.sourceFilePath ? { sourceFilePath: runtimePageCapture.capture.sourceFilePath } : {}),
      });
      const runtimePageEvidenceRef = this.evidenceStore.toEvidenceRef(runtimePageEvidence);
      this.deliveryState.latestScreenshotEvidenceId = runtimePageEvidence.id;
      this.deliveryState.latestScreenshotPath = runtimePageEvidence.filePath;

      this.deliveryState.localAiStatus = "running";
      const startupVisionResult = await this.localAiGateway.execute({
        id: createId("ai_request"),
        taskType: "vision.productPresence",
        modelRole: "vision",
        promptVersion: "v1",
        schemaVersion: "vision.productPresence.schema.v1",
        evidenceRefs: [runtimePageEvidenceRef],
        input: {
          inputMode: "single_frame_fallback",
          multiFrameEvidenceSetId: null,
          contactSheetEvidenceId: null,
          frameEvidenceIds: [runtimePageEvidence.id],
          screenshotEvidenceId: runtimePageEvidence.id,
          screenshotRegion: runtimePageCapture.capture.regionType,
          sourceUrl: runtimePageCapture.capture.pageUrl,
          samplingStrategy: "single_frame_fallback",
          sampledFrameCount: 1,
          validFrameCount: 1,
          summary: openFeedResult.message,
          tags: ["uncertain", "platform-review-required"],
        },
      });
      await this.evidenceStore.saveAiResult(startupVisionResult);
      this.deliveryState.localAiStatus = "ok";
      this.deliveryState.latestAiResultId = startupVisionResult.id;
      this.deliveryState.latestAiResultSummary = `${startupVisionResult.taskType}:${String((startupVisionResult.result as VisionClassificationPayload).isProductVideo)}`;

      const startupActionLog = await this.appendActionLog(
        task.id,
        "round_bootstrap",
        "open_feed",
        "failed",
        openFeedResult.message,
        [runtimePageEvidenceRef],
        [startupVisionResult.id],
      );
      this.deliveryState.latestActionLogId = startupActionLog.id;
      this.deliveryState.latestActionResult = `open_feed:failed:${openFeedResult.message}`;
      this.deliveryState.reviewRequiredReason = openFeedResult.message;
      this.deliveryState.lastStopReason = openFeedResult.message;
      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId: "round_bootstrap",
        step: "detect_login_or_safety",
        status: "failed",
        detail: openFeedResult.message,
      });
      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId: "round_bootstrap",
        step: "review_required",
        status: "completed",
        detail: openFeedResult.message,
      });
      this.setCurrentRoundStep("review_required");
      this.currentTask = await this.evidenceStore.updateTaskRunStatus(task.id, "review_required", openFeedResult.message);
      this.controlState.runningTaskId = null;
      return;
    }

    await this.recordRoundLifecycleStep({
      taskRunId: task.id,
      roundId: "round_bootstrap",
      step: "open_target_page",
      status: "completed",
      detail: openFeedResult.message,
    });
    await this.recordRoundLifecycleStep({
      taskRunId: task.id,
      roundId: "round_bootstrap",
      step: "detect_login_or_safety",
      status: "completed",
      detail: "page opened without login or safety block",
    });
    await this.recordRoundLifecycleStep({
      taskRunId: task.id,
      roundId: "round_bootstrap",
      step: "wait_feed_ready",
      status: "completed",
      detail: this.deliveryState.pageReadyStatus,
    });

    let roundIndex = task.currentRoundIndex;

    while (this.adapter.hasCurrentVideo() && roundIndex < task.maxRounds) {
      if (this.controlState.stopRequested) {
        this.currentTask = await this.evidenceStore.updateTaskRunStatus(task.id, "stopped", "task stopped by operator");
        return;
      }

      if (this.controlState.pauseRequested) {
        this.currentTask = await this.evidenceStore.updateTaskRunStatus(task.id, "paused", "task paused by operator");
        return;
      }

      const roundId = createId("round");
      const now = new Date().toISOString();
      let round: AgentRound = AgentRoundSchema.parse({
        id: roundId,
        taskRunId: task.id,
        index: roundIndex,
        status: "pending",
        createdAt: now,
        updatedAt: now,
        actionLogIds: []
      });
      const roundActionLogs: ActionLog[] = [];

      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId,
        step: "single_video_round_start",
        status: "completed",
        detail: `starting round ${roundIndex + 1}`,
      });
      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId,
        step: "wait_video_stable",
        status: "completed",
        detail: this.deliveryState.pageReadyStatus,
      });

      this.setCurrentRoundStep("observing_current_video");
      const observation = await this.adapter.observeCurrentVideo(
        this.createActionRequest(task.id, roundId, "observe_current_video", "current-video", "observe current video"),
      );
      this.refreshDeliveryStateFromAdapter();
      round.videoId = observation.video.id;
      round.videoVisitId = observation.video.id;
      round.status = "observed";
      round.updatedAt = new Date().toISOString();
      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId,
        step: "identify_current_video",
        status: "completed",
        detail: observation.video.id,
        videoVisitId: observation.video.id,
      });

      const isDuplicateVideo = await this.evidenceStore.hasSeenVideoVisit(task.id, observation.video.id);
      await this.evidenceStore.saveAgentRound(round);
      if (this.currentTask) {
        this.currentTask.currentRoundIndex = roundIndex;
      }

      if (isDuplicateVideo) {
        const duplicateReason = `duplicate videoVisitId detected: ${observation.video.id}`;
        await this.recordRoundLifecycleStep({
          taskRunId: task.id,
          roundId,
          step: "record_skip_reason",
          status: "completed",
          detail: duplicateReason,
          videoVisitId: observation.video.id,
        });
        const continueAfterDuplicateLog = await this.continueAfterSkipRound({
          taskRunId: task.id,
          roundId,
          reason: "continue after duplicate video detection",
        });
        roundActionLogs.push(continueAfterDuplicateLog);
        round.actionLogIds.push(continueAfterDuplicateLog.id);
        this.deliveryState.latestActionLogId = continueAfterDuplicateLog.id;
        this.deliveryState.latestActionResult = `${continueAfterDuplicateLog.actionType}:${continueAfterDuplicateLog.status}:${continueAfterDuplicateLog.message}`;
        await this.recordRoundLifecycleStep({
          taskRunId: task.id,
          roundId,
          step: "scroll_next_video",
          status: continueAfterDuplicateLog.status === "success" ? "completed" : "failed",
          detail: continueAfterDuplicateLog.message,
          videoVisitId: observation.video.id,
        });
        const duplicateRoundLog = await finalizeRoundArtifacts({
          evidenceStore: this.evidenceStore,
          taskRunId: task.id,
          round,
          sourcePlatform: this.adapter.platformId,
          sourceUrl: observation.video.pageUrl,
          currentUrl: this.deliveryState.currentUrl,
          pageReadyStatus: this.deliveryState.pageReadyStatus,
          geometryStatus: this.deliveryState.geometryGuardStatus,
          decision: "not_asked",
          roundOutcome: "skipped_duplicate",
          browseOutcome: "skipped_duplicate",
          decisionReason: duplicateReason,
          nextStep: "scroll_next_video",
          artifactKind: "browse_ledger",
          exportIncluded: false,
          actionLogs: roundActionLogs,
          preActionMetricsUnavailableReason: "duplicate round finalized before screenshot and AI",
          additionalDataQualityFlags: ["duplicate_video", "video_screenshot_missing"],
        });
        await this.recordRoundLifecycleStep({
          taskRunId: task.id,
          roundId,
          step: "finalize_browse_ledger",
          status: "completed",
          detail: duplicateRoundLog.roundOutcome,
          videoVisitId: observation.video.id,
        });
        round.status = "skipped";
        round.note = duplicateReason;
        round.roundOutcome = duplicateRoundLog.roundOutcome;
        round.decisionReason = duplicateRoundLog.decisionReason;
        round.nextStep = duplicateRoundLog.nextStep;
        round.updatedAt = new Date().toISOString();
        await this.evidenceStore.saveAgentRound(round);
        roundIndex += 1;
        continue;
      }

      const isUnstableVideo = observation.video.tags.includes("unstable");
      if (isUnstableVideo) {
        const unstableReason = observation.video.summary;
        await this.recordRoundLifecycleStep({
          taskRunId: task.id,
          roundId,
          step: "wait_video_stable",
          status: "failed",
          detail: unstableReason,
          videoVisitId: observation.video.id,
        });
        await this.recordRoundLifecycleStep({
          taskRunId: task.id,
          roundId,
          step: "record_skip_reason",
          status: "completed",
          detail: unstableReason,
          videoVisitId: observation.video.id,
        });
        const continueAfterUnstableLog = await this.continueAfterSkipRound({
          taskRunId: task.id,
          roundId,
          reason: "continue after unstable video detection",
        });
        roundActionLogs.push(continueAfterUnstableLog);
        round.actionLogIds.push(continueAfterUnstableLog.id);
        this.deliveryState.latestActionLogId = continueAfterUnstableLog.id;
        this.deliveryState.latestActionResult = `${continueAfterUnstableLog.actionType}:${continueAfterUnstableLog.status}:${continueAfterUnstableLog.message}`;
        await this.recordRoundLifecycleStep({
          taskRunId: task.id,
          roundId,
          step: "scroll_next_video",
          status: continueAfterUnstableLog.status === "success" ? "completed" : "failed",
          detail: continueAfterUnstableLog.message,
          videoVisitId: observation.video.id,
        });
        const unstableRoundLog = await finalizeRoundArtifacts({
          evidenceStore: this.evidenceStore,
          taskRunId: task.id,
          round,
          sourcePlatform: this.adapter.platformId,
          sourceUrl: observation.video.pageUrl,
          currentUrl: this.deliveryState.currentUrl,
          pageReadyStatus: this.deliveryState.pageReadyStatus,
          geometryStatus: this.deliveryState.geometryGuardStatus,
          decision: "not_asked",
          roundOutcome: "skipped_unstable_video",
          browseOutcome: "skipped_unstable_video",
          decisionReason: unstableReason,
          nextStep: "scroll_next_video",
          artifactKind: "browse_ledger",
          exportIncluded: false,
          actionLogs: roundActionLogs,
          preActionMetricsUnavailableReason: "unstable round finalized before screenshot and AI",
          additionalDataQualityFlags: ["video_screenshot_missing"],
        });
        await this.recordRoundLifecycleStep({
          taskRunId: task.id,
          roundId,
          step: "record_round_complete",
          status: "completed",
          detail: unstableRoundLog.roundOutcome,
          videoVisitId: observation.video.id,
        });
        round.status = "skipped";
        round.note = unstableReason;
        round.roundOutcome = unstableRoundLog.roundOutcome;
        round.decisionReason = unstableRoundLog.decisionReason;
        round.nextStep = unstableRoundLog.nextStep;
        round.updatedAt = new Date().toISOString();
        await this.evidenceStore.saveAgentRound(round);
        roundIndex += 1;
        continue;
      }

      const observationRequiresReview =
        observation.actionResult.status !== "success" ||
        observation.video.tags.includes("platform-review-required");
      if (observationRequiresReview) {
        this.deliveryState.reviewRequiredReason = observation.actionResult.message || observation.video.summary;
        this.deliveryState.lastStopReason = this.deliveryState.reviewRequiredReason;
        await this.recordRoundLifecycleStep({
          taskRunId: task.id,
          roundId,
          step: "review_required",
          status: "completed",
          detail: this.deliveryState.reviewRequiredReason,
          videoVisitId: observation.video.id,
        });
        this.setCurrentRoundStep("review_required");
        round.status = "review_required";
        round.note = observation.actionResult.message || observation.video.summary;
        round.updatedAt = new Date().toISOString();
        await this.evidenceStore.saveAgentRound(round);
        this.currentTask = await this.evidenceStore.updateTaskRunStatus(task.id, "review_required", round.note);
        this.controlState.runningTaskId = null;
        return;
      }

      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId,
        step: "calibrate_geometry",
        status: "completed",
        detail: this.deliveryState.geometryGuardStatus,
        videoVisitId: observation.video.id,
      });
      this.setCurrentRoundStep("capturing_video_screenshot");
      const videoCapture = await this.adapter.captureVideoRegion(
        this.createActionRequest(task.id, roundId, "capture_video_region", "video-region", "capture current video region"),
      );
      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId,
        step: "screenshot_video_area",
        status: "completed",
        detail: videoCapture.actionResult.message,
        videoVisitId: observation.video.id,
      });
      const videoEvidence = await this.evidenceStore.saveImageEvidence({
        kind: "video-screenshot",
        taskRunId: task.id,
        roundId,
        platformId: this.adapter.platformId,
        sourceId: observation.video.id,
        sourceUrl: videoCapture.capture.pageUrl,
        regionLabel: videoCapture.capture.regionLabel,
        regionType: videoCapture.capture.regionType,
        summary: observation.video.summary,
        width: videoCapture.capture.width,
        height: videoCapture.capture.height,
        ...(videoCapture.capture.contentLines ? { contentLines: videoCapture.capture.contentLines } : {}),
        ...(videoCapture.capture.sourceFilePath ? { sourceFilePath: videoCapture.capture.sourceFilePath } : {})
      });
      const videoEvidenceRef = this.evidenceStore.toEvidenceRef(videoEvidence);
      this.deliveryState.latestScreenshotEvidenceId = videoEvidence.id;
      this.deliveryState.latestScreenshotPath = videoEvidence.filePath;
      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId,
        step: "record_video_evidence",
        status: "completed",
        detail: videoEvidence.id,
        videoVisitId: observation.video.id,
      });

      this.setCurrentRoundStep("calling_local_ai");
      this.deliveryState.localAiStatus = "running";
      const visionResult = await this.localAiGateway.execute({
        id: createId("ai_request"),
        taskType: "vision.productPresence",
        modelRole: "vision",
        promptVersion: "v1",
        schemaVersion: "vision.productPresence.schema.v1",
        evidenceRefs: [videoEvidenceRef],
        input: {
          inputMode: "single_frame_fallback",
          multiFrameEvidenceSetId: null,
          contactSheetEvidenceId: null,
          frameEvidenceIds: [videoEvidence.id],
          screenshotEvidenceId: videoEvidence.id,
          screenshotRegion: videoCapture.capture.regionType,
          sourceUrl: videoCapture.capture.pageUrl,
          samplingStrategy: "single_frame_fallback",
          sampledFrameCount: 1,
          validFrameCount: 1,
          summary: observation.video.summary,
          tags: observation.video.tags
        }
      });
      await this.evidenceStore.saveAiResult(visionResult);
      this.deliveryState.localAiStatus = "ok";
      this.deliveryState.latestAiResultId = visionResult.id;
      this.deliveryState.latestAiResultSummary = `${visionResult.taskType}:${String((visionResult.result as VisionClassificationPayload).isProductVideo)}`;
      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId,
        step: "ask_ai_product_presence",
        status: "completed",
        detail: visionResult.id,
        videoVisitId: observation.video.id,
      });
      round.status = "classified";
      round.updatedAt = new Date().toISOString();

      const visionPayload = visionResult.result as VisionClassificationPayload;
      const browseDecision = resolveProductPresenceDecision(visionPayload);
      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId,
        step: "validate_ai_output",
        status: "completed",
        detail: `${browseDecision.decision}:${browseDecision.reason}`,
        videoVisitId: observation.video.id,
      });
      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId,
        step: "branch",
        status: "completed",
        detail: browseDecision.decision,
        videoVisitId: observation.video.id,
      });
      if (browseDecision.decision === "product_uncertain") {
        this.deliveryState.noCandidateReason = "vision_uncertain";
        await this.recordRoundLifecycleStep({
          taskRunId: task.id,
          roundId,
          step: "record_skip_reason",
          status: "completed",
          detail: browseDecision.reason,
          videoVisitId: observation.video.id,
        });
        const continueAfterUncertain = await this.adapter.continueNext(
          this.createActionRequest(task.id, roundId, "continue_next", "feed", "continue after uncertainty"),
        );
        const continueAfterUncertainLog = await this.appendActionLog(
          task.id,
          roundId,
          continueAfterUncertain.type,
          continueAfterUncertain.status,
          continueAfterUncertain.message,
          [videoEvidenceRef],
          [visionResult.id],
        );
        roundActionLogs.push(continueAfterUncertainLog);
        round.actionLogIds.push(continueAfterUncertainLog.id);
        this.deliveryState.latestActionLogId = continueAfterUncertainLog.id;
        this.deliveryState.latestActionResult = `${continueAfterUncertain.type}:${continueAfterUncertain.status}:${continueAfterUncertain.message}`;
        await this.recordRoundLifecycleStep({
          taskRunId: task.id,
          roundId,
          step: browseDecision.mustReview ? "review_required" : "scroll_next_video",
          status: browseDecision.mustReview ? "completed" : (continueAfterUncertain.status === "success" ? "completed" : "failed"),
          detail: browseDecision.mustReview ? browseDecision.reason : continueAfterUncertain.message,
          videoVisitId: observation.video.id,
        });
        const uncertainRoundLog = await finalizeRoundArtifacts({
          evidenceStore: this.evidenceStore,
          taskRunId: task.id,
          round,
          sourcePlatform: this.adapter.platformId,
          sourceUrl: observation.video.pageUrl,
          currentUrl: this.deliveryState.currentUrl,
          pageReadyStatus: this.deliveryState.pageReadyStatus,
          geometryStatus: this.deliveryState.geometryGuardStatus,
          decision: browseDecision.mustReview ? "review_required" : "product_uncertain",
          roundOutcome: browseDecision.mustReview ? "review_required" : "skipped_uncertain",
          browseOutcome: browseDecision.mustReview ? null : "skipped_uncertain",
          decisionReason: browseDecision.reason,
          nextStep: browseDecision.mustReview ? "review_required" : "scroll_next_video",
          artifactKind: browseDecision.mustReview ? "failed_packet" : "browse_ledger",
          exportIncluded: false,
          videoEvidence,
          productPresenceResult: visionResult as Extract<LocalAiTaskResult, { taskType: "vision.productPresence" }>,
          actionLogs: roundActionLogs,
          preActionMetricsUnavailableReason: "platform adapter does not expose governed metric extraction yet",
        });
        round.status = browseDecision.mustReview ? "review_required" : "skipped";
        round.note = browseDecision.reason;
        round.roundOutcome = uncertainRoundLog.roundOutcome;
        round.decisionReason = uncertainRoundLog.decisionReason;
        round.nextStep = uncertainRoundLog.nextStep;
        if (uncertainRoundLog.packetId) {
          round.packetId = uncertainRoundLog.packetId;
        }
        round.updatedAt = new Date().toISOString();
        await this.evidenceStore.saveAgentRound(round);
        await this.recordRoundLifecycleStep({
          taskRunId: task.id,
          roundId,
          step: browseDecision.mustReview ? "finalize_failed_or_review_record" : "finalize_browse_ledger",
          status: "completed",
          detail: uncertainRoundLog.roundOutcome,
          videoVisitId: observation.video.id,
        });
        if (browseDecision.mustReview) {
          this.deliveryState.reviewRequiredReason = browseDecision.reason;
          this.deliveryState.lastStopReason = browseDecision.reason;
          this.setCurrentRoundStep("review_required");
          this.currentTask = await this.evidenceStore.updateTaskRunStatus(task.id, "review_required", browseDecision.reason);
          this.controlState.runningTaskId = null;
          return;
        }
        roundIndex += 1;
        continue;
      }

      if (browseDecision.decision === "product_no_high_confidence") {
        this.deliveryState.noCandidateReason = "vision_non_product_video";
        await this.recordRoundLifecycleStep({
          taskRunId: task.id,
          roundId,
          step: "decide_negative_action",
          status: "completed",
          detail: browseDecision.reason,
          videoVisitId: observation.video.id,
        });
        if (browseDecision.shouldClickNotInterested) {
          this.setCurrentRoundStep("executing_action");
          const actionResult = await this.adapter.clickNotInterested(
            this.createActionRequest(task.id, roundId, "click_not_interested", observation.video.id, visionPayload.reason),
          );
          const actionLog = await this.appendActionLog(task.id, roundId, actionResult.type, actionResult.status, actionResult.message, [videoEvidenceRef], [visionResult.id]);
          roundActionLogs.push(actionLog);
          this.deliveryState.latestActionLogId = actionLog.id;
          this.deliveryState.latestActionResult = `${actionResult.type}:${actionResult.status}:${actionResult.message}`;
          round.actionLogIds.push(actionLog.id);
          await this.recordRoundLifecycleStep({
            taskRunId: task.id,
            roundId,
            step: "click_not_interested",
            status: actionResult.status === "success" ? "completed" : "failed",
            detail: actionResult.message,
            videoVisitId: observation.video.id,
          });
        }
        await this.recordRoundLifecycleStep({
          taskRunId: task.id,
          roundId,
          step: "record_skip_reason",
          status: "completed",
          detail: browseDecision.reason,
          videoVisitId: observation.video.id,
        });
        const continueAfterNonProduct = await this.adapter.continueNext(
          this.createActionRequest(task.id, roundId, "continue_next", "feed", "continue after non-product video"),
        );
        const continueAfterNonProductLog = await this.appendActionLog(
          task.id,
          roundId,
          continueAfterNonProduct.type,
          continueAfterNonProduct.status,
          continueAfterNonProduct.message,
          [videoEvidenceRef],
          [visionResult.id],
        );
        roundActionLogs.push(continueAfterNonProductLog);
        round.actionLogIds.push(continueAfterNonProductLog.id);
        this.deliveryState.latestActionLogId = continueAfterNonProductLog.id;
        this.deliveryState.latestActionResult = `${continueAfterNonProduct.type}:${continueAfterNonProduct.status}:${continueAfterNonProduct.message}`;
        await this.recordRoundLifecycleStep({
          taskRunId: task.id,
          roundId,
          step: "scroll_next_video",
          status: continueAfterNonProduct.status === "success" ? "completed" : "failed",
          detail: continueAfterNonProduct.message,
          videoVisitId: observation.video.id,
        });
        const nonProductRoundLog = await finalizeRoundArtifacts({
          evidenceStore: this.evidenceStore,
          taskRunId: task.id,
          round,
          sourcePlatform: this.adapter.platformId,
          sourceUrl: observation.video.pageUrl,
          currentUrl: this.deliveryState.currentUrl,
          pageReadyStatus: this.deliveryState.pageReadyStatus,
          geometryStatus: this.deliveryState.geometryGuardStatus,
          decision: "product_no_high_confidence",
          roundOutcome: "skipped_non_product",
          browseOutcome: "product_no_high_confidence",
          decisionReason: browseDecision.reason,
          nextStep: "scroll_next_video",
          artifactKind: "browse_ledger",
          exportIncluded: false,
          videoEvidence,
          productPresenceResult: visionResult as Extract<LocalAiTaskResult, { taskType: "vision.productPresence" }>,
          actionLogs: roundActionLogs,
          preActionMetricsUnavailableReason: "platform adapter does not expose governed metric extraction yet",
        });
        round.status = "skipped";
        round.note = browseDecision.reason;
        round.roundOutcome = nonProductRoundLog.roundOutcome;
        round.decisionReason = nonProductRoundLog.decisionReason;
        round.nextStep = nonProductRoundLog.nextStep;
        round.updatedAt = new Date().toISOString();
        await this.evidenceStore.saveAgentRound(round);
        await this.recordRoundLifecycleStep({
          taskRunId: task.id,
          roundId,
          step: "finalize_browse_ledger",
          status: "completed",
          detail: nonProductRoundLog.roundOutcome,
          videoVisitId: observation.video.id,
        });
        if (continueAfterNonProduct.status !== "success") {
          this.deliveryState.reviewRequiredReason = continueAfterNonProduct.message;
          this.deliveryState.lastStopReason = continueAfterNonProduct.message;
          await this.recordRoundLifecycleStep({
            taskRunId: task.id,
            roundId,
            step: "review_required",
            status: "completed",
            detail: continueAfterNonProduct.message,
            videoVisitId: observation.video.id,
          });
          this.setCurrentRoundStep("review_required");
          this.currentTask = await this.evidenceStore.updateTaskRunStatus(task.id, "review_required", continueAfterNonProduct.message);
          this.controlState.runningTaskId = null;
          return;
        }
        roundIndex += 1;
        continue;
      }

      this.deliveryState.noCandidateReason = null;
      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId,
        step: "collect_pre_action_metrics",
        status: "completed",
        detail: "platform adapter does not expose governed metric extraction yet",
        videoVisitId: observation.video.id,
      });
      this.setCurrentRoundStep("planning_action");
      const likeResult = await this.adapter.likeOrSaveCandidate(
        this.createActionRequest(task.id, roundId, "like_or_save_candidate", observation.video.id, visionPayload.reason),
      );
      const likeLog = await this.appendActionLog(task.id, roundId, likeResult.type, likeResult.status, likeResult.message, [videoEvidenceRef], [visionResult.id], likeResult);
      roundActionLogs.push(likeLog);
      this.deliveryState.latestActionLogId = likeLog.id;
      this.deliveryState.latestActionResult = `${likeResult.type}:${likeResult.status}:${likeResult.message}`;
      round.actionLogIds.push(likeLog.id);
      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId,
        step: "like_or_save_marker",
        status: likeResult.status === "success" ? "completed" : "failed",
        detail: likeResult.message,
        videoVisitId: observation.video.id,
      });

      this.setCurrentRoundStep("executing_action");
      const openCommentsResult = await this.adapter.openComments(
        this.createActionRequest(task.id, roundId, "open_comments", observation.video.id, "product classification requires comment evidence"),
      );
      const openCommentsLog = await this.appendActionLog(task.id, roundId, openCommentsResult.type, openCommentsResult.status, openCommentsResult.message, [videoEvidenceRef], [visionResult.id], openCommentsResult);
      roundActionLogs.push(openCommentsLog);
      this.deliveryState.latestActionLogId = openCommentsLog.id;
      this.deliveryState.latestActionResult = `${openCommentsResult.type}:${openCommentsResult.status}:${openCommentsResult.message}`;
      round.actionLogIds.push(openCommentsLog.id);
      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId,
        step: "open_comments",
        status: openCommentsResult.status === "success" ? "completed" : "failed",
        detail: openCommentsResult.message,
        videoVisitId: observation.video.id,
      });
      if (openCommentsResult.status === "failed") {
        const fallbackProductSignal = await this.localAiGateway.execute({
          id: createId("ai_request"),
          taskType: "product.signal_summary",
          modelRole: "productSignal",
          promptVersion: "product.signal_summary.v1",
          schemaVersion: "product-opportunity-candidate.v1",
          evidenceRefs: [videoEvidenceRef],
          input: {
            videoSummary: observation.video.summary,
            productPresence: visionPayload,
            commentSignals: {
              purchaseIntent: "low",
              painPoints: [],
              complaints: [],
              demandTerms: [],
              confidence: 0,
            },
          },
        });
        await this.evidenceStore.saveAiResult(fallbackProductSignal);
        this.deliveryState.latestAiResultId = fallbackProductSignal.id;
        this.deliveryState.latestAiResultSummary = `${fallbackProductSignal.taskType}:${fallbackProductSignal.confidence.toFixed(2)}`;

        const fallbackPayload = fallbackProductSignal.result as ProductSignalPayload;
        const videoOnlyCandidate = ProductOpportunityCandidateSchema.parse({
          id: createId("candidate"),
          taskRunId: task.id,
          roundId,
          platformId: this.adapter.platformId,
          sourceVideoId: observation.video.id,
          analysisStatus: "pending_analysis",
          category: fallbackPayload.category,
          useCase: fallbackPayload.useCase,
          sellingPoints: fallbackPayload.sellingPoints,
          painPoints: fallbackPayload.painPoints,
          purchaseIntent: fallbackPayload.purchaseIntent,
          risk: fallbackPayload.risk,
          score: fallbackPayload.score,
          rationale: fallbackPayload.rationale,
          evidenceRefs: [
            videoEvidenceRef,
            this.evidenceStore.toAiEvidenceRef(visionResult),
            this.evidenceStore.toAiEvidenceRef(fallbackProductSignal)
          ],
          reviewStatus: "pending",
          notes: ["comments unavailable; candidate created from video evidence only"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        const savedVideoOnlyCandidate = await this.evidenceStore.saveCandidate(videoOnlyCandidate);
        round.candidateId = savedVideoOnlyCandidate.id;

        const continueAfterVideoOnlyCandidate = await this.adapter.continueNext(
          this.createActionRequest(task.id, roundId, "continue_next", "feed", "continue after video-only candidate generation"),
        );
        const continueAfterVideoOnlyCandidateLog = await this.appendActionLog(
          task.id,
          roundId,
          continueAfterVideoOnlyCandidate.type,
          continueAfterVideoOnlyCandidate.status,
          continueAfterVideoOnlyCandidate.message,
          [videoEvidenceRef],
          [visionResult.id, fallbackProductSignal.id],
        );
        roundActionLogs.push(continueAfterVideoOnlyCandidateLog);
        round.actionLogIds.push(continueAfterVideoOnlyCandidateLog.id);
        this.deliveryState.latestActionLogId = continueAfterVideoOnlyCandidateLog.id;
        this.deliveryState.latestActionResult = `${continueAfterVideoOnlyCandidate.type}:${continueAfterVideoOnlyCandidate.status}:${continueAfterVideoOnlyCandidate.message}`;
        await this.recordRoundLifecycleStep({
          taskRunId: task.id,
          roundId,
          step: "create_video_only_pending_candidate",
          status: "completed",
          detail: savedVideoOnlyCandidate.id,
          videoVisitId: observation.video.id,
        });
        await this.recordRoundLifecycleStep({
          taskRunId: task.id,
          roundId,
          step: "scroll_next_video",
          status: continueAfterVideoOnlyCandidate.status === "success" ? "completed" : "failed",
          detail: continueAfterVideoOnlyCandidate.message,
          videoVisitId: observation.video.id,
        });

        const videoOnlyRoundLog = await finalizeRoundArtifacts({
          evidenceStore: this.evidenceStore,
          taskRunId: task.id,
          round,
          sourcePlatform: this.adapter.platformId,
          sourceUrl: observation.video.pageUrl,
          currentUrl: this.deliveryState.currentUrl,
          pageReadyStatus: this.deliveryState.pageReadyStatus,
          geometryStatus: this.deliveryState.geometryGuardStatus,
          decision: "product_yes_high_confidence",
          roundOutcome: "comments_unavailable_candidate_created",
          browseOutcome: null,
          decisionReason: openCommentsResult.message,
          nextStep: "scroll_next_video",
          artifactKind: "evidence_packet",
          exportIncluded: true,
          videoEvidence,
          productPresenceResult: visionResult as Extract<LocalAiTaskResult, { taskType: "vision.productPresence" }>,
          actionLogs: roundActionLogs,
          preActionMetricsUnavailableReason: "platform adapter does not expose governed metric extraction yet",
          commentEvidenceFailureReason: openCommentsResult.message,
          candidate: savedVideoOnlyCandidate,
        });

        round.status = "completed";
        round.note = openCommentsResult.message;
        round.roundOutcome = videoOnlyRoundLog.roundOutcome;
        round.decisionReason = videoOnlyRoundLog.decisionReason;
        round.nextStep = videoOnlyRoundLog.nextStep;
        if (videoOnlyRoundLog.packetId) {
          round.packetId = videoOnlyRoundLog.packetId;
        }
        round.updatedAt = new Date().toISOString();
        await this.evidenceStore.saveAgentRound(round);
        await this.recordRoundLifecycleStep({
          taskRunId: task.id,
          roundId,
          step: "finalize_evidence_packet",
          status: "completed",
          detail: videoOnlyRoundLog.roundOutcome,
          videoVisitId: observation.video.id,
        });
        roundIndex += 1;
        continue;
      }

      this.setCurrentRoundStep("recording_results");
      const commentCapture = await this.adapter.captureCommentRegion(
        this.createActionRequest(task.id, roundId, "capture_comment_region", "comment-region", "capture comment evidence"),
      );
      const commentEvidence = await this.evidenceStore.saveImageEvidence({
        kind: "comment-screenshot",
        taskRunId: task.id,
        roundId,
        platformId: this.adapter.platformId,
        sourceId: observation.video.id,
        sourceUrl: commentCapture.capture.pageUrl,
        regionLabel: commentCapture.capture.regionLabel,
        regionType: commentCapture.capture.regionType,
        summary: `comments for ${observation.video.id}`,
        width: commentCapture.capture.width,
        height: commentCapture.capture.height,
        ...(commentCapture.capture.contentLines ? { contentLines: commentCapture.capture.contentLines } : {}),
        ...(commentCapture.capture.sourceFilePath ? { sourceFilePath: commentCapture.capture.sourceFilePath } : {})
      });
      const commentEvidenceRef = this.evidenceStore.toEvidenceRef(commentEvidence);
      this.deliveryState.latestScreenshotEvidenceId = commentEvidence.id;
      this.deliveryState.latestScreenshotPath = commentEvidence.filePath;
      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId,
        step: "screenshot_comments",
        status: "completed",
        detail: commentEvidence.id,
        videoVisitId: observation.video.id,
      });

      this.deliveryState.localAiStatus = "running";
      const ocrResult = await this.localAiGateway.execute({
        id: createId("ai_request"),
        taskType: "comments.ocr_cleanup",
        modelRole: "ocr",
        promptVersion: "comments.ocr_cleanup.v1",
        schemaVersion: "ocr-text.v1",
        evidenceRefs: [commentEvidenceRef],
        input: {
          rawCommentBlocks: commentCapture.capture.contentLines ?? observation.video.comments
        }
      });
      await this.evidenceStore.saveAiResult(ocrResult);
      this.deliveryState.localAiStatus = "ok";
      this.deliveryState.latestAiResultId = ocrResult.id;
      this.deliveryState.latestAiResultSummary = `${ocrResult.taskType}:${ocrResult.confidence.toFixed(2)}`;

      const ocrPayload = ocrResult.result as OcrCleanupPayload;
      const ocrTextResult = OcrTextResultSchema.parse({
        id: createId("ocr"),
        taskRunId: task.id,
        roundId,
        evidenceRef: commentEvidenceRef,
        confidence: ocrPayload.confidence,
        cleanedComments: ocrPayload.cleanedComments,
        uncertainText: ocrPayload.uncertainText,
        createdAt: new Date().toISOString()
      });
      await this.evidenceStore.saveOcrResult(ocrTextResult);
      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId,
        step: "extract_visible_comments",
        status: "completed",
        detail: `${ocrTextResult.cleanedComments.length} comments`,
        videoVisitId: observation.video.id,
      });

      const commentSignalResult = await this.localAiGateway.execute({
        id: createId("ai_request"),
        taskType: "comments.intent_analysis",
        modelRole: "commentUnderstanding",
        promptVersion: "comments.intent_analysis.v1",
        schemaVersion: "comment-signal.v1",
        evidenceRefs: [commentEvidenceRef],
        input: {
          cleanedComments: ocrPayload.cleanedComments.length > 0 ? ocrPayload.cleanedComments : ["uncertain comment text"]
        }
      });
      await this.evidenceStore.saveAiResult(commentSignalResult);
      this.deliveryState.latestAiResultId = commentSignalResult.id;
      this.deliveryState.latestAiResultSummary = `${commentSignalResult.taskType}:${commentSignalResult.confidence.toFixed(2)}`;
      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId,
        step: "summarize_comment_signals",
        status: "completed",
        detail: commentSignalResult.id,
        videoVisitId: observation.video.id,
      });

      const commentSignalPayload = commentSignalResult.result as CommentSignalPayload;

      const productSignalResult = await this.localAiGateway.execute({
        id: createId("ai_request"),
        taskType: "product.signal_summary",
        modelRole: "productSignal",
        promptVersion: "product.signal_summary.v1",
        schemaVersion: "product-opportunity-candidate.v1",
        evidenceRefs: [videoEvidenceRef, commentEvidenceRef],
        input: {
          videoSummary: observation.video.summary,
          productPresence: visionPayload,
          commentSignals: commentSignalPayload
        }
      });
      await this.evidenceStore.saveAiResult(productSignalResult);
      this.deliveryState.latestAiResultId = productSignalResult.id;
      this.deliveryState.latestAiResultSummary = `${productSignalResult.taskType}:${productSignalResult.confidence.toFixed(2)}`;

      const productPayload = productSignalResult.result as ProductSignalPayload;
      const candidate = ProductOpportunityCandidateSchema.parse({
        id: createId("candidate"),
        taskRunId: task.id,
        roundId,
        platformId: this.adapter.platformId,
        sourceVideoId: observation.video.id,
        analysisStatus: "pending_analysis",
        category: productPayload.category,
        useCase: productPayload.useCase,
        sellingPoints: productPayload.sellingPoints,
        painPoints: productPayload.painPoints,
        purchaseIntent: productPayload.purchaseIntent,
        risk: productPayload.risk,
        score: productPayload.score,
        rationale: productPayload.rationale,
        evidenceRefs: [
          videoEvidenceRef,
          commentEvidenceRef,
          this.evidenceStore.toAiEvidenceRef(visionResult),
          this.evidenceStore.toAiEvidenceRef(commentSignalResult),
          this.evidenceStore.toAiEvidenceRef(productSignalResult)
        ],
        reviewStatus: "pending",
        notes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      const savedCandidate = await this.evidenceStore.saveCandidate(candidate);
      round.candidateId = savedCandidate.id;
      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId,
        step: "create_pending_candidate",
        status: "completed",
        detail: savedCandidate.id,
        videoVisitId: observation.video.id,
      });

      const continueAfterCandidate = await this.adapter.continueNext(
        this.createActionRequest(task.id, roundId, "continue_next", "feed", "continue after candidate generation"),
      );
      const continueAfterCandidateLog = await this.appendActionLog(
        task.id,
        roundId,
        continueAfterCandidate.type,
        continueAfterCandidate.status,
        continueAfterCandidate.message,
        [videoEvidenceRef, commentEvidenceRef],
        [visionResult.id, commentSignalResult.id, productSignalResult.id],
      );
      roundActionLogs.push(continueAfterCandidateLog);
      round.actionLogIds.push(continueAfterCandidateLog.id);
      this.deliveryState.latestActionLogId = continueAfterCandidateLog.id;
      this.deliveryState.latestActionResult = `${continueAfterCandidate.type}:${continueAfterCandidate.status}:${continueAfterCandidate.message}`;
      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId,
        step: "scroll_next_video",
        status: continueAfterCandidate.status === "success" ? "completed" : "failed",
        detail: continueAfterCandidate.message,
        videoVisitId: observation.video.id,
      });

      const candidateRoundLog = await finalizeRoundArtifacts({
        evidenceStore: this.evidenceStore,
        taskRunId: task.id,
        round,
        sourcePlatform: this.adapter.platformId,
        sourceUrl: observation.video.pageUrl,
        currentUrl: this.deliveryState.currentUrl,
        pageReadyStatus: this.deliveryState.pageReadyStatus,
        geometryStatus: this.deliveryState.geometryGuardStatus,
        decision: "product_yes_high_confidence",
        roundOutcome: "candidate_created",
        browseOutcome: null,
        decisionReason: browseDecision.reason,
        nextStep: "scroll_next_video",
        artifactKind: "evidence_packet",
        exportIncluded: true,
        videoEvidence,
        productPresenceResult: visionResult as Extract<LocalAiTaskResult, { taskType: "vision.productPresence" }>,
        actionLogs: roundActionLogs,
        preActionMetricsUnavailableReason: "platform adapter does not expose governed metric extraction yet",
        commentEvidence,
        ocrResult: ocrTextResult,
        commentSignalResult: commentSignalResult as Extract<LocalAiTaskResult, { taskType: "comments.intent_analysis" }>,
        candidate: savedCandidate,
      });

      round.status = "completed";
      round.note = browseDecision.reason;
      round.roundOutcome = candidateRoundLog.roundOutcome;
      round.decisionReason = candidateRoundLog.decisionReason;
      round.nextStep = candidateRoundLog.nextStep;
      if (candidateRoundLog.packetId) {
        round.packetId = candidateRoundLog.packetId;
      }
      round.updatedAt = new Date().toISOString();
      await this.evidenceStore.saveAgentRound(round);
      await this.recordRoundLifecycleStep({
        taskRunId: task.id,
        roundId,
        step: "finalize_evidence_packet",
        status: "completed",
        detail: candidateRoundLog.roundOutcome,
        videoVisitId: observation.video.id,
      });
      roundIndex += 1;
    }

    if ((await this.evidenceStore.getOperatorSnapshot()).candidates.length === 0 && !this.deliveryState.noCandidateReason) {
      this.deliveryState.noCandidateReason = "no_product_candidate_generated";
    }
    this.setCurrentRoundStep("completed");
    this.currentTask = await this.evidenceStore.updateTaskRunStatus(task.id, "completed", "runtime loop completed");
    this.controlState.runningTaskId = null;
  }

  private async failCurrentTask(error: unknown): Promise<void> {
    if (!this.currentTask) {
      return;
    }

    const message = error instanceof Error ? error.message : "unknown agent failure";
    this.deliveryState.lastError = message;
    this.deliveryState.lastStopReason = message;
    this.setCurrentRoundStep("failed");
    this.currentTask = await this.evidenceStore.updateTaskRunStatus(this.currentTask.id, "failed", message);
    this.controlState.runningTaskId = null;
  }

  private setCurrentRoundStep(step: RuntimeRoundStep): void {
    this.deliveryState.currentRoundStep = step;
  }

  private async continueAfterSkipRound(input: {
    taskRunId: string;
    roundId: string;
    reason: string;
  }): Promise<ActionLog> {
    const actionResult = await this.adapter.continueNext(
      this.createActionRequest(input.taskRunId, input.roundId, "continue_next", "feed", input.reason),
    );
    return this.appendActionLog(
      input.taskRunId,
      input.roundId,
      actionResult.type,
      actionResult.status,
      actionResult.message,
      [],
      [],
    );
  }

  private async recordRoundLifecycleStep(input: {
    taskRunId: string;
    roundId: string;
    step: RoundLifecycleStep;
    status: RoundLifecycleEventStatus;
    detail: string;
    videoVisitId?: string | null;
  }): Promise<void> {
    const lifecycleEvent = createRoundLifecycleEvent({
      sessionId: input.taskRunId,
      taskRunId: input.taskRunId,
      roundId: input.roundId,
      step: input.step,
      status: input.status,
      detail: input.detail,
      videoVisitId: input.videoVisitId ?? null,
    });
    await this.evidenceStore.saveStructuredRuntimeEvent(
      StructuredRuntimeEventSchema.parse({
        eventId: lifecycleEvent.eventId,
        eventType: toStructuredRuntimeEventType(input.step, input.status),
        sessionId: input.taskRunId,
        roundId: input.roundId,
        videoVisitId: input.videoVisitId ?? null,
        step: input.step,
        previousStep: this.deliveryState.latestRoundTraceStep as RoundLifecycleStep | null,
        nextStep: null,
        status: toStructuredRuntimeStatus(input.step, input.status),
        reason: input.detail,
        failureReason: input.status === "failed" ? input.detail : null,
        reviewRequiredReason:
          input.step === "review_required" || input.step === "finalize_failed_or_review_record"
            ? input.detail
            : null,
        createdAt: lifecycleEvent.createdAt,
        inputRefs: [],
        outputRefs: [],
        evidenceRefs: [],
        actionLogRefs: [],
        dataQualityFlags: [],
      }),
    );
    await this.evidenceStore.saveRoundLifecycleEvent(lifecycleEvent);
    if (input.status !== "entered") {
      await this.evidenceStore.saveStructuredActionLog(
        StructuredActionLogSchema.parse({
          actionLogId: lifecycleEvent.eventId,
          sessionId: input.taskRunId,
          roundId: input.roundId,
          videoVisitId: input.videoVisitId ?? null,
          step: input.step,
          actionType: input.step,
          actionPurpose: deriveRoundStepActionPurpose(input.step),
          triggerSource: "runtime_policy",
          inputRefs: [],
          outputRefs: [],
          beforeEvidenceId: null,
          afterEvidenceId: null,
          result: toStructuredRuntimeStatus(input.step, input.status),
          failureReason: input.status === "failed" ? input.detail : null,
          reviewRequiredReason:
            input.step === "review_required" || input.step === "finalize_failed_or_review_record"
              ? input.detail
              : null,
          evidenceRefs: [],
          createdAt: lifecycleEvent.createdAt,
        }),
      );
    }
    this.deliveryState.latestRoundTraceStep = input.step;
    this.deliveryState.latestRoundTraceStatus = input.status;
    this.deliveryState.latestRoundTraceDetail = input.detail;
  }

  private refreshDeliveryStateFromAdapter(): void {
    const runtimeDiagnostics = this.adapter.getRuntimeDiagnostics();
    const operatorMode = this.adapter.getOperatorModeInfo();
    this.deliveryState.currentUrl = runtimeDiagnostics.currentUrl;
    this.deliveryState.targetUrl = runtimeDiagnostics.targetUrl;
    this.deliveryState.pageReadyStatus = runtimeDiagnostics.pageReadyStatus;
    this.deliveryState.lastNavigationError = runtimeDiagnostics.lastNavigationError;
    this.deliveryState.geometryGuardStatus = operatorMode.geometryGuard;
    this.deliveryState.viewport = operatorMode.viewport;
    this.deliveryState.calibration = operatorMode.calibration;
  }

  private createActionRequest(
    taskRunId: string,
    roundId: string,
    type: PlatformActionRequest["type"],
    target: string,
    reason: string,
  ): PlatformActionRequest {
    return PlatformActionRequestSchema.parse({
      actionId: createId("action"),
      taskRunId,
      roundId,
      platformId: this.adapter.platformId,
      type,
      target,
      requestedAt: new Date().toISOString(),
      reason,
      evidenceRefs: []
    });
  }

  private async appendActionLog(
    taskRunId: string,
    roundId: string,
    actionType: ActionLog["actionType"],
    status: ActionLog["status"],
    message: string,
    evidenceRefs: EvidenceRef[],
    aiTaskRefs: string[],
    platformActionResult?: PlatformActionResult,
  ): Promise<ActionLog> {
    const actionLog = await this.evidenceStore.saveActionLog(
      ActionLogSchema.parse({
        id: createId("action_log"),
        taskRunId,
        roundId,
        platformId: this.adapter.platformId,
        actionType,
        actionPurpose: deriveActionPurpose(actionType),
        triggerSource: aiTaskRefs.length > 0 ? "local_ai_output" : "runtime_policy",
        beforeEvidenceId: evidenceRefs[0]?.id ?? null,
        afterEvidenceId: null,
        status,
        message,
        failureReason: status === "failed" ? message : null,
        visualTargetId: platformActionResult?.visualTarget?.targetId ?? null,
        targetType: platformActionResult?.visualTarget?.targetType ?? null,
        boundingBox: platformActionResult?.visualTarget?.boundingBox ?? null,
        confidence: platformActionResult?.visualTarget?.confidence ?? null,
        geometryStatus: platformActionResult?.geometryStatus ?? null,
        verificationResult: platformActionResult?.visualActionResult?.verificationResult ?? null,
        createdAt: new Date().toISOString(),
        evidenceRefs,
        aiTaskRefs
      }),
    );
    await this.evidenceStore.saveStructuredActionLog(
      StructuredActionLogSchema.parse({
        actionLogId: actionLog.id,
        sessionId: taskRunId,
        roundId,
        videoVisitId: null,
        step: derivePlatformActionStep(actionType),
        actionType: derivePlatformActionStep(actionType),
        actionPurpose: actionLog.actionPurpose,
        triggerSource: actionLog.triggerSource,
        inputRefs: evidenceRefs,
        outputRefs: evidenceRefs,
        beforeEvidenceId: actionLog.beforeEvidenceId,
        afterEvidenceId: actionLog.afterEvidenceId,
        visualTargetId: actionLog.visualTargetId,
        targetType: actionLog.targetType,
        boundingBox: actionLog.boundingBox,
        confidence: actionLog.confidence,
        geometryStatus: actionLog.geometryStatus,
        verificationResult: actionLog.verificationResult,
        result: actionLog.status === "failed" ? "failed" : actionLog.status === "skipped" ? "skipped" : "success",
        failureReason: actionLog.failureReason,
        reviewRequiredReason: null,
        evidenceRefs,
        createdAt: actionLog.createdAt,
      }),
    );
    return actionLog;
  }
}