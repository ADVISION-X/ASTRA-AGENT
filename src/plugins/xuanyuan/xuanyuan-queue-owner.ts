import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const HEARTBEAT_INTERVAL_MS = 2_000;

type QueueOwnerRecord = {
  ownerId: string;
  pid: number;
  acquiredAt: string;
  heartbeatAt: string;
};

const queueOwnerDir = (dataDir: string): string =>
  path.join(dataDir, "runtime-data", "xuanyuan", "queue-owner.lock");

const queueOwnerRecordPath = (dataDir: string): string =>
  path.join(queueOwnerDir(dataDir), "lease.json");

const processIsAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const readOwner = async (dataDir: string): Promise<QueueOwnerRecord | null> => {
  try {
    return JSON.parse(
      await readFile(queueOwnerRecordPath(dataDir), "utf8"),
    ) as QueueOwnerRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

const writeOwner = async (
  dataDir: string,
  record: QueueOwnerRecord,
): Promise<void> => {
  const destination = queueOwnerRecordPath(dataDir);
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await rename(temporary, destination);
};

export type XuanyuanQueueOwnerLease = {
  ownerId: string;
  release(): Promise<void>;
};

export const acquireXuanyuanQueueOwner = async (
  dataDir: string,
): Promise<XuanyuanQueueOwnerLease> => {
  const ownerId = `xuanyuan-queue-owner:${process.pid}:${randomUUID()}`;
  const acquiredAt = new Date().toISOString();
  await mkdir(path.dirname(queueOwnerDir(dataDir)), { recursive: true });
  for (;;) {
    try {
      await mkdir(queueOwnerDir(dataDir), { recursive: false });
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existing = await readOwner(dataDir);
      if (existing && processIsAlive(existing.pid)) {
        throw new Error(`XUANYUAN_QUEUE_OWNER_ACTIVE:${existing.ownerId}`);
      }
      await rm(queueOwnerDir(dataDir), { recursive: true, force: true });
    }
  }
  let current: QueueOwnerRecord = {
    ownerId,
    pid: process.pid,
    acquiredAt,
    heartbeatAt: acquiredAt,
  };
  await writeOwner(dataDir, current);
  let released = false;
  const heartbeat = setInterval(() => {
    current = { ...current, heartbeatAt: new Date().toISOString() };
    writeOwner(dataDir, current).catch(() => undefined);
  }, HEARTBEAT_INTERVAL_MS);
  heartbeat.unref();
  return {
    ownerId,
    async release() {
      if (released) return;
      released = true;
      clearInterval(heartbeat);
      const existing = await readOwner(dataDir);
      if (existing?.ownerId === ownerId) {
        await rm(queueOwnerDir(dataDir), { recursive: true, force: true });
      }
    },
  };
};
