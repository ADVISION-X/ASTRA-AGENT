import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";

import {
  MEDIA_PROCESSING_ABILITY_GROUP_ID,
  type MediaProcessingAbilityGroup,
  type MediaProcessingPublicRequest,
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

const buildSuccessResult = (input: MediaProcessingPublicRequest, artifactFilePath: string): MediaProcessingResult => {
  const now = new Date().toISOString();
  const artifact = {
    artifactRef: `mp_artifact_${randomUUID()}`,
    storageRef: artifactFilePath,
    filePath: artifactFilePath,
    contentType: "image/webp",
    byteSize: 12,
    sha256: "a".repeat(64),
    width: 24,
    height: 24,
    durationMs: null,
    format: "webp",
    videoCodec: null,
    audioCodec: null,
    fastStart: null,
    targetMaxBytes: null,
    targetBitrateKbps: null,
    compressionRatio: null,
    derivativeKind: "optimized" as const,
  };
  const proof = {
    proofId: `mp_proof_${randomUUID()}`,
    missionId: input.missionId,
    runId: input.runId,
    capabilityCallId: `acceptance_${randomUUID()}`,
    abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
    childCapabilityId: input.childCapabilityId,
    status: "success" as const,
    failureReason: null,
    reviewRequiredReason: null,
    inputFilePath: input.inputFilePath,
    inputByteSize: null,
    outputArtifacts: [artifact],
    startedAt: now,
    endedAt: now,
    durationMsTotal: 0,
  };
  return {
    abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
    childCapabilityId: input.childCapabilityId,
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    output: {
      status: "success",
      outputArtifacts: [artifact],
      proofRef: proof.proofId,
    },
    runtimeProof: proof,
  };
};

const buildWorkbench = (dataDir: string, mediaProcessing: MediaProcessingAbilityGroup): GrassEyeWorkbenchHandle =>
  ({
    getDataDir: () => dataDir,
    getMediaProcessingAbilityGroup: () => mediaProcessing,
  }) as GrassEyeWorkbenchHandle;

const startServer = async (workbench: GrassEyeWorkbenchHandle) => {
  const server = createServer((request, response) => {
    handleMediaProcessingRequest(request, response, workbench).catch((error) => {
      response.statusCode = 500;
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object", "Acceptance server must expose a port.");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
};

const postStart = async (baseUrl: string, filePath: string, body: Record<string, unknown> = {}): Promise<Response> =>
  fetch(`${baseUrl}/api/media-processing/start-async`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileName: path.basename(filePath),
      fileContentBase64: (await readFile(filePath)).toString("base64"),
      childCapabilityId: "optimize-image-for-web-once",
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

const runInitialSnapshotFailureAcceptance = async (): Promise<void> => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-mp-initial-persist-"));
  const inputFilePath = path.join(dataDir, "source.png");
  await makeImage(inputFilePath);
  const taskPathBlocker = path.join(dataDir, "runtime-data", "media-processing-tasks");
  await mkdir(path.dirname(taskPathBlocker), { recursive: true });
  await writeFile(taskPathBlocker, "not a directory");
  const mediaProcessing = {
    abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
    listChildCapabilityIds: () => ["optimize-image-for-web-once"],
    processMedia: async (input: MediaProcessingPublicRequest) => buildSuccessResult(input, input.inputFilePath),
    execute: async () => {
      throw new Error("not used");
    },
  } as MediaProcessingAbilityGroup;
  const server = await startServer(buildWorkbench(dataDir, mediaProcessing));
  try {
    const response = await postStart(server.baseUrl, inputFilePath);
    const payload = await response.json() as TaskSnapshot;
    assert.equal(response.status, 500, "Initial snapshot write failure must fail the async start.");
    assert.equal(payload.status, "failed");
    assert.ok(payload.failureReason?.startsWith("media_processing_task_persistence_failed"));
  } finally {
    await server.close();
  }
};

const createControlledMediaProcessing = (artifactFilePath: string): {
  first: ControlledPromise<MediaProcessingResult>;
  second: ControlledPromise<MediaProcessingResult>;
  mediaProcessing: MediaProcessingAbilityGroup;
} => {
  const first = createControlledPromise<MediaProcessingResult>();
  const second = createControlledPromise<MediaProcessingResult>();
  let calls = 0;
  return {
    first,
    second,
    mediaProcessing: {
      abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
      listChildCapabilityIds: () => ["optimize-image-for-web-once"],
      processMedia: async (input: MediaProcessingPublicRequest) => {
        calls += 1;
        if (calls === 1) return first.promise;
        if (calls === 2) return second.promise;
        return buildSuccessResult(input, artifactFilePath);
      },
      execute: async () => {
        throw new Error("not used");
      },
    } as MediaProcessingAbilityGroup,
  };
};

const blockTaskPersistenceWrites = async (dataDir: string): Promise<void> => {
  const tasksDir = path.join(dataDir, "runtime-data", "media-processing-tasks");
  await rm(tasksDir, { recursive: true, force: true });
  await writeFile(tasksDir, "terminal writes blocked");
};

const buildImageRequest = (inputFilePath: string): MediaProcessingPublicRequest => ({
  missionId: "acceptance",
  runId: "acceptance",
  inputFilePath,
  childCapabilityId: "optimize-image-for-web-once",
  outputFormat: "webp",
  artifactPolicy: "deliverable",
});

const prepareTerminalPersistenceFixture = async (): Promise<{
  artifactFilePath: string;
  dataDir: string;
  inputFilePath: string;
}> => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-mp-terminal-persist-"));
  const inputFilePath = path.join(dataDir, "source.png");
  await makeImage(inputFilePath);
  const artifactDir = path.join(dataDir, "runtime-data", "media-processing-artifacts");
  await mkdir(artifactDir, { recursive: true });
  const artifactFilePath = path.join(artifactDir, "artifact.webp");
  await writeFile(artifactFilePath, "artifact");
  return { artifactFilePath, dataDir, inputFilePath };
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

const runTerminalSnapshotFailureAndConcurrencyAcceptance = async (): Promise<void> => {
  const { artifactFilePath, dataDir, inputFilePath } = await prepareTerminalPersistenceFixture();
  const { first, second, mediaProcessing } = createControlledMediaProcessing(artifactFilePath);
  const server = await startServer(buildWorkbench(dataDir, mediaProcessing));
  try {
    const { startedOne } = await startTwoTasksAndAssertConcurrency(server.baseUrl, inputFilePath);
    await blockTaskPersistenceWrites(dataDir);
    first.resolve(buildSuccessResult(buildImageRequest(inputFilePath), artifactFilePath));
    await assertTerminalPersistenceFailure(server.baseUrl, startedOne.taskId);
    second.resolve(buildSuccessResult(buildImageRequest(inputFilePath), artifactFilePath));
  } finally {
    await server.close();
  }
};

const runInterruptedRunningSnapshotAcceptance = async (): Promise<void> => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-mp-interrupted-"));
  const taskId = `media_processing_${randomUUID()}`;
  const tasksDir = path.join(dataDir, "runtime-data", "media-processing-tasks");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(path.join(tasksDir, `${taskId}.json`), `${JSON.stringify({
    taskId,
    status: "running",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    childCapabilityId: "optimize-image-for-web-once",
    sourceFileName: "source.png",
    record: null,
    downloadsPath: null,
    downloadsPaths: [],
    failureReason: null,
  })}\n`);
  const mediaProcessing = {
    abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
    listChildCapabilityIds: () => ["optimize-image-for-web-once"],
    processMedia: async (input: MediaProcessingPublicRequest) => buildSuccessResult(input, input.inputFilePath),
    execute: async () => {
      throw new Error("not used");
    },
  } as MediaProcessingAbilityGroup;
  const server = await startServer(buildWorkbench(dataDir, mediaProcessing));
  try {
    const interrupted = await readTask(server.baseUrl, taskId);
    assert.equal(interrupted.status, "failed");
    assert.equal(interrupted.failureReason, "media_processing_task_interrupted_before_completion");
  } finally {
    await server.close();
  }
};

const runDownloadsCopyFailureAcceptance = async (): Promise<void> => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-mp-downloads-failure-"));
  const inputFilePath = path.join(dataDir, "source.png");
  await makeImage(inputFilePath);
  const outsideArtifactPath = path.join(await mkdtemp(path.join(tmpdir(), "grasseye-mp-outside-artifact-")), "artifact.webp");
  await writeFile(outsideArtifactPath, "artifact");
  const mediaProcessing = {
    abilityGroupId: MEDIA_PROCESSING_ABILITY_GROUP_ID,
    listChildCapabilityIds: () => ["optimize-image-for-web-once"],
    processMedia: async (input: MediaProcessingPublicRequest) => buildSuccessResult(input, outsideArtifactPath),
    execute: async () => {
      throw new Error("not used");
    },
  } as MediaProcessingAbilityGroup;
  const server = await startServer(buildWorkbench(dataDir, mediaProcessing));
  try {
    const started = await postStart(server.baseUrl, inputFilePath, { saveToDownloads: true })
      .then((response) => response.json() as Promise<TaskSnapshot>);
    const failed = await assertEventually(
      () => readTask(server.baseUrl, started.taskId),
      (task) => task.status === "failed",
      "Downloads copy failure must fail the async task.",
    );
    assert.equal(failed.failureReason, "media_processing_download_outside_workbench_data");
  } finally {
    await server.close();
  }
};

await runInitialSnapshotFailureAcceptance();
await runTerminalSnapshotFailureAndConcurrencyAcceptance();
await runInterruptedRunningSnapshotAcceptance();
await runDownloadsCopyFailureAcceptance();

process.stdout.write("[ACCEPTANCE][media-processing-task-persistence] PASS\n");
