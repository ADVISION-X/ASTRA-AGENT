import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";

export const createProviderOperatorControl = (
  browser?: BrowserTargetSession,
) => {
  const owners = new Set<string>();
  const waiters = new Set<() => void>();
  return {
    async release(ownerKey: string): Promise<boolean> {
      if (!ownerKey.trim()) throw new Error("AI provider takeover requires an owner key");
      owners.add(ownerKey);
      if (!browser?.getTarget?.() || !browser.releaseTargetForOperator) return false;
      await browser.releaseTargetForOperator({ reason: `operator takeover for ${ownerKey}` });
      return true;
    },
    resume(ownerKey: string): void {
      owners.delete(ownerKey);
      if (owners.size === 0) [...waiters].forEach((finish) => finish());
    },
    close: async () => undefined,
    waitForRelease(signal?: AbortSignal): Promise<void> {
      if (owners.size === 0) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        const finish = () => {
          signal?.removeEventListener("abort", abort);
          waiters.delete(finish);
          resolve();
        };
        const abort = () => {
          waiters.delete(finish);
          reject(signal?.reason instanceof Error ? signal.reason : new Error("AI provider wait aborted"));
        };
        waiters.add(finish);
        if (signal?.aborted) abort();
        else signal?.addEventListener("abort", abort, { once: true });
      });
    },
  };
};
