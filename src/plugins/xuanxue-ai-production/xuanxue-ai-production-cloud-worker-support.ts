import { XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH } from "./xuanxue-ai-production-cloud-contract.js";

export const safeWorkerReason = (error: unknown): string => (
  error instanceof Error ? error.message : String(error)
).slice(0, 1_000);

export const workerErrorCode = (error: unknown): string =>
  safeWorkerReason(error).split(":").slice(0, 2).join(":");

export const isWorkerContractFailure = (error: unknown): boolean =>
  /(?:CONTRACT|MANIFEST|LOCALIZATION_.*PROFILE|PRODUCT_CONTRACT)/iu.test(safeWorkerReason(error));

export const isRecoverableCloudWorkerFailure = (error: unknown): boolean =>
  /CLOUD_API_FAILED|INPUT_DOWNLOAD_FAILED|RECOVERY|WORKER_STOPPED|network|fetch failed|BROWSER_EXTENSION_CHANNEL_UNAVAILABLE|BROWSER_LIVENESS_EXPIRED|BROWSER_SESSION_WORKSPACE_REQUIRED|BROWSER_SESSION_WORKSPACE_REVOKED|BROWSER_TARGET_INVALID|BROWSER_DOCUMENT_INVALID|BROWSER_BACKPRESSURE|BROWSER_AUTH_TRANSCRIPT_INVALID|BROWSER_CAPABILITY_REJECTED/iu
    .test(safeWorkerReason(error));

export const cloudWorkerPollIntervalMs = (): number => {
  const value = Number(process.env.XUANXUE_AI_PRODUCTION_POLL_INTERVAL_MS);
  return Number.isFinite(value) && value >= 1_000 && value <= 30_000 ? value : 5_000;
};

export const waitForCloudWorker = async (ms: number, signal: AbortSignal): Promise<void> => {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    const onAbort = (): void => {
      clearTimeout(timer);
      finish();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
};

export const reportCloudWorkerError = (code: string, error: unknown): void => {
  process.stderr.write(`${JSON.stringify({
    level: "error",
    owner: "xuanxue-ai-production",
    code,
    reason_code: workerErrorCode(error),
    contract_manifest_hash: XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
    at: new Date().toISOString(),
  })}\n`);
};
