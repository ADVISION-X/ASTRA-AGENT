import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type WebChatProviderLease = {
  providerLeaseId: string;
  release(): Promise<void>;
};

type LeaseRecord = {
  providerLeaseId: string;
  pid: number;
  acquiredAt: string;
};

const pollDelay = (signal?: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, 200);
  if (!signal) return;
  const abort = () => {
    clearTimeout(timer);
    reject(new Error("review_required: web-chat provider lease acquisition aborted."));
  };
  if (signal.aborted) abort();
  else signal.addEventListener("abort", abort, { once: true });
});

const processAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

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

export const acquireWebChatProviderLease = async (input: {
  dataDir: string;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<WebChatProviderLease> => {
  const leaseDir = path.join(input.dataDir, "runtime-data", "ai-input-gateway", "web-chat-provider.lock");
  await mkdir(path.dirname(leaseDir), { recursive: true });
  const deadline = Date.now() + input.timeoutMs;
  while (Date.now() < deadline) {
    if (input.signal?.aborted) throw new Error("review_required: web-chat provider lease acquisition aborted.");
    const providerLeaseId = `web-chat-provider-lease:${randomUUID()}`;
    try {
      await mkdir(leaseDir, { recursive: false });
      const record: LeaseRecord = { providerLeaseId, pid: process.pid, acquiredAt: new Date().toISOString() };
      await writeFile(path.join(leaseDir, "lease.json"), `${JSON.stringify(record)}\n`, { flag: "wx" });
      let released = false;
      return {
        providerLeaseId,
        async release() {
          if (released) return;
          released = true;
          const current = JSON.parse(await readFile(path.join(leaseDir, "lease.json"), "utf8")) as LeaseRecord;
          if (current.providerLeaseId !== providerLeaseId) throw new Error("WEB_CHAT_PROVIDER_LEASE_OWNERSHIP_LOST");
          await rm(leaseDir, { recursive: true, force: false });
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        await rm(leaseDir, { recursive: true, force: true }).catch(() => undefined);
        throw error;
      }
      await removeStaleLease(leaseDir);
      await pollDelay(input.signal);
    }
  }
  throw new Error("review_required: timed out waiting for exclusive web-chat provider lease.");
};
