import assert from "node:assert/strict";

import type {
  AiFeedInput,
  AiFeedResult,
  AiInputGatewayAbilityGroup,
} from "../../src/capabilities/ai-input-gateway/index.js";
import {
  createXuanyuanTaskCoordinator,
  getXuanyuanTaskStatus,
} from "../../src/plugins/xuanyuan/index.js";

type RecoveryAcceptanceFixture = {
  dataDir: string;
  buildRequest: (index: number) => unknown;
  buildSuccessfulGateway: (rawText: string) => AiInputGatewayAbilityGroup;
  buildFailedResult: (
    request: AiFeedInput,
    failureReason: string,
  ) => AiFeedResult;
  waitFor: (
    predicate: () => Promise<boolean>,
    timeoutMs?: number,
  ) => Promise<void>;
};

type XuanyuanCoordinator = ReturnType<typeof createXuanyuanTaskCoordinator>;

const runQueuedTaskToIdle = async (
  coordinator: XuanyuanCoordinator,
  request: unknown,
): Promise<string> => {
  await coordinator.init();
  const queued = await coordinator.enqueue(request);
  await coordinator.waitForIdle();
  await coordinator.close();
  return queued.taskId;
};

const resumeExistingQueueToIdle = async (
  coordinator: XuanyuanCoordinator,
): Promise<void> => {
  await coordinator.init();
  await coordinator.waitForIdle();
  await coordinator.close();
};

const runRestartRecoveryAcceptance = async (
  fixture: RecoveryAcceptanceFixture,
): Promise<void> => {
  const recoveryRequest = {
    ...(fixture.buildRequest(99) as Record<string, unknown>),
    requestId: "acceptance-next-day-recovery",
    promptPackageId: "acceptance-next-day-recovery-package",
  };
  const recoveryFailureGateway: AiInputGatewayAbilityGroup = {
    abilityGroupId: "ai-input-gateway",
    listChildCapabilityIds: () => ["feed-gpt-web-chat-once"],
    getRuntimeCapacity: () => 10,
    async execute(input: unknown, options): Promise<AiFeedResult> {
      const request = input as AiFeedInput;
      await options?.onProgress?.({
        phase: "waiting_provider",
        occurredAt: new Date().toISOString(),
      });
      await options?.onProgress?.({
        phase: "recovery_pending",
        occurredAt: new Date().toISOString(),
      });
      return fixture.buildFailedResult(
        request,
        "simulated_process_interruption_after_submission",
      );
    },
  };

  process.env.XUANYUAN_RECOVERY_RETRY_BASE_MS = "10";
  const interruptedCoordinator = createXuanyuanTaskCoordinator({
    dataDir: fixture.dataDir,
    aiInputGateway: recoveryFailureGateway,
  });
  const interruptedTaskId = await runQueuedTaskToIdle(
    interruptedCoordinator,
    recoveryRequest,
  );
  const recoveryPending = (await getXuanyuanTaskStatus(
    { dataDir: fixture.dataDir },
    interruptedTaskId,
  ))!;
  assert.equal(recoveryPending.status, "recovery_pending");
  assert.equal(
    recoveryPending.recovery.recoveryDirective,
    "resume_exact_provider_conversation",
  );
  assert.ok(recoveryPending.recovery.nextRetryAt);

  await new Promise<void>((resolve) => setTimeout(resolve, 20));
  const resumedCoordinator = createXuanyuanTaskCoordinator({
    dataDir: fixture.dataDir,
    aiInputGateway: fixture.buildSuccessfulGateway(
      "{\"resumed\":\"without-resubmit\"}",
    ),
  });
  await resumeExistingQueueToIdle(resumedCoordinator);
  const recovered = (await getXuanyuanTaskStatus(
    { dataDir: fixture.dataDir },
    interruptedTaskId,
  ))!;
  assert.equal(recovered.status, "response_captured");
  assert.equal(recovered.taskId, interruptedTaskId);
  assert.equal(recovered.recovery.attemptCount, 2);
  assert.equal(recovered.rawResponseText, "{\"resumed\":\"without-resubmit\"}");
  delete process.env.XUANYUAN_RECOVERY_RETRY_BASE_MS;
};

const runAutomaticRecoveryAcceptance = async (
  fixture: RecoveryAcceptanceFixture,
): Promise<void> => {
  let automaticRecoveryAttempts = 0;
  const automaticRecoveryGateway: AiInputGatewayAbilityGroup = {
    abilityGroupId: "ai-input-gateway",
    listChildCapabilityIds: () => ["feed-gpt-web-chat-once"],
    getRuntimeCapacity: () => 10,
    async execute(input: unknown, options): Promise<AiFeedResult> {
      automaticRecoveryAttempts += 1;
      const request = input as AiFeedInput;
      if (automaticRecoveryAttempts === 1) {
        await options?.onProgress?.({
          phase: "recovery_pending",
          occurredAt: new Date().toISOString(),
        });
        return fixture.buildFailedResult(
          request,
          "provider composer unavailable",
        );
      }
      return fixture.buildSuccessfulGateway("{\"provider\":\"returned\"}")
        .execute(input, options);
    },
  };
  const automaticRecoveryRequest = {
    ...(fixture.buildRequest(100) as Record<string, unknown>),
    requestId: "acceptance-automatic-provider-return",
    promptPackageId: "acceptance-automatic-provider-return-package",
  };

  process.env.XUANYUAN_RECOVERY_RETRY_BASE_MS = "10";
  const automaticRecoveryCoordinator = createXuanyuanTaskCoordinator({
    dataDir: fixture.dataDir,
    aiInputGateway: automaticRecoveryGateway,
  });
  await automaticRecoveryCoordinator.init();
  const automaticallyRecovering = await automaticRecoveryCoordinator.enqueue(
    automaticRecoveryRequest,
  );
  await fixture.waitFor(async () =>
    (await getXuanyuanTaskStatus(
      { dataDir: fixture.dataDir },
      automaticallyRecovering.taskId,
    ))?.status === "response_captured");
  await automaticRecoveryCoordinator.close();
  delete process.env.XUANYUAN_RECOVERY_RETRY_BASE_MS;

  const automaticallyRecovered = (await getXuanyuanTaskStatus(
    { dataDir: fixture.dataDir },
    automaticallyRecovering.taskId,
  ))!;
  assert.equal(automaticRecoveryAttempts, 2);
  assert.equal(automaticallyRecovered.taskId, automaticallyRecovering.taskId);
  assert.equal(automaticallyRecovered.recovery.attemptCount, 2);
  assert.equal(automaticallyRecovered.recovery.nextRetryAt, null);
  assert.equal(
    automaticallyRecovered.rawResponseText,
    "{\"provider\":\"returned\"}",
  );
};

const runReviewStopsRecoveryAcceptance = async (
  fixture: RecoveryAcceptanceFixture,
): Promise<void> => {
  let executions = 0;
  const reviewGateway: AiInputGatewayAbilityGroup = {
    abilityGroupId: "ai-input-gateway",
    listChildCapabilityIds: () => ["feed-gpt-web-chat-once"],
    getRuntimeCapacity: () => 10,
    async execute(input: unknown, options): Promise<AiFeedResult> {
      executions += 1;
      await options?.onProgress?.({
        phase: "recovery_pending",
        occurredAt: new Date().toISOString(),
      });
      const failed = fixture.buildFailedResult(
        input as AiFeedInput,
        "exact conversation lookup exhausted",
      );
      return {
        ...failed,
        status: "review_required",
        failureReason: null,
        reviewRequiredReason: "exact conversation lookup exhausted",
      };
    },
  };
  const request = {
    ...(fixture.buildRequest(101) as Record<string, unknown>),
    requestId: "acceptance-review-stops-recovery",
    promptPackageId: "acceptance-review-stops-recovery-package",
  };
  const coordinator = createXuanyuanTaskCoordinator({
    dataDir: fixture.dataDir,
    aiInputGateway: reviewGateway,
  });
  const taskId = await runQueuedTaskToIdle(coordinator, request);
  const stopped = (await getXuanyuanTaskStatus(
    { dataDir: fixture.dataDir },
    taskId,
  ))!;
  assert.equal(stopped.status, "review_required");
  assert.equal(stopped.recovery.recoverable, false);
  assert.equal(stopped.recovery.nextRetryAt, null);
  assert.equal(executions, 1);

  const restarted = createXuanyuanTaskCoordinator({
    dataDir: fixture.dataDir,
    aiInputGateway: reviewGateway,
  });
  await resumeExistingQueueToIdle(restarted);
  assert.equal(executions, 1, "review_required must not query GPT after restart");
};

export const runXuanyuanRecoveryAcceptance = async (
  fixture: RecoveryAcceptanceFixture,
): Promise<void> => {
  await runRestartRecoveryAcceptance(fixture);
  await runAutomaticRecoveryAcceptance(fixture);
  await runReviewStopsRecoveryAcceptance(fixture);
};
