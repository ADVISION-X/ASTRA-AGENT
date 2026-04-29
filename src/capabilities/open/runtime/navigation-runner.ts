import type {
  BrowserSessionSnapshot,
  OpenBrowserNavigationResult,
  OpenNavigationDecision,
} from "../contract.js";
import type { OpenBrowserPort } from "../ports/open-browser-port.js";
import { BrowserSessionSnapshotSchema, NavigationResultSchema, OpenNavigationDecisionSchema } from "../schema.js";
import { buildRedirectChain } from "../shared/open-url.js";
import { withOpenTimeout } from "./open-timeout-policy.js";

async function safeReadSessionSnapshot(browser: OpenBrowserPort): Promise<{
  ok: true;
  snapshot: BrowserSessionSnapshot;
} | {
  ok: false;
  reason: string;
  snapshot: BrowserSessionSnapshot;
}> {
  try {
    return {
      ok: true,
      snapshot: BrowserSessionSnapshotSchema.parse(await browser.getSessionSnapshot()),
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "open browser session snapshot failed after navigation",
      snapshot: BrowserSessionSnapshotSchema.parse({
        open: false,
        currentUrl: "about:blank",
        currentTitle: null,
        browserExecutable: null,
        browserMode: "unsupported",
        browserProfileRef: "open-session:unavailable",
        browserExecutablePath: null,
        profileStatus: "profile_unavailable",
        profileDirectory: "unavailable",
        profileProvisioning: "managed_default",
        profileVerificationStatus: "default_unverified",
        profileVerificationReason: error instanceof Error ? error.message : "session snapshot unavailable",
        loginState: "unknown",
        lastLoginCheckAt: null,
        loginRequiredReason: null,
        reviewRequiredReason: null,
      }),
    };
  }
}

export async function runOpenNavigation(input: {
  browser: OpenBrowserPort;
  targetUrl: string;
  targetTitle: string;
  timeoutMs: number;
  idempotencyKey: string;
  reservationStatus: "reserved" | "already_on_target";
  beforeSession: BrowserSessionSnapshot;
}): Promise<{
  ok: boolean;
  failureCode: "navigation_timeout" | "navigation_failed" | "session_snapshot_failed" | null;
  reason: string | null;
  navigationResult: OpenBrowserNavigationResult | null;
  afterSession: BrowserSessionSnapshot;
  decision: OpenNavigationDecision;
}> {
  if (input.reservationStatus === "already_on_target") {
    return {
      ok: true,
      failureCode: null,
      reason: null,
      navigationResult: null,
      afterSession: input.beforeSession,
      decision: OpenNavigationDecisionSchema.parse({
        status: "already_on_target",
        reason: "browser session already points at the governed target url",
        browserActionId: null,
        fallbackUsed: false,
        openedUrl: input.beforeSession.currentUrl,
        pageTitleAfter: input.beforeSession.currentTitle,
        navigationAttemptRef: `${input.idempotencyKey}:already-on-target`,
        redirectChain: buildRedirectChain(input.targetUrl, input.beforeSession.currentUrl),
      }),
    };
  }

  let navigationResult: OpenBrowserNavigationResult;
  try {
    navigationResult = NavigationResultSchema.parse(await withOpenTimeout({
      operation: input.browser.open({
        url: input.targetUrl,
        title: input.targetTitle,
      }),
      timeoutMs: input.timeoutMs,
    }));
  } catch (error) {
    const snapshotResult = await safeReadSessionSnapshot(input.browser);
    return {
      ok: false,
      failureCode: "navigation_timeout",
      reason: snapshotResult.ok
        ? (error instanceof Error ? error.message : "open navigation timed out")
        : `${error instanceof Error ? error.message : "open navigation timed out"}; ${snapshotResult.reason}`,
      navigationResult: null,
      afterSession: snapshotResult.snapshot,
      decision: OpenNavigationDecisionSchema.parse({
        status: "timeout",
        reason: snapshotResult.ok
          ? (error instanceof Error ? error.message : "open navigation timed out")
          : `${error instanceof Error ? error.message : "open navigation timed out"}; ${snapshotResult.reason}`,
        browserActionId: null,
        fallbackUsed: false,
        openedUrl: snapshotResult.snapshot.currentUrl,
        pageTitleAfter: snapshotResult.snapshot.currentTitle,
        navigationAttemptRef: `${input.idempotencyKey}:timeout`,
        redirectChain: buildRedirectChain(input.targetUrl, snapshotResult.snapshot.currentUrl),
      }),
    };
  }

  const snapshotResult = await safeReadSessionSnapshot(input.browser);
  const afterSession = snapshotResult.snapshot;
  if (!snapshotResult.ok) {
    return {
      ok: false,
      failureCode: "session_snapshot_failed",
      reason: snapshotResult.reason,
      navigationResult,
      afterSession,
      decision: OpenNavigationDecisionSchema.parse({
        status: "browser_failed",
        reason: snapshotResult.reason,
        browserActionId: navigationResult.browserActionId,
        fallbackUsed: navigationResult.fallbackUsed,
        openedUrl: afterSession.currentUrl,
        pageTitleAfter: afterSession.currentTitle,
        navigationAttemptRef: `${input.idempotencyKey}:${navigationResult.browserActionId}`,
        redirectChain: buildRedirectChain(input.targetUrl, afterSession.currentUrl),
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
      decision: OpenNavigationDecisionSchema.parse({
        status: "browser_failed",
        reason: navigationResult.message,
        browserActionId: navigationResult.browserActionId,
        fallbackUsed: navigationResult.fallbackUsed,
        openedUrl: afterSession.currentUrl,
        pageTitleAfter: afterSession.currentTitle,
        navigationAttemptRef: `${input.idempotencyKey}:${navigationResult.browserActionId}`,
        redirectChain: buildRedirectChain(input.targetUrl, afterSession.currentUrl),
      }),
    };
  }

  return {
    ok: !navigationResult.fallbackUsed,
    failureCode: navigationResult.fallbackUsed ? "navigation_failed" : null,
    reason: navigationResult.fallbackUsed ? "fallback navigation requires operator review" : null,
    navigationResult,
    afterSession,
    decision: OpenNavigationDecisionSchema.parse({
      status: navigationResult.fallbackUsed ? "review_required" : "navigated",
      reason: navigationResult.fallbackUsed ? "fallback navigation requires operator review" : null,
      browserActionId: navigationResult.browserActionId,
      fallbackUsed: navigationResult.fallbackUsed,
      openedUrl: afterSession.currentUrl,
      pageTitleAfter: afterSession.currentTitle,
      navigationAttemptRef: `${input.idempotencyKey}:${navigationResult.browserActionId}`,
      redirectChain: buildRedirectChain(input.targetUrl, afterSession.currentUrl),
    }),
  };
}