import type { BrowserSessionSnapshot, OpenBrowserNavigationResult } from "../contract.js";
import { buildRedirectChain } from "../shared/open-url.js";
import { buildNavigationDecision, buildNavigationResponse, type OpenNavigationRunResult, type SessionSnapshotResult } from "./navigation-runner-shared.js";

export const buildAlreadyOnTargetNavigationResult = (input: {
  beforeSession: BrowserSessionSnapshot;
  targetUrl: string;
  idempotencyKey: string;
  alreadyOnTargetDecision: "not_applicable" | "freshness_required";
}): OpenNavigationRunResult => {
  const navigationCallId = `${input.idempotencyKey}:navigation-call`;
  const currentUrl = input.beforeSession.currentUrl;
  const currentTitle = input.beforeSession.currentTitle;

  return buildNavigationResponse({
    ok: true,
    failureCode: null,
    reason: null,
    navigationResult: null,
    afterSession: input.beforeSession,
    sessionSnapshotAvailable: true,
    sessionSnapshotFailureReason: null,
    decision: buildNavigationDecision({
      status: "already_on_target",
      reason: "browser session already points at the governed target url",
      browserActionId: null,
      openedUrl: currentUrl,
      pageTitleAfter: currentTitle,
      navigationAttemptRef: `${input.idempotencyKey}:already-on-target`,
      navigationCallId,
      redirectChain: buildRedirectChain(input.targetUrl, currentUrl),
      timeoutDecision: "within_limit",
      abortDecision: "not_requested",
      browserOpenStillRunningGuard: false,
      alreadyOnTargetFreshnessDecision: input.alreadyOnTargetDecision,
    }),
  });
};

export const buildTimedOutNavigationResult = (input: {
  beforeSession: BrowserSessionSnapshot;
  targetUrl: string;
  idempotencyKey: string;
  error: unknown;
  snapshotResult: SessionSnapshotResult;
}): OpenNavigationRunResult => {
  const navigationCallId = `${input.idempotencyKey}:navigation-call`;
  const afterSession = input.snapshotResult.snapshot ?? input.beforeSession;
  const failureReason = input.error instanceof Error ? input.error.message : "open navigation timed out";

  return buildNavigationResponse({
    ok: false,
    failureCode: "navigation_timeout",
    reason: failureReason,
    navigationResult: null,
    afterSession,
    sessionSnapshotAvailable: input.snapshotResult.ok,
    sessionSnapshotFailureReason: input.snapshotResult.reason,
    decision: buildNavigationDecision({
      status: "timed_out",
      reason: failureReason,
      browserActionId: null,
      openedUrl: afterSession.currentUrl,
      pageTitleAfter: afterSession.currentTitle,
      navigationAttemptRef: `${input.idempotencyKey}:timeout`,
      navigationCallId,
      redirectChain: buildRedirectChain(input.targetUrl, afterSession.currentUrl),
      timeoutDecision: "timed_out",
      abortDecision: "timeout_abort_requested",
      browserOpenStillRunningGuard: true,
      alreadyOnTargetFreshnessDecision: "not_applicable",
    }),
  });
};

export const buildSessionSnapshotFailureResult = (input: {
  beforeSession: BrowserSessionSnapshot;
  targetUrl: string;
  idempotencyKey: string;
  navigationResult: OpenBrowserNavigationResult;
  snapshotResult: SessionSnapshotResult;
}): OpenNavigationRunResult => {
  const navigationCallId = `${input.idempotencyKey}:navigation-call`;
  const afterSession = input.snapshotResult.snapshot ?? input.beforeSession;
  const navigationResult = input.navigationResult;

  return buildNavigationResponse({
    ok: false,
    failureCode: "session_snapshot_failed",
    reason: input.snapshotResult.reason,
    navigationResult,
    afterSession,
    sessionSnapshotAvailable: false,
    sessionSnapshotFailureReason: input.snapshotResult.reason,
    decision: buildNavigationDecision({
      status: "failed",
      reason: input.snapshotResult.reason,
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
      browserOpenStillRunningGuard: false,
      alreadyOnTargetFreshnessDecision: "not_applicable",
    }),
  });
};

export const buildNavigationFailedResult = (input: {
  beforeSession: BrowserSessionSnapshot;
  targetUrl: string;
  idempotencyKey: string;
  navigationResult: OpenBrowserNavigationResult;
  snapshotResult: SessionSnapshotResult;
}): OpenNavigationRunResult => {
  const navigationCallId = `${input.idempotencyKey}:navigation-call`;
  const afterSession = input.snapshotResult.snapshot ?? input.beforeSession;
  const navigationResult = input.navigationResult;

  return buildNavigationResponse({
    ok: false,
    failureCode: "navigation_failed",
    reason: navigationResult.message,
    navigationResult,
    afterSession,
    sessionSnapshotAvailable: true,
    sessionSnapshotFailureReason: null,
    decision: buildNavigationDecision({
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
      browserOpenStillRunningGuard: false,
      alreadyOnTargetFreshnessDecision: "not_applicable",
    }),
  });
};

export const buildNavigationSuccessResult = (input: {
  beforeSession: BrowserSessionSnapshot;
  targetUrl: string;
  idempotencyKey: string;
  navigationResult: OpenBrowserNavigationResult;
  snapshotResult: SessionSnapshotResult;
}): OpenNavigationRunResult => {
  const navigationCallId = `${input.idempotencyKey}:navigation-call`;
  const afterSession = input.snapshotResult.snapshot ?? input.beforeSession;
  const navigationResult = input.navigationResult;

  return buildNavigationResponse({
    ok: true,
    failureCode: null,
    reason: null,
    navigationResult,
    afterSession,
    sessionSnapshotAvailable: true,
    sessionSnapshotFailureReason: null,
    decision: buildNavigationDecision({
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
      browserOpenStillRunningGuard: false,
      alreadyOnTargetFreshnessDecision: "not_applicable",
    }),
  });
};