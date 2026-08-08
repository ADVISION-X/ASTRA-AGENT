import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAiInputGatewayAbilityGroup,
  type AiFeedInput,
  type AiProviderAdapter,
} from "../index.js";
import {
  advanceStableAnswer,
  createStableAnswerState,
} from "../providers/web-chat-answer-support.js";
import {
  acquireWebChatBrowserMutationLease,
  acquireWebChatBrowserPatrolLease,
  pendingWebChatSubmissionCount,
  registerPendingWebChatSubmission,
} from "../runtime/web-chat-concurrency-lease.js";
import {
  startOrResumeWebChatExecution,
  updateWebChatExecution,
} from "../runtime/web-chat-execution-state.js";
import {
  assertFailureLedger,
  assertResponseCheckpointRecovery,
} from "./web-chat-recovery.acceptance-helper.js";
import { assertWebChatSourceContracts } from "./web-chat-source-contract.acceptance-helper.js";
import { assertTransientPatrolRemainsRetryable } from "./web-chat-transient-patrol.acceptance-helper.js";
import { assertWebChatIdentityAndRecoveryPolicies } from "./web-chat-identity-recovery.acceptance-helper.js";

const delay = (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

const exists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const waitFor = async (
  predicate: () => Promise<boolean>,
  timeoutMs = 8_000,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(25);
  }
  throw new Error(
    "timed out waiting for web-chat concurrency acceptance condition",
  );
};

const requestFor = (worker: number): AiFeedInput => ({
  providerKind: "gpt-web-chat",
  taskIdentity: {
    labelKey: "system_acceptance",
    sourceProject: "agent",
    taskKind: "web-chat-concurrency",
    sourceTaskId: `parallel-worker-${worker}`,
  },
  promptPackageId: `parallel-worker-${worker}`,
  promptContractId: "ai-input-gateway-web-chat-concurrency.acceptance",
  expectedOutputSchemaRef: null,
  expectedOutputKind: "text",
  textPrompt: `parallel worker ${worker}`,
  inputRefs: [],
  modelName: null,
  timeoutMs: 60_000,
  maxInputChars: 1_000,
  maxFileCount: 0,
  maxFileBytes: 1,
  requestedBy: "acceptance-test",
  missionId: "parallel-acceptance",
  runId: `parallel-worker-${worker}`,
  roundId: `parallel-worker-${worker}`,
});

const runWorker = async (dataDir: string, worker: number): Promise<void> => {
  const adapter: AiProviderAdapter = {
    providerKind: "gpt-web-chat",
    async feed() {
      await writeFile(
        path.join(dataDir, `entered-${worker}`),
        String(worker),
        "utf8",
      );
      await waitFor(
        () => exists(path.join(dataDir, "release-all")),
        30_000,
      );
      const conversationUrl = `https://chatgpt.com/c/parallel-${worker}`;
      const submittedAt = new Date().toISOString();
      return {
        rawText: `parallel response ${worker}`,
        modelName: "acceptance-fixture",
        runtimeName: "acceptance-fixture",
        transport: "web-chat",
        webChatUrl: conversationUrl,
        submissionProof: {
          executionId: `parallel-execution-${worker}`,
          turnMarker: `parallel-turn-${worker}`,
          transientConversationUrl: conversationUrl,
          canonicalConversationUrl: conversationUrl,
          systemChatTitle: null,
          observedAutoChatTitle: null,
          chatTitleVerifiedAt: null,
          userTurnId: `parallel-user-turn-${worker}`,
          previousAssistantCount: 0,
          previousUserMessageCount: 0,
          submittedAt,
        },
        sourcePageUrlBeforeFeed: null,
        restoredSourcePage: null,
      };
    },
  };
  const gateway = createAiInputGatewayAbilityGroup({
    dataDir,
    adapters: { "gpt-web-chat": adapter },
  });
  const result = await gateway.execute(requestFor(worker), {
    executionId: `parallel-execution-${worker}`,
  });
  assert.equal(
    result.status,
    "success",
    JSON.stringify({
      worker,
      failureReason: result.failureReason,
      reviewRequiredReason: result.reviewRequiredReason,
      providerProof: result.providerProof,
    }),
  );
  assert.match(
    result.providerProof.providerLeaseId ?? "",
    /^web-chat-capacity:/u,
  );
  await writeFile(
    path.join(dataDir, `result-${worker}.json`),
    JSON.stringify(result),
    "utf8",
  );
};

const assertTopologyProofIsRequired = async (
  dataDir: string,
): Promise<void> => {
  const adapter: AiProviderAdapter = {
    providerKind: "gpt-web-chat",
    async feed() {
      return {
        rawText: "unproved provider response",
        modelName: "acceptance-fixture",
        runtimeName: "acceptance-fixture",
        transport: "web-chat",
        webChatUrl: "https://chatgpt.com/c/unproved-topology",
        sourcePageUrlBeforeFeed: null,
        restoredSourcePage: null,
      };
    },
  };
  const gateway = createAiInputGatewayAbilityGroup({
    dataDir,
    adapters: { "gpt-web-chat": adapter },
  });
  const result = await gateway.execute(requestFor(103), {
    executionId: "unproved-topology-execution",
  });
  assert.notEqual(result.status, "success");
  assert.match(
    result.failureReason ?? result.reviewRequiredReason ?? "",
    /CONVERSATION_TOPOLOGY_PROOF_MISSING/u,
    "web-chat output without its exact topology proof must fail closed",
  );
};

const workerArgs = process.argv.slice(2);
if (workerArgs[0] === "--worker") {
  const dataDir = workerArgs[1];
  const worker = Number(workerArgs[2]);
  if (!dataDir || !Number.isInteger(worker))
    throw new Error("invalid concurrency worker arguments");
  await runWorker(dataDir, worker);
} else {
  await assertWebChatIdentityAndRecoveryPolicies();

  await assertTransientPatrolRemainsRetryable();

  const dataDir = await mkdtemp(
    path.join(os.tmpdir(), "grasseye-web-chat-concurrency-"),
  );
  const scriptPath = fileURLToPath(import.meta.url);
  const spawnWorker = (worker: number) =>
    spawn(
      process.execPath,
      ["--import", "tsx", scriptPath, "--worker", dataDir, String(worker)],
      {
        cwd: process.cwd(),
        env: { ...process.env, WEB_CHAT_MAX_IN_FLIGHT: "10" },
        stdio: "inherit",
      },
    );
  const waitForExit = (child: ReturnType<typeof spawnWorker>): Promise<void> =>
    new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        if (code === 0) resolve();
        else
          reject(
            new Error(
              `parallel worker exited code=${String(code)} signal=${String(signal)}`,
            ),
          );
      });
    });

  try {
    const repairInput = {
      dataDir,
      executionId: "transient-pre-submit-repair",
      providerKind: "gpt-web-chat" as const,
      taskLabelKey: "system_acceptance" as const,
      inputHash: "fixture-transient-input-hash",
      textPrompt: "fixture transient prompt",
    };
    const repairStarted = await startOrResumeWebChatExecution(repairInput);
    await updateWebChatExecution({
      dataDir,
      record: repairStarted.record,
      patch: {
        status: "failed",
        failures: [{
          occurredAt: new Date().toISOString(),
          attemptId: repairStarted.record.attemptId,
          phase: "submitting",
          classification: "failed",
          recoverable: false,
          reason: "GPT_PROMPT_MISMATCH; 不能获取对象。 (-1728)",
        }],
      },
    });
    const repaired = await startOrResumeWebChatExecution(repairInput);
    assert.equal(
      repaired.record.status,
      "recovery_pending",
      "a persisted pre-submit browser interruption must be reclassified without changing execution identity",
    );
    assert.equal(repaired.resume, false);
    assert.equal(repaired.record.failures.length, 1, "repair must retain the original failure ledger");

    await assertResponseCheckpointRecovery(dataDir, requestFor(101));
    await assertFailureLedger(dataDir, requestFor(102));
    await assertTopologyProofIsRequired(dataDir);
    const firstTen = Array.from({ length: 10 }, (_, index) =>
      spawnWorker(index + 1),
    );
    await waitFor(
      async () =>
        (
          await Promise.all(
            Array.from({ length: 10 }, (_, index) =>
              exists(path.join(dataDir, `entered-${index + 1}`)),
            ),
          )
        ).every(Boolean),
      30_000,
    );
    const executionDir = path.join(
      dataDir,
      "runtime-data",
      "ai-input-gateway",
      "web-chat-executions",
    );
    const firstTenStates = await Promise.all(
      (await readdir(executionDir)).map(
        async (name) =>
          JSON.parse(await readFile(path.join(executionDir, name), "utf8")) as {
            executionId: string;
            capacitySlot: number | null;
            status: string;
            systemChatTitle: string | null;
          },
      ),
    );
    const activeFirstTenStates = firstTenStates.filter(
      (state) => state.executionId.startsWith("parallel-execution-")
        && state.status !== "response_captured",
    );
    assert.deepEqual(
      activeFirstTenStates
        .map((state) => state.capacitySlot)
        .sort((a, b) => Number(a) - Number(b)),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      "ten real in-flight tasks must own ten distinct bounded capacity slots",
    );
    assert.equal(
      activeFirstTenStates.every((state) =>
        /^系统验收｜\d{2}-\d{2} \d{2}:\d{2}Z｜[A-F0-9]{8}-[A-F0-9]{4}$/u
          .test(state.systemChatTitle ?? "")
      ),
      true,
      "new GPT executions must persist only the human-readable system title format",
    );

    const eleventh = spawnWorker(11);
    await delay(300);
    assert.equal(
      await exists(path.join(dataDir, "entered-11")),
      false,
      "N+1 must wait while all ten configured in-flight slots are occupied",
    );
    await writeFile(path.join(dataDir, "release-all"), "release", "utf8");
    await Promise.all([...firstTen.map(waitForExit), waitForExit(eleventh)]);
    assert.equal(await exists(path.join(dataDir, "entered-11")), true);

    const firstMutation = await acquireWebChatBrowserMutationLease({
      dataDir,
      timeoutMs: 2_000,
    });
    let secondMutationEntered = false;
    const secondMutationPromise = acquireWebChatBrowserMutationLease({
      dataDir,
      timeoutMs: 2_000,
    }).then((lease) => {
      secondMutationEntered = true;
      return lease;
    });
    await delay(250);
    assert.equal(
      secondMutationEntered,
      false,
      "attachment/prompt browser mutation must remain globally N=1",
    );
    await firstMutation.release();
    const secondMutation = await secondMutationPromise;
    await secondMutation.release();

    const releaseQueuedSubmission = registerPendingWebChatSubmission(
      dataDir,
      "queued-submission",
    );
    assert.equal(pendingWebChatSubmissionCount(dataDir), 1);
    const patrolEntryOrder: string[] = [];
    const firstPatrolPromise = acquireWebChatBrowserPatrolLease({
      dataDir,
      executionId: "first-patrol",
      timeoutMs: 4_000,
    }).then((lease) => {
      patrolEntryOrder.push("first-patrol");
      return lease;
    });
    await delay(100);
    const secondPatrolPromise = acquireWebChatBrowserPatrolLease({
      dataDir,
      executionId: "second-patrol",
      timeoutMs: 4_000,
    }).then((lease) => {
      patrolEntryOrder.push("second-patrol");
      return lease;
    });
    await delay(250);
    assert.equal(
      patrolEntryOrder.length,
      0,
      "provider patrol must not overtake an accepted task waiting to submit",
    );
    const prioritySubmission = await acquireWebChatBrowserMutationLease({
      dataDir,
      timeoutMs: 2_000,
    });
    await prioritySubmission.release();
    releaseQueuedSubmission();
    assert.equal(pendingWebChatSubmissionCount(dataDir), 0);
    const firstPatrolLease = await firstPatrolPromise;
    assert.deepEqual(
      patrolEntryOrder,
      ["first-patrol"],
      "durable patrol tickets must preserve FIFO admission",
    );
    await firstPatrolLease.release();
    const secondPatrolLease = await secondPatrolPromise;
    assert.deepEqual(
      patrolEntryOrder,
      ["first-patrol", "second-patrol"],
      "the second patrol may enter only after the first patrol releases the browser",
    );
    await secondPatrolLease.release();

    await assertWebChatSourceContracts();

    let stableAnswerState = createStableAnswerState();
    const quietWindowStartedAt = stableAnswerState.lastActivityAt;
    const partialAnswer = {
      status: "success" as const,
      message: "partial streamed answer",
      answerText: '{"',
      pageUrl: "https://chatgpt.com/c/partial",
      generating: false,
      assistantCount: 1,
      userMessageCount: 1,
      conversationTurnIds: ["conversation-turn-1", "conversation-turn-2"],
    };
    let stableAnswerProgress = advanceStableAnswer({
      evaluation: partialAnswer,
      minStableDurationMs: 3_000,
      now: quietWindowStartedAt,
      stableRoundsRequired: 2,
      state: stableAnswerState,
    });
    stableAnswerState = stableAnswerProgress.nextState;
    stableAnswerProgress = advanceStableAnswer({
      evaluation: partialAnswer,
      minStableDurationMs: 3_000,
      now: quietWindowStartedAt + 1_500,
      stableRoundsRequired: 2,
      state: stableAnswerState,
    });
    assert.equal(
      stableAnswerProgress.successEvaluation,
      null,
      "an unchanged partial stream must not complete before the quiet window",
    );
    stableAnswerProgress = advanceStableAnswer({
      evaluation: partialAnswer,
      minStableDurationMs: 3_000,
      now: quietWindowStartedAt + 3_000,
      stableRoundsRequired: 2,
      state: stableAnswerProgress.nextState,
    });
    assert.equal(stableAnswerProgress.successEvaluation?.answerText, '{"');
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }

  process.stdout.write(
    "[ACCEPTANCE][ai-input-gateway-web-chat-concurrency] PASS\n",
  );
}
