import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

type LeaseRecord = {
  leaseId: string;
  pid: number;
  acquiredAt: string;
  kind: "capacity" | "browser_mutation";
  slot: number | null;
};

export type WebChatRuntimeLease = {
  leaseId: string;
  slot: number | null;
  release(): Promise<void>;
};

const DEFAULT_MAX_IN_FLIGHT = 10;
const ABSOLUTE_MAX_IN_FLIGHT = 64;

export const resolveWebChatMaxInFlight = (): number => {
  const raw = process.env.WEB_CHAT_MAX_IN_FLIGHT?.trim();
  if (!raw) return DEFAULT_MAX_IN_FLIGHT;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > ABSOLUTE_MAX_IN_FLIGHT) {
    throw new Error(`WEB_CHAT_MAX_IN_FLIGHT must be an integer between 1 and ${ABSOLUTE_MAX_IN_FLIGHT}.`);
  }
  return value;
};

const processAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const delay = (signal?: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, 100);
  const abort = () => {
    clearTimeout(timer);
    reject(new Error("review_required: web-chat lease acquisition aborted."));
  };
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
});

const removeStaleLease = async (leaseDir: string): Promise<boolean> => {
  try {
    const record = JSON.parse(await readFile(path.join(leaseDir, "lease.json"), "utf8")) as Partial<LeaseRecord>;
    if (typeof record.pid === "number" && processAlive(record.pid)) return false;
    await rm(leaseDir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
};

const acquireDirectoryLease = async (input: {
  leaseDir: string;
  kind: LeaseRecord["kind"];
  slot: number | null;
}): Promise<WebChatRuntimeLease | null> => {
  const leaseId = `web-chat-${input.kind}:${randomUUID()}`;
  try {
    await mkdir(input.leaseDir, { recursive: false });
    const record: LeaseRecord = {
      leaseId,
      pid: process.pid,
      acquiredAt: new Date().toISOString(),
      kind: input.kind,
      slot: input.slot,
    };
    await writeFile(path.join(input.leaseDir, "lease.json"), `${JSON.stringify(record)}\n`, { flag: "wx" });
    let released = false;
    return {
      leaseId,
      slot: input.slot,
      async release() {
        if (released) return;
        released = true;
        const current = JSON.parse(await readFile(path.join(input.leaseDir, "lease.json"), "utf8")) as LeaseRecord;
        if (current.leaseId !== leaseId) throw new Error("WEB_CHAT_RUNTIME_LEASE_OWNERSHIP_LOST");
        await rm(input.leaseDir, { recursive: true, force: false });
      },
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      await rm(input.leaseDir, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
    await removeStaleLease(input.leaseDir);
    return null;
  }
};

const capacityRoot = (dataDir: string): string =>
  path.join(dataDir, "runtime-data", "ai-input-gateway", "web-chat-capacity");

export const acquireWebChatCapacityLease = async (input: {
  dataDir: string;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<WebChatRuntimeLease> => {
  const root = capacityRoot(input.dataDir);
  await mkdir(root, { recursive: true });
  const deadline = Date.now() + input.timeoutMs;
  while (Date.now() < deadline) {
    if (input.signal?.aborted) throw new Error("review_required: web-chat capacity wait aborted.");
    const maxInFlight = resolveWebChatMaxInFlight();
    for (let slot = 1; slot <= maxInFlight; slot += 1) {
      const lease = await acquireDirectoryLease({
        leaseDir: path.join(root, `slot-${String(slot).padStart(2, "0")}.lock`),
        kind: "capacity",
        slot,
      });
      if (lease) return lease;
    }
    await delay(input.signal);
  }
  throw new Error("review_required: timed out waiting for bounded web-chat capacity.");
};

export const acquireWebChatBrowserMutationLease = async (input: {
  dataDir: string;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<WebChatRuntimeLease> => {
  const root = path.join(input.dataDir, "runtime-data", "ai-input-gateway");
  await mkdir(root, { recursive: true });
  const leaseDir = path.join(root, "web-chat-browser-mutation.lock");
  const deadline = Date.now() + input.timeoutMs;
  while (Date.now() < deadline) {
    if (input.signal?.aborted) throw new Error("review_required: web-chat browser mutation wait aborted.");
    const lease = await acquireDirectoryLease({ leaseDir, kind: "browser_mutation", slot: null });
    if (lease) return lease;
    await delay(input.signal);
  }
  throw new Error("review_required: timed out waiting for serialized web-chat browser mutation.");
};
