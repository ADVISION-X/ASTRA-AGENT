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
import { listStoredXuanyuanTasks, readXuanyuanTask } from "./xuanyuan.store.js";

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
  retryTimers: Map<string, ReturnType<typeof setTimeout>>;
  closing: boolean;
};

const shouldResume = (task: XuanyuanTaskRecord): boolean =>
  task.status === "queued"
  || task.status === "running"
  || task.status === "recovery_pending"
  || (
    (task.status === "failed" || task.status === "review_required")
    && task.recovery.recoverable
  );

const scheduleTask = (state: CoordinatorState, taskId: string): void => {
  if (
    state.closing
    || state.active.has(taskId)
    || state.pending.includes(taskId)
  ) return;
  const existingTimer = state.retryTimers.get(taskId);
  if (existingTimer) clearTimeout(existingTimer);
  state.retryTimers.delete(taskId);
  state.pending.push(taskId);
  pumpQueue(state);
};

const schedulePersistedTask = (
  state: CoordinatorState,
  task: XuanyuanTaskRecord,
): void => {
  if (state.closing) return;
  const retryAt = task.recovery.nextRetryAt
    ? new Date(task.recovery.nextRetryAt).getTime()
    : 0;
  const delayMs = Math.max(0, retryAt - Date.now());
  if (delayMs === 0) {
    scheduleTask(state, task.taskId);
    return;
  }
  if (state.retryTimers.has(task.taskId)) return;
  const timer = setTimeout(() => {
    state.retryTimers.delete(task.taskId);
    scheduleTask(state, task.taskId);
  }, Math.min(delayMs, 2_147_483_647));
  state.retryTimers.set(task.taskId, timer);
};

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
      .then(async () => {
        const persisted = await readXuanyuanTask(state.runtime.dataDir, taskId);
        if (persisted?.status === "recovery_pending") {
          schedulePersistedTask(state, persisted);
        }
      })
      .finally(() => {
        state.active.delete(taskId);
        pumpQueue(state);
      });
    state.active.set(taskId, execution);
  }
};

const initializeCoordinator = async (state: CoordinatorState): Promise<void> => {
  if (state.ownerLease) return;
  state.ownerLease = await acquireXuanyuanQueueOwner(state.runtime.dataDir);
  const interrupted = (await listStoredXuanyuanTasks(state.runtime.dataDir))
    .filter(shouldResume)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  for (const task of interrupted) schedulePersistedTask(state, task);
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
        schedulePersistedTask(state, task);
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
  state.closing = true;
  for (const timer of state.retryTimers.values()) clearTimeout(timer);
  state.retryTimers.clear();
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
    retryTimers: new Map(),
    closing: false,
  };
  return {
    init: () => initializeCoordinator(state),
    enqueue: (rawRequest) => enqueueTask(state, rawRequest),
    waitForIdle: () => waitForIdle(state),
    close: () => closeCoordinator(state),
  };
};
