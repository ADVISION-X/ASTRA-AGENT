import type { BrowserSessionSnapshot, OpenBrowserNavigationResult, ParsedOpenRequest } from "../contract.js";
import type { OpenBrowserPort } from "../ports/open-browser-port.js";
import { NavigationResultSchema } from "../schema.js";
import type {
  OpenNavigationRunResult,
  SessionSnapshotResult,
} from "./navigation-runner-result-builders.js";
import {
  buildNavigationFailedResult,
  buildNavigationSuccessResult,
  buildSessionSnapshotFailureResult,
} from "./navigation-runner-result-builders.js";

export type NavigationAttemptInput = {
  browser: OpenBrowserPort;
  request: ParsedOpenRequest;
  targetUrl: string;
  targetTitle: string;
  timeoutMs: number;
  idempotencyKey: string;
  targetProfileRef: string | null;
  beforeSession: BrowserSessionSnapshot;
};

export async function runWithTimeout<T>(input: {
  operation: Promise<T>;
  abortController: AbortController;
  timeoutMs: number;
}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      input.abortController.abort(new Error(`open navigation timed out after ${input.timeoutMs}ms`));
      reject(new Error(`open navigation timed out after ${input.timeoutMs}ms`));
    }, input.timeoutMs);

    input.operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function runNavigationAttempt(input: NavigationAttemptInput, abortController: AbortController): Promise<OpenBrowserNavigationResult> {
  return NavigationResultSchema.parse(await runWithTimeout({
    operation: input.browser.open({
      openAttemptRef: `${input.idempotencyKey}:open-attempt`,
      missionId: input.request.missionId,
      runId: input.request.runId,
      sessionId: input.request.sessionId,
      roundId: input.request.roundId,
      videoVisitId: input.request.videoVisitId,
      childCapabilityId: input.request.childCapabilityId,
      platformId: input.request.platformId,
      targetKind: input.request.targetKind,
      targetProfileRef: input.targetProfileRef,
      url: input.targetUrl,
      title: input.targetTitle,
      timeoutMs: input.timeoutMs,
      abortSignal: abortController.signal,
      idempotencyKey: input.idempotencyKey,
      sourceRef: input.request.sourceRef,
    }),
    abortController,
    timeoutMs: input.timeoutMs,
  }));
}

export const finalizeNavigationAfterAttempt = (
  input: Pick<NavigationAttemptInput, "beforeSession" | "targetUrl" | "idempotencyKey">,
  navigationResult: OpenBrowserNavigationResult,
  snapshotResult: SessionSnapshotResult,
): OpenNavigationRunResult => {
  if (!snapshotResult.ok) {
    return buildSessionSnapshotFailureResult({
      beforeSession: input.beforeSession,
      targetUrl: input.targetUrl,
      idempotencyKey: input.idempotencyKey,
      navigationResult,
      snapshotResult,
    });
  }

  if (!navigationResult.ok) {
    return buildNavigationFailedResult({
      beforeSession: input.beforeSession,
      targetUrl: input.targetUrl,
      idempotencyKey: input.idempotencyKey,
      navigationResult,
      snapshotResult,
    });
  }

  return buildNavigationSuccessResult({
    beforeSession: input.beforeSession,
    targetUrl: input.targetUrl,
    idempotencyKey: input.idempotencyKey,
    navigationResult,
    snapshotResult,
  });
};
