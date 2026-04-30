import type {
  BrowserSessionSnapshot,
  OpenBrowserNavigationResult,
  OpenNavigationDecision,
  ParsedOpenRequest,
  OpenTargetProfile,
} from "../contract.js";
import type { OpenBrowserPort } from "../ports/open-browser-port.js";
import { BrowserSessionSnapshotSchema, NavigationResultSchema, OpenNavigationDecisionSchema } from "../schema.js";
import { buildRedirectChain } from "../shared/open-url.js";

async function safeReadSessionSnapshot(browser: OpenBrowserPort): Promise<{
  ok: boolean;
  snapshot: BrowserSessionSnapshot | null;
  reason: string | null;
}> {
  try {
    return {
      ok: true,
      snapshot: BrowserSessionSnapshotSchema.parse(await browser.getSessionSnapshot()),
      reason: null,
    };
  } catch (error) {
    return {
      ok: false,
      snapshot: null,
      reason: error instanceof Error ? error.message : "open browser session snapshot failed after navigation",
    };
  }
}

async function runWithTimeout<T>(input: {
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

export async function runOpenNavigation(input: {
  browser: OpenBrowserPort;
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  targetUrl: string;
  targetTitle: string;
  timeoutMs: number;
  idempotencyKey: string;
  reservationDecision: "reserved" | "already_on_target";
  alreadyOnTargetDecision: "not_applicable" | "freshness_required";
  targetProfileRef: string | null;
  beforeSession: BrowserSessionSnapshot;
}): Promise<{
  ok: boolean;
  failureCode: "navigation_timeout" | "navigation_failed" | "session_snapshot_failed" | null;
  reason: string | null;
  navigationResult: OpenBrowserNavigationResult | null;
  afterSession: BrowserSessionSnapshot;
  sessionSnapshotAvailable: boolean;
  sessionSnapshotFailureReason: string | null;
  decision: OpenNavigationDecision;
}> {
  const navigationCallId = `${input.idempotencyKey}:navigation-call`;

  if (input.reservationDecision === "already_on_target") {
    return {
      ok: true,
      failureCode: null,
      reason: null,
      navigationResult: null,
      afterSession: input.beforeSession,
      sessionSnapshotAvailable: true,
      sessionSnapshotFailureReason: null,
      decision: OpenNavigationDecisionSchema.parse({
        status: "already_on_target",
        reason: "browser session already points at the governed target url",
        browserActionId: null,
        openedUrl: input.beforeSession.currentUrl,
        pageTitleAfter: input.beforeSession.currentTitle,
        navigationAttemptRef: `${input.idempotencyKey}:already-on-target`,
        navigationCallId,
        redirectChain: buildRedirectChain(input.targetUrl, input.beforeSession.currentUrl),
        timeoutDecision: "within_limit",
        abortDecision: "not_requested",
        circuitBreakerState: "closed",
        browserOpenStillRunningGuard: false,
        alreadyOnTargetFreshnessDecision: input.alreadyOnTargetDecision,
      }),
    };
  }

  const abortController = new AbortController();
  let navigationResult: OpenBrowserNavigationResult;
  try {
    navigationResult = NavigationResultSchema.parse(await runWithTimeout({
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
  } catch (error) {
    const snapshotResult = await safeReadSessionSnapshot(input.browser);
    return {
      ok: false,
      failureCode: "navigation_timeout",
      reason: error instanceof Error ? error.message : "open navigation timed out",
      navigationResult: null,
      afterSession: snapshotResult.snapshot ?? input.beforeSession,
      sessionSnapshotAvailable: snapshotResult.ok,
      sessionSnapshotFailureReason: snapshotResult.reason,
      decision: OpenNavigationDecisionSchema.parse({
        status: "timed_out",
        reason: error instanceof Error ? error.message : "open navigation timed out",
        browserActionId: null,
        openedUrl: snapshotResult.snapshot?.currentUrl ?? input.beforeSession.currentUrl,
        pageTitleAfter: snapshotResult.snapshot?.currentTitle ?? input.beforeSession.currentTitle,
        navigationAttemptRef: `${input.idempotencyKey}:timeout`,
        navigationCallId,
        redirectChain: buildRedirectChain(input.targetUrl, snapshotResult.snapshot?.currentUrl ?? input.beforeSession.currentUrl),
        timeoutDecision: "timed_out",
        abortDecision: "timeout_abort_requested",
        circuitBreakerState: "closed",
        browserOpenStillRunningGuard: true,
        alreadyOnTargetFreshnessDecision: "not_applicable",
      }),
    };
  }

  const snapshotResult = await safeReadSessionSnapshot(input.browser);
  const afterSession = snapshotResult.snapshot ?? input.beforeSession;
  if (!snapshotResult.ok) {
    return {
      ok: false,
      failureCode: "session_snapshot_failed",
      reason: snapshotResult.reason,
      navigationResult,
      afterSession,
      sessionSnapshotAvailable: false,
      sessionSnapshotFailureReason: snapshotResult.reason,
      decision: OpenNavigationDecisionSchema.parse({
        status: "failed",
        reason: snapshotResult.reason,
        browserActionId: navigationResult.browserActionId,
        openedUrl: navigationResult.openedUrl ?? afterSession.currentUrl,
        pageTitleAfter: navigationResult.pageTitleAfter ?? afterSession.currentTitle,
        navigationAttemptRef: `${input.idempotencyKey}:${navigationResult.browserActionId ?? "no-action"}`,
        navigationCallId,
        redirectChain: navigationResult.redirectChain.length > 0
          ? navigationResult.redirectChain
          : buildRedirectChain(input.targetUrl, navigationResult.openedUrl ?? afterSession.currentUrl),
        timeoutDecision: "within_limit",
        abortDecision: "not_requested",
        circuitBreakerState: "closed",
        browserOpenStillRunningGuard: false,
        alreadyOnTargetFreshnessDecision: "not_applicable",
      }),
    };
  }

  if (!navigationResult.ok) {
    return {
      ok: false,
      failureCode: "navigation_failed",
      reason: navigationResult.message,
      navigationResult,
      afterSession,
      sessionSnapshotAvailable: true,
      sessionSnapshotFailureReason: null,
      decision: OpenNavigationDecisionSchema.parse({
        status: "failed",
        reason: navigationResult.message,
        browserActionId: navigationResult.browserActionId,
        openedUrl: navigationResult.openedUrl ?? afterSession.currentUrl,
        pageTitleAfter: navigationResult.pageTitleAfter ?? afterSession.currentTitle,
        navigationAttemptRef: `${input.idempotencyKey}:${navigationResult.browserActionId ?? "no-action"}`,
        navigationCallId,
        redirectChain: navigationResult.redirectChain.length > 0
          ? navigationResult.redirectChain
          : buildRedirectChain(input.targetUrl, navigationResult.openedUrl ?? afterSession.currentUrl),
        timeoutDecision: "within_limit",
        abortDecision: "not_requested",
        circuitBreakerState: "closed",
        browserOpenStillRunningGuard: false,
        alreadyOnTargetFreshnessDecision: "not_applicable",
      }),
    };
  }

  return {
    ok: true,
    failureCode: null,
    reason: null,
    navigationResult,
    afterSession,
    sessionSnapshotAvailable: true,
    sessionSnapshotFailureReason: null,
    decision: OpenNavigationDecisionSchema.parse({
      status: "executed",
      reason: null,
      browserActionId: navigationResult.browserActionId,
      openedUrl: navigationResult.openedUrl ?? afterSession.currentUrl,
      pageTitleAfter: navigationResult.pageTitleAfter ?? afterSession.currentTitle,
      navigationAttemptRef: `${input.idempotencyKey}:${navigationResult.browserActionId ?? "no-action"}`,
      navigationCallId,
      redirectChain: navigationResult.redirectChain.length > 0
        ? navigationResult.redirectChain
        : buildRedirectChain(input.targetUrl, navigationResult.openedUrl ?? afterSession.currentUrl),
      timeoutDecision: "within_limit",
      abortDecision: "not_requested",
      circuitBreakerState: "closed",
      browserOpenStillRunningGuard: false,
      alreadyOnTargetFreshnessDecision: "not_applicable",
    }),
  };
}