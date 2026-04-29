import type { EvidenceStoreService } from "../../../lib/storage/evidence-store/evidence-store-service.js";
import type { ForensicsPersistenceAbilityGroup } from "../../forensics-persistence/index.js";
import type { PlatformAdapter } from "../../../lib/local-runtime/platform-runtime-contract.js";
import type { ActionLog, PlatformActionRequest } from "../../../types/platform-action.js";
import type { TaskRun } from "../../../types/task-run.js";
import type { RuntimeDeliveryState } from "../../../types/runtime.js";
import type { OpenDrawer } from "../../open/contract.js";
import type { PostActionVerificationAbilityGroup, PostActionVerificationAbilityResult } from "../../post-action-verification/contract.js";
import { syncLatestActionLog } from "./round-finalization/runtime-round-artifact-support.js";
import { buildImageEvidenceInput, materializeImageEvidenceRecord } from "../../../lib/local-runtime/runtime-round-request-builders.js";

export async function bootstrapAgentTask(input: {
  task: TaskRun;
  adapter: PlatformAdapter;
  openDrawer: OpenDrawer;
  postActionVerificationAbilityGroup: PostActionVerificationAbilityGroup;
  evidenceStore: EvidenceStoreService;
  forensicsPersistenceAbilityGroup: ForensicsPersistenceAbilityGroup;
  deliveryState: RuntimeDeliveryState;
  createActionRequest: (taskRunId: string, roundId: string, type: PlatformActionRequest["type"], target: string, reason: string) => PlatformActionRequest;
  runWithStepTimeout: <T>(input: { taskRunId: string; roundId: string; step: "open_target_page"; timeoutMs: number }, operation: () => Promise<T>) => Promise<T>;
  recordRoundLifecycleStep: (input: { taskRunId: string; roundId: string; step: "task_start" | "open_target_page" | "detect_login_or_safety" | "wait_feed_ready" | "review_required"; status: "entered" | "completed" | "failed"; detail: string }) => Promise<void>;
  appendActionLog: (taskRunId: string, roundId: string, actionType: ActionLog["actionType"], status: ActionLog["status"], message: string, evidenceRefs: Array<{ id: string; kind: "video-screenshot"; summary: string; filePath?: string }>, aiTaskRefs: string[]) => Promise<ActionLog>;
  markReviewRequired: (reason: string) => Promise<void>;
  refreshDeliveryStateFromAdapter: () => void;
  openTargetPageTimeoutMs: number;
}): Promise<boolean> {
  const roundId = "round_bootstrap";
  await input.recordRoundLifecycleStep({ taskRunId: input.task.id, roundId, step: "task_start", status: "completed", detail: `task started for ${input.adapter.platformId}` });
  input.deliveryState.currentRoundStep = "opening_target_page";
  await input.recordRoundLifecycleStep({ taskRunId: input.task.id, roundId, step: "open_target_page", status: "entered", detail: `opening open-${input.adapter.platformId.replace("-web", "")}` });
  await input.recordRoundLifecycleStep({ taskRunId: input.task.id, roundId, step: "detect_login_or_safety", status: "entered", detail: "checking login or safety gate before feed is ready" });
  await input.recordRoundLifecycleStep({ taskRunId: input.task.id, roundId, step: "wait_feed_ready", status: "entered", detail: "waiting for feed readiness after opening target page" });
  const runtimeDiagnostics = input.adapter.getRuntimeDiagnostics();
  const openResult = await input.runWithStepTimeout(
    { taskRunId: input.task.id, roundId, step: "open_target_page", timeoutMs: input.openTargetPageTimeoutMs },
    () => input.openDrawer.openPlatform(createOpenPlatformInput({ platformId: input.adapter.platformId as "tiktok-web" | "facebook-web", roundId, runtimeTargetUrl: runtimeDiagnostics.targetUrl })),
  );
  const openVerificationResult = openResult.status === "success"
    ? await input.postActionVerificationAbilityGroup.execute(createOpenVerificationInput({
      platformId: input.adapter.platformId as "tiktok-web" | "facebook-web",
      roundId,
      targetUrl: runtimeDiagnostics.targetUrl,
      currentUrl: input.adapter.getRuntimeDiagnostics().currentUrl,
      pageReadyStatus: input.adapter.getRuntimeDiagnostics().pageReadyStatus,
      sessionId: input.adapter.getRuntimeDiagnostics().targetUrl ?? `bootstrap-open:${input.adapter.platformId}`,
    }))
    : null
  ;
  const pageReadyResult = openResult.status === "success" && openVerificationResult?.verificationDecision === "verified"
    ? await input.adapter.prepareOpenedPage(input.createActionRequest(input.task.id, roundId, "open_feed", "opened-platform-page", "confirm platform feed readiness after governed open"))
    : null;
  input.refreshDeliveryStateFromAdapter();
  if (openResult.status === "success" && openVerificationResult?.verificationDecision === "verified" && pageReadyResult?.status === "success") {
    await input.recordRoundLifecycleStep({ taskRunId: input.task.id, roundId, step: "open_target_page", status: "completed", detail: openResult.message });
    await input.recordRoundLifecycleStep({ taskRunId: input.task.id, roundId, step: "detect_login_or_safety", status: "completed", detail: "page opened without login or safety block" });
    await input.recordRoundLifecycleStep({ taskRunId: input.task.id, roundId, step: "wait_feed_ready", status: "completed", detail: input.deliveryState.pageReadyStatus });
    return true;
  }

  await handleBootstrapOpenFailure({
    input,
    roundId,
    failedMessage: resolveBootstrapOpenFailureMessage(openResult, openVerificationResult, pageReadyResult?.message),
  });
  return false;
}

function createOpenPlatformInput(input: {
  platformId: "tiktok-web" | "facebook-web";
  roundId: string;
  runtimeTargetUrl: string | null;
}) {
  return {
    platformId: input.platformId,
    reason: "operator started task",
    roundId: input.roundId,
    ...(input.runtimeTargetUrl ? { targetUrl: input.runtimeTargetUrl } : {}),
  };
}

function resolveBootstrapOpenFailureMessage(
  openResult: Awaited<ReturnType<OpenDrawer["openPlatform"]>>,
  openVerificationResult: PostActionVerificationAbilityResult | null,
  pageReadyMessage: string | undefined,
): string {
  return openResult.status === "failed"
    ? openResult.message
    : openVerificationResult && openVerificationResult.verificationDecision !== "verified"
      ? openVerificationResult.reviewRequiredReason ?? openVerificationResult.failureReason ?? openVerificationResult.observedOutcome
    : pageReadyMessage ?? "platform page failed to become ready after governed open";
}

function createOpenVerificationInput(input: {
  platformId: "tiktok-web" | "facebook-web";
  roundId: string;
  targetUrl: string | null;
  currentUrl: string | null;
  pageReadyStatus: string;
  sessionId: string;
}) {
  const currentUrl = input.currentUrl ?? "about:blank";
  const expectedUrlHost = input.platformId === "facebook-web" ? "facebook.com" : "tiktok.com";

  return {
    childCapabilityId: "verify-page-opened" as const,
    actionLogRef: `bootstrap-open:${input.roundId}:${input.platformId}`,
    sourceAbilityGroupId: "open",
    sourceActionType: "open_feed",
    expectedOutcome: {
      outcomeType: "page_opened" as const,
      description: `verify ${input.platformId} page opened`,
      expectedUrlHost,
      expectedUrlPrefix: input.targetUrl,
      expectedState: "page_opened",
      expectedTargetType: null,
      requiresBeforeAfterComparison: false,
      requiresVisualEvidence: false,
    },
    beforeEvidenceRef: null,
    afterEvidenceRef: null,
    pageStateRef: `page-state:${input.roundId}:${input.platformId}`,
    aiObservationRef: null,
    visualTargetRef: null,
    screenshotDiffRef: null,
    requestedBy: "orchestration",
    sessionId: input.sessionId,
    roundId: input.roundId,
    videoVisitId: null,
    confidencePolicy: { minimumConfidence: 0.8, allowReviewRequired: true },
    verificationPolicy: {
      verificationMode: "observation_only" as const,
      requireAfterEvidence: false,
      requireBeforeAfterComparison: false,
      allowSelfReportedSuccess: false,
    },
    observationRefs: [
      {
        kind: "page_state" as const,
        ref: `page-state:${input.roundId}:${input.platformId}`,
        payload: {
          currentUrl,
          loginState: input.pageReadyStatus === "review_required" ? "review_required" : input.pageReadyStatus === "waiting_page_ready" ? "unknown" : "ready",
        },
      },
    ],
  };
}

async function handleBootstrapOpenFailure(input: {
  input: {
    task: TaskRun;
    adapter: PlatformAdapter;
    evidenceStore: EvidenceStoreService;
    forensicsPersistenceAbilityGroup: ForensicsPersistenceAbilityGroup;
    deliveryState: RuntimeDeliveryState;
    createActionRequest: (taskRunId: string, roundId: string, type: PlatformActionRequest["type"], target: string, reason: string) => PlatformActionRequest;
    recordRoundLifecycleStep: (input: { taskRunId: string; roundId: string; step: "task_start" | "open_target_page" | "detect_login_or_safety" | "wait_feed_ready" | "review_required"; status: "entered" | "completed" | "failed"; detail: string }) => Promise<void>;
    appendActionLog: (taskRunId: string, roundId: string, actionType: ActionLog["actionType"], status: ActionLog["status"], message: string, evidenceRefs: Array<{ id: string; kind: "video-screenshot"; summary: string; filePath?: string }>, aiTaskRefs: string[]) => Promise<ActionLog>;
    markReviewRequired: (reason: string) => Promise<void>;
  };
  roundId: string;
  failedMessage: string;
}): Promise<void> {
  await input.input.recordRoundLifecycleStep({ taskRunId: input.input.task.id, roundId: input.roundId, step: "open_target_page", status: "failed", detail: input.failedMessage });
  const runtimePageCapture = await input.input.adapter.captureRuntimePageState(input.input.createActionRequest(input.input.task.id, input.roundId, "capture_video_region", "runtime-page-state", "capture runtime page state after open failure"));
  const runtimePageEvidenceInput = buildImageEvidenceInput({ kind: "video-screenshot", taskRunId: input.input.task.id, roundId: input.roundId, platformId: input.input.adapter.platformId, sourceId: runtimePageCapture.sourceId, sourceUrl: runtimePageCapture.capture.pageUrl, regionLabel: runtimePageCapture.capture.regionLabel, regionType: runtimePageCapture.capture.regionType, summary: runtimePageCapture.summary, width: runtimePageCapture.capture.width, height: runtimePageCapture.capture.height, contentLines: runtimePageCapture.capture.contentLines, sourceFilePath: runtimePageCapture.capture.sourceFilePath });
  const runtimePageEvidenceResult = await input.input.forensicsPersistenceAbilityGroup.writeImageEvidence({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-evidence-record",
    recordType: "evidence_record",
    requestedBy: "orchestration",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: "capture-runtime-page-state",
    sessionId: input.input.task.id,
    roundId: input.roundId,
    videoVisitId: null,
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs: [],
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: ["review_required"],
    payload: { imageEvidenceInput: runtimePageEvidenceInput },
  });
  const runtimePageEvidence = materializeImageEvidenceRecord({ imageEvidenceInput: runtimePageEvidenceInput, persistedResult: runtimePageEvidenceResult });
  input.input.deliveryState.latestScreenshotEvidenceId = runtimePageEvidence.id;
  input.input.deliveryState.latestScreenshotPath = runtimePageEvidence.filePath;
  const startupActionLog = await input.input.appendActionLog(input.input.task.id, input.roundId, "open_feed", "failed", input.failedMessage, [{ id: runtimePageEvidence.id, kind: "video-screenshot", summary: runtimePageEvidence.summary, ...(runtimePageEvidence.filePath ? { filePath: runtimePageEvidence.filePath } : {}) }], []);
  syncLatestActionLog(input.input.deliveryState, startupActionLog);
  input.input.deliveryState.reviewRequiredReason = input.failedMessage;
  input.input.deliveryState.lastStopReason = input.failedMessage;
  await input.input.recordRoundLifecycleStep({ taskRunId: input.input.task.id, roundId: input.roundId, step: "detect_login_or_safety", status: "failed", detail: input.failedMessage });
  await input.input.recordRoundLifecycleStep({ taskRunId: input.input.task.id, roundId: input.roundId, step: "review_required", status: "completed", detail: input.failedMessage });
  await input.input.markReviewRequired(input.failedMessage);
}
