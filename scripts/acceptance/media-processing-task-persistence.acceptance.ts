import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";

import {
  createMediaProcessingAbilityGroupFromFilesystem,
  type MediaProcessingAbilityGroup,
  type MediaProcessingResult,
} from "../../src/capabilities/media-processing/index.js";
import { handleMediaProcessingRequest } from "../../src/app/workbench-media-processing-routes.js";
import type { GrassEyeWorkbenchHandle } from "../../src/lib/local-runtime/workbench-handle.js";

type TaskSnapshot = {
  taskId: string;
  status: string;
  failureReason?: string | null;
  record?: unknown;
};

type ControlledPromise<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const makeImage = async (filePath: string): Promise<void> => {
  await sharp({
    create: {
      width: 24,
      height: 24,
      channels: 3,
      background: { r: 40, g: 120, b: 210 },
    },
  }).png().toFile(filePath);
};

const createControlledPromise = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

const buildWorkbench = (dataDir: string, mediaProcessing: MediaProcessingAbilityGroup): GrassEyeWorkbenchHandle =>
  ({
    getDataDir: () => dataDir,
    getMediaProcessingAbilityGroup: () => mediaProcessing,
  }) as GrassEyeWorkbenchHandle;

const withServer = async <T>(
  workbench: GrassEyeWorkbenchHandle,
  deliveryDirectory: string,
  run: (baseUrl: string) => Promise<T>,
): Promise<T> => {
  const server = createServer((request, response) => {
    handleMediaProcessingRequest(request, response, workbench, deliveryDirectory).catch((error) => {
      response.statusCode = 500;
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    });
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    const address = server.address();
    assert.ok(address && typeof address === "object", "Acceptance server must expose a port.");
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  }
};

const postStart = async (baseUrl: string, filePath: string, body: Record<string, unknown> = {}): Promise<Response> =>
  fetch(`${baseUrl}/api/media-processing/start-async`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileName: path.basename(filePath),
      fileContentBase64: (await readFile(filePath)).toString("base64"),
      presetId: "web-image",
      outputFormat: "webp",
      ...body,
    }),
  });

const readTask = async (baseUrl: string, taskId: string): Promise<TaskSnapshot> =>
  fetch(`${baseUrl}/api/media-processing/status?taskId=${encodeURIComponent(taskId)}`)
    .then((response) => response.json() as Promise<TaskSnapshot>);

const assertEventually = async (
  read: () => Promise<TaskSnapshot>,
  predicate: (task: TaskSnapshot) => boolean,
  message: string,
): Promise<TaskSnapshot> => {
  let current = await read();
  for (let index = 0; index < 20 && !predicate(current); index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    current = await read();
  }
  assert.ok(predicate(current), message);
  return current;
};

const runInitialSnapshotFailureAcceptance = async (acceptanceRoot: string): Promise<void> => {
  const dataDir = path.join(acceptanceRoot, "initial-persist");
  await mkdir(dataDir, { recursive: true });
  const inputFilePath = path.join(dataDir, "source.png");
  await makeImage(inputFilePath);
  const taskPathBlocker = path.join(dataDir, "runtime-data", "media-processing-tasks");
  await mkdir(path.dirname(taskPathBlocker), { recursive: true });
  await writeFile(taskPathBlocker, "not a directory");
  const mediaProcessing = createMediaProcessingAbilityGroupFromFilesystem({ dataDir });
  await withServer(
    buildWorkbench(dataDir, mediaProcessing),
    path.join(acceptanceRoot, "initial-delivery"),
    async (baseUrl) => {
    const response = await postStart(baseUrl, inputFilePath);
    const payload = await response.json() as TaskSnapshot;
    assert.equal(response.status, 500, "Initial snapshot write failure must fail the async start.");
    assert.equal(payload.status, "failed");
    assert.ok(payload.failureReason?.startsWith("media_processing_task_persistence_failed"));
    },
  );
};

const createControlledMediaProcessing = (dataDir: string): {
  first: ControlledPromise<MediaProcessingResult>;
  second: ControlledPromise<MediaProcessingResult>;
  mediaProcessing: MediaProcessingAbilityGroup;
} => {
  const first = createControlledPromise<MediaProcessingResult>();
  const second = createControlledPromise<MediaProcessingResult>();
  const mediaProcessing = createMediaProcessingAbilityGroupFromFilesystem({ dataDir });
  let calls = 0;
  mediaProcessing.processMedia = async () => {
    calls += 1;
    if (calls === 1) return first.promise;
    if (calls === 2) return second.promise;
    return first.promise;
  };
  return {
    first,
    second,
    mediaProcessing,
  };
};

const blockTaskPersistenceWrites = async (dataDir: string): Promise<void> => {
  const tasksDir = path.join(dataDir, "runtime-data", "media-processing-tasks");
  await rm(tasksDir, { recursive: true, force: true });
  await writeFile(tasksDir, "terminal writes blocked");
};

const prepareTerminalPersistenceFixture = async (dataDir: string): Promise<{
  dataDir: string;
  inputFilePath: string;
  successResult: MediaProcessingResult;
}> => {
  await mkdir(dataDir, { recursive: true });
  const inputFilePath = path.join(dataDir, "source.png");
  await makeImage(inputFilePath);
  const successResult = await createMediaProcessingAbilityGroupFromFilesystem({ dataDir }).processMedia({
    missionId: "acceptance",
    runId: "acceptance",
    inputFilePath,
    presetId: "web-image",
    outputFormat: "webp",
    artifactPolicy: "deliverable",
  });
  return { dataDir, inputFilePath, successResult };
};

const startTwoTasksAndAssertConcurrency = async (
  baseUrl: string,
  inputFilePath: string,
): Promise<{ startedOne: TaskSnapshot; startedTwo: TaskSnapshot }> => {
  const startedOne = await postStart(baseUrl, inputFilePath).then((response) => response.json() as Promise<TaskSnapshot>);
  const startedTwo = await postStart(baseUrl, inputFilePath).then((response) => response.json() as Promise<TaskSnapshot>);
  assert.equal(startedOne.status, "running");
  assert.equal(startedTwo.status, "running");
  const rejected = await postStart(baseUrl, inputFilePath);
  assert.equal(rejected.status, 429, "A third running media-processing task must be rejected.");
  const rejectedBody = await rejected.json() as { error?: string };
  assert.equal(rejectedBody.error, "media_processing_concurrency_limit_reached");
  return { startedOne, startedTwo };
};

const assertTerminalPersistenceFailure = async (
  baseUrl: string,
  taskId: string,
): Promise<void> => {
  const terminal = await assertEventually(
    () => readTask(baseUrl, taskId),
    (task) => task.status === "failed" && Boolean(task.failureReason?.startsWith("media_processing_task_persistence_failed")),
    "Terminal snapshot write failure must turn the task into a failed task.",
  );
  assert.ok(terminal.failureReason?.includes("media_processing_task_persistence_failed"));
};

const runTerminalSnapshotFailureAndConcurrencyAcceptance = async (acceptanceRoot: string): Promise<void> => {
  const dataDir = path.join(acceptanceRoot, "terminal-persist");
  const { inputFilePath, successResult } = await prepareTerminalPersistenceFixture(dataDir);
  const { first, second, mediaProcessing } = createControlledMediaProcessing(dataDir);
  await withServer(
    buildWorkbench(dataDir, mediaProcessing),
    path.join(acceptanceRoot, "terminal-delivery"),
    async (baseUrl) => {
    const { startedOne } = await startTwoTasksAndAssertConcurrency(baseUrl, inputFilePath);
    await blockTaskPersistenceWrites(dataDir);
    first.resolve(successResult);
    await assertTerminalPersistenceFailure(baseUrl, startedOne.taskId);
    second.resolve(successResult);
    },
  );
};

const runInterruptedRunningSnapshotAcceptance = async (acceptanceRoot: string): Promise<void> => {
  const dataDir = path.join(acceptanceRoot, "interrupted");
  await mkdir(dataDir, { recursive: true });
  const taskId = `media_processing_${randomUUID()}`;
  const tasksDir = path.join(dataDir, "runtime-data", "media-processing-tasks");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(path.join(tasksDir, `${taskId}.json`), `${JSON.stringify({
    taskId,
    status: "running",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    presetId: "web-image",
    sourceFileName: "source.png",
    record: null,
    downloadsPaths: [],
    failureReason: null,
  })}\n`);
  const mediaProcessing = createMediaProcessingAbilityGroupFromFilesystem({ dataDir });
  await withServer(
    buildWorkbench(dataDir, mediaProcessing),
    path.join(acceptanceRoot, "interrupted-delivery"),
    async (baseUrl) => {
    const interrupted = await readTask(baseUrl, taskId);
    assert.equal(interrupted.status, "failed");
    assert.equal(interrupted.failureReason, "media_processing_task_interrupted_before_completion");
    },
  );
};

const runDownloadsCopyFailureAcceptance = async (acceptanceRoot: string): Promise<void> => {
  const dataDir = path.join(acceptanceRoot, "downloads-failure");
  const uploadDir = path.join(dataDir, "runtime-data", "media-processing-uploads", "downloads-failure");
  await mkdir(uploadDir, { recursive: true });
  const inputFilePath = path.join(uploadDir, "source.png");
  await makeImage(inputFilePath);
  const outsideArtifactPath = path.join(acceptanceRoot, "outside-artifact", "artifact.webp");
  await mkdir(path.dirname(outsideArtifactPath), { recursive: true });
  await writeFile(outsideArtifactPath, "artifact");
  const result = await createMediaProcessingAbilityGroupFromFilesystem({ dataDir }).processMedia({
    missionId: "acceptance",
    runId: "acceptance-outside-artifact",
    inputFilePath,
    presetId: "web-image",
    outputFormat: "webp",
    artifactPolicy: "deliverable",
  });
  assert.equal(result.output.status, "success");
  const [artifact] = result.output.outputArtifacts;
  assert.ok(artifact, "Downloads failure fixture must produce an owner result artifact.");
  const outsideResult: MediaProcessingResult = {
    ...result,
    output: {
      ...result.output,
      outputArtifacts: [{
        ...artifact,
        storageRef: outsideArtifactPath,
        filePath: outsideArtifactPath,
      }],
    },
    runtimeProof: {
      ...result.runtimeProof,
      outputArtifacts: [{
        ...artifact,
        storageRef: outsideArtifactPath,
        filePath: outsideArtifactPath,
      }],
    },
  };
  const mediaProcessing = createMediaProcessingAbilityGroupFromFilesystem({ dataDir });
  mediaProcessing.processMedia = async () => outsideResult;
  await withServer(
    buildWorkbench(dataDir, mediaProcessing),
    path.join(acceptanceRoot, "downloads-delivery"),
    async (baseUrl) => {
    const started = await postStart(baseUrl, inputFilePath, { saveToDownloads: true })
      .then((response) => response.json() as Promise<TaskSnapshot>);
    const failed = await assertEventually(
      () => readTask(baseUrl, started.taskId),
      (task) => task.status === "failed",
      "Downloads copy failure must fail the async task.",
    );
    assert.equal(failed.failureReason, "media_processing_download_outside_workbench_data");
    },
  );
};

const acceptanceRoot = await mkdtemp(path.join(tmpdir(), "grasseye-mp-persistence-"));
try {
  await runInitialSnapshotFailureAcceptance(acceptanceRoot);
  await runTerminalSnapshotFailureAndConcurrencyAcceptance(acceptanceRoot);
  await runInterruptedRunningSnapshotAcceptance(acceptanceRoot);
  await runDownloadsCopyFailureAcceptance(acceptanceRoot);
} finally {
  await rm(acceptanceRoot, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE][media-processing-task-persistence] PASS\n");
