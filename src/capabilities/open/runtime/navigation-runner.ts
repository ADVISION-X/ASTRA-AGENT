import type {
  BrowserSessionSnapshot,
  OpenBrowserNavigationResult,
  OpenNavigationDecision,
} from "../contract.js";
import type { OpenBrowserPort } from "../ports/open-browser-port.js";
import { BrowserSessionSnapshotSchema, NavigationResultSchema, OpenNavigationDecisionSchema } from "../schema.js";
import { buildRedirectChain } from "../shared/open-url.js";
import { withOpenTimeout } from "./open-timeout-policy.js";

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
  failureCode: "navigation_timeout" | "navigation_failed" | null;
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
    const afterSession = BrowserSessionSnapshotSchema.parse(await input.browser.getSessionSnapshot());
    return {
      ok: false,
      failureCode: "navigation_timeout",
      reason: error instanceof Error ? error.message : "open navigation timed out",
      navigationResult: null,
      afterSession,
      decision: OpenNavigationDecisionSchema.parse({
        status: "timeout",
        reason: error instanceof Error ? error.message : "open navigation timed out",
        browserActionId: null,
        fallbackUsed: false,
        openedUrl: afterSession.currentUrl,
        pageTitleAfter: afterSession.currentTitle,
        navigationAttemptRef: `${input.idempotencyKey}:timeout`,
        redirectChain: buildRedirectChain(input.targetUrl, afterSession.currentUrl),
      }),
    };
  }

  const afterSession = BrowserSessionSnapshotSchema.parse(await input.browser.getSessionSnapshot());
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