import {
  createXuanyuanTask,
  executeXuanyuanTask,
  recordXuanyuanCoordinatorFailure,
  type XuanyuanRuntime,
} from "./xuanyuan.task.js";
import {
  acquireXuanyuanQueueOwner,
  type XuanyuanQueueOwnerLease,
} from "./xuanyuan-queue-owner.js";
import type { XuanyuanTaskRecord } from "./xuanyuan.schema.js";
import { listStoredXuanyuanTasks } from "./xuanyuan.store.js";

export type XuanyuanTaskCoordinator = {
  init(): Promise<void>;
  enqueue(rawRequest: unknown): Promise<XuanyuanTaskRecord>;
  waitForIdle(): Promise<void>;
  close(): Promise<void>;
};

type CoordinatorState = {
  runtime: XuanyuanRuntime;
  ownerLease: XuanyuanQueueOwnerLease | null;
  enqueueTail: Promise<void>;
  runtimeCapacity: number;
  active: Map<string, Promise<void>>;
  pending: string[];
};

const shouldResume = (task: XuanyuanTaskRecord): boolean =>
  task.status === "queued"
  || task.status === "running"
  || task.status === "recovery_pending"
  || (
    (task.status === "failed" || task.status === "review_required")
    && task.recovery.recoverable
  );

const pumpQueue = (state: CoordinatorState): void => {
  while (
    state.active.size < state.runtimeCapacity
    && state.pending.length > 0
  ) {
    const taskId = state.pending.shift()!;
    if (state.active.has(taskId)) continue;
    const execution = executeXuanyuanTask(state.runtime, taskId)
      .then(() => undefined)
      .catch((error) =>
        recordXuanyuanCoordinatorFailure(state.runtime, taskId, error))
      .finally(() => {
        state.active.delete(taskId);
        pumpQueue(state);
      });
    state.active.set(taskId, execution);
  }
};

const scheduleTask = (state: CoordinatorState, taskId: string): void => {
  if (state.active.has(taskId) || state.pending.includes(taskId)) return;
  state.pending.push(taskId);
  pumpQueue(state);
};

const initializeCoordinator = async (state: CoordinatorState): Promise<void> => {
  if (state.ownerLease) return;
  state.ownerLease = await acquireXuanyuanQueueOwner(state.runtime.dataDir);
  const interrupted = (await listStoredXuanyuanTasks(state.runtime.dataDir))
    .filter(shouldResume)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  for (const task of interrupted) scheduleTask(state, task.taskId);
};

const enqueueTask = (
  state: CoordinatorState,
  rawRequest: unknown,
): Promise<XuanyuanTaskRecord> => {
  if (!state.ownerLease) throw new Error("XUANYUAN_QUEUE_NOT_INITIALIZED");
  return new Promise<XuanyuanTaskRecord>((resolve, reject) => {
    state.enqueueTail = state.enqueueTail
      .then(async () => {
        const task = await createXuanyuanTask(state.runtime, rawRequest);
        scheduleTask(state, task.taskId);
        resolve(task);
      })
      .catch(reject);
  });
};

const waitForIdle = async (state: CoordinatorState): Promise<void> => {
  await state.enqueueTail;
  while (state.pending.length > 0 || state.active.size > 0) {
    await Promise.all([...state.active.values()]);
  }
};

const closeCoordinator = async (state: CoordinatorState): Promise<void> => {
  await waitForIdle(state);
  await state.ownerLease?.release();
  state.ownerLease = null;
};

export const createXuanyuanTaskCoordinator = (
  runtime: XuanyuanRuntime,
): XuanyuanTaskCoordinator => {
  const state: CoordinatorState = {
    runtime,
    ownerLease: null,
    enqueueTail: Promise.resolve(),
    runtimeCapacity: runtime.aiInputGateway.getRuntimeCapacity(),
    active: new Map(),
    pending: [],
  };
  return {
    init: () => initializeCoordinator(state),
    enqueue: (rawRequest) => enqueueTask(state, rawRequest),
    waitForIdle: () => waitForIdle(state),
    close: () => closeCoordinator(state),
  };
};
