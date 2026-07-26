import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
import { acquireWebChatBrowserMutationLease } from "../runtime/web-chat-concurrency-lease.js";

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

const waitFor = async (predicate: () => Promise<boolean>, timeoutMs = 8_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(25);
  }
  throw new Error("timed out waiting for web-chat concurrency acceptance condition");
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
      await writeFile(path.join(dataDir, `entered-${worker}`), String(worker), "utf8");
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
  assert.match(result.providerProof.providerLeaseId ?? "", /^web-chat-capacity:/u);
  await writeFile(path.join(dataDir, `result-${worker}.json`), JSON.stringify(result), "utf8");
};

const workerArgs = process.argv.slice(2);
if (workerArgs[0] === "--worker") {
  const dataDir = workerArgs[1];
  const worker = Number(workerArgs[2]);
  if (!dataDir || !Number.isInteger(worker)) throw new Error("invalid concurrency worker arguments");
  await runWorker(dataDir, worker);
} else {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "grasseye-web-chat-concurrency-"));
  const scriptPath = fileURLToPath(import.meta.url);
  const spawnWorker = (worker: number) => spawn(
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
        else reject(new Error(`parallel worker exited code=${String(code)} signal=${String(signal)}`));
      });
    });

  try {
    const firstTen = Array.from({ length: 10 }, (_, index) => spawnWorker(index + 1));
    await waitFor(async () =>
      (await Promise.all(
        Array.from({ length: 10 }, (_, index) => exists(path.join(dataDir, `entered-${index + 1}`))),
      )).every(Boolean),
    );
    const executionDir = path.join(
      dataDir,
      "runtime-data",
      "ai-input-gateway",
      "web-chat-executions",
    );
    const firstTenStates = await Promise.all(
      (await readdir(executionDir)).map(async (name) =>
        JSON.parse(await readFile(path.join(executionDir, name), "utf8")) as {
          capacitySlot: number | null;
          status: string;
        }),
    );
    assert.deepEqual(
      firstTenStates.map((state) => state.capacitySlot).sort((a, b) => Number(a) - Number(b)),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      "ten real in-flight tasks must own ten distinct bounded capacity slots",
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

  process.stdout.write("[ACCEPTANCE][ai-input-gateway-web-chat-concurrency] PASS\n");
}
