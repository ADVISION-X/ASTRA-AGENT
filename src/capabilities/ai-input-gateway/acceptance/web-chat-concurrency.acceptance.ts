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
import { buildHumanReadableSystemChatTitle } from "../runtime/web-chat-system-title.js";

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
  promptPackageId: `parallel-worker-${worker}`,
  promptContractId: "ai-input-gateway-web-chat-concurrency.acceptance",
  expectedOutputSchemaRef: null,
  textPrompt: `parallel worker ${worker}`,
  inputRefs: [],
  modelName: null,
  timeoutMs: 10_000,
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
      await waitFor(() => exists(path.join(dataDir, "release-all")));
      return {
        rawText: `parallel response ${worker}`,
        modelName: "acceptance-fixture",
        runtimeName: "acceptance-fixture",
        transport: "web-chat",
        webChatUrl: `https://chatgpt.com/c/parallel-${worker}`,
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
  assert.equal(result.status, "success");
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

const workerArgs = process.argv.slice(2);
if (workerArgs[0] === "--worker") {
  const dataDir = workerArgs[1];
  const worker = Number(workerArgs[2]);
  if (!dataDir || !Number.isInteger(worker))
    throw new Error("invalid concurrency worker arguments");
  await runWorker(dataDir, worker);
} else {
  const seoTitle = buildHumanReadableSystemChatTitle({
    promptContractId: "public-knowledge-corpus-research.v2",
    executionId: "xuanyuan_example-seo-task",
    turnMarker: "GRASSEYE_TURN_1234567890abcdef",
    createdAt: "2026-07-26T04:40:00.000Z",
  });
  assert.match(
    seoTitle,
    /^SEO文章｜07-26 04:40Z｜[A-F0-9]{8}-CDEF$/u,
    "SEO conversations must have a readable task label, UTC time and short trace",
  );
  assert.doesNotMatch(
    seoTitle,
    /public-knowledge|xuanyuan|GRASSEYE_TURN/u,
    "readable titles must not expose transport ids or raw contract vocabulary",
  );
  assert.match(
    buildHumanReadableSystemChatTitle({
      promptContractId: "bazi-base-interpretation-v2",
      executionId: "xuanyuan_example-bazi-task",
      turnMarker: "GRASSEYE_TURN_abcdef1234567890",
      createdAt: "2026-07-26T04:41:00.000Z",
    }),
    /^八字分析｜07-26 04:41Z｜[A-F0-9]{8}-7890$/u,
    "known business contracts must resolve to a human-readable allowlisted label",
  );
  assert.match(
    buildHumanReadableSystemChatTitle({
      promptContractId: "unrecognized-contract",
      executionId: "xuanyuan_example-generic-task",
      turnMarker: "GRASSEYE_TURN_1234567890abcdef",
      createdAt: "2026-07-26T04:42:00.000Z",
    }),
    /^AI任务｜07-26 04:42Z｜[A-F0-9]{8}-CDEF$/u,
    "unknown contracts must use the neutral internal fallback without copying caller text",
  );

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
    const firstTen = Array.from({ length: 10 }, (_, index) =>
      spawnWorker(index + 1),
    );
    await waitFor(async () =>
      (
        await Promise.all(
          Array.from({ length: 10 }, (_, index) =>
            exists(path.join(dataDir, `entered-${index + 1}`)),
          ),
        )
      ).every(Boolean),
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
            capacitySlot: number | null;
            status: string;
            systemChatTitle: string | null;
          },
      ),
    );
    assert.deepEqual(
      firstTenStates
        .map((state) => state.capacitySlot)
        .sort((a, b) => Number(a) - Number(b)),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      "ten real in-flight tasks must own ten distinct bounded capacity slots",
    );
    assert.equal(
      firstTenStates.every((state) =>
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

    const releaseQueuedSubmission =
      registerPendingWebChatSubmission("queued-submission");
    assert.equal(pendingWebChatSubmissionCount(), 1);
    let patrolEntered = false;
    const patrolPromise = acquireWebChatBrowserPatrolLease({
      dataDir,
      timeoutMs: 2_000,
    }).then((lease) => {
      patrolEntered = true;
      return lease;
    });
    await delay(250);
    assert.equal(
      patrolEntered,
      false,
      "provider patrol must not overtake an accepted task waiting to submit",
    );
    const prioritySubmission = await acquireWebChatBrowserMutationLease({
      dataDir,
      timeoutMs: 2_000,
    });
    await prioritySubmission.release();
    releaseQueuedSubmission();
    assert.equal(pendingWebChatSubmissionCount(), 0);
    const patrolLease = await patrolPromise;
    await patrolLease.release();

    const sharedSource = await readFile(
      path.join(
        process.cwd(),
        "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts",
      ),
      "utf8",
    );
    const titleSource = await readFile(
      path.join(
        process.cwd(),
        "src/capabilities/ai-input-gateway/providers/web-chat-chat-title.ts",
      ),
      "utf8",
    );
    const answerEvaluationSource = await readFile(
      path.join(
        process.cwd(),
        "src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts",
      ),
      "utf8",
    );
    const rateLimitWatcherSource = await readFile(
      path.join(
        process.cwd(),
        "src/capabilities/ai-input-gateway/providers/web-chat-rate-limit-dialog.ts",
      ),
      "utf8",
    );
    const answerSupportSource = await readFile(
      path.join(
        process.cwd(),
        "src/capabilities/ai-input-gateway/providers/web-chat-answer-support.ts",
      ),
      "utf8",
    );
    const singleTabRoutingSource = await readFile(
      path.join(
        process.cwd(),
        "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-routing.ts",
      ),
      "utf8",
    );
    const managedExecutionSource = await readFile(
      path.join(
        process.cwd(),
        "src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution.ts",
      ),
      "utf8",
    );
    const submitFlow = sharedSource.slice(
      sharedSource.indexOf("const executeWebChatConversation"),
      sharedSource.indexOf("const executeOpenedWebChatAdapter"),
    );
    const completedFlow = sharedSource.slice(
      sharedSource.indexOf("const buildCompletedWebChatResponse"),
      sharedSource.indexOf("const executeWebChatConversation"),
    );
    assert.equal(
      submitFlow.includes("renameSubmittedChatGptConversation"),
      false,
      "submission must release the browser mutation lane without waiting for rename",
    );
    assert.equal(
      completedFlow.includes("renameSubmittedChatGptConversation"),
      true,
      "the exact conversation must be renamed only after response completion",
    );
    assert.equal(
      titleSource.includes("(?!WEB:)"),
      true,
      "transient ChatGPT WEB sidebar rows must never be rename targets",
    );
    assert.equal(
      titleSource.includes('CHATGPT_CONVERSATION_ROW_SELECTOR = "li"')
        && titleSource.includes("link.closest(${JSON.stringify(CHATGPT_CONVERSATION_ROW_SELECTOR)})"),
      true,
      "rename options must be scoped to the exact sidebar conversation row",
    );
    assert.equal(
      titleSource.includes("depth < 7"),
      false,
      "rename targeting must not climb into the page-header conversation menu",
    );
    assert.equal(
      answerEvaluationSource.includes("visibleProgressClass")
        && answerEvaluationSource.includes("[class*='shimmer']"),
      true,
      "a visible ChatGPT loading or shimmer progress node must keep the exact turn in generating state",
    );
    assert.equal(
      answerSupportSource.includes("WEB_CHAT_BOUND_CONVERSATION_NOT_READY")
        && singleTabRoutingSource.includes("WEB_CHAT_BOUND_CONVERSATION_NOT_READY"),
      true,
      "an automatic sidebar row that has not materialized yet must remain retryable patrol state",
    );
    assert.equal(
      rateLimitWatcherSource.includes("sharedAcknowledgementWatchers")
        && rateLimitWatcherSource.includes("refCount"),
      true,
      "one shared immediate acknowledgement watcher must serve all managed conversations",
    );
    assert.equal(
      managedExecutionSource.includes("releasePendingSubmission")
        && managedExecutionSource.includes("globalBrowser"),
      true,
      "submission priority and the unrouted global survival lane must be wired into managed execution",
    );

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
