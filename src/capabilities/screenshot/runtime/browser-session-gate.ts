import { URL } from "node:url";

import type { ScreenshotAbilityInput, ScreenshotBrowserSessionSnapshot } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import type { ScreenshotChildRegistryEntry } from "./screenshot-child-contract.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

function normalizeComparableUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
}

export async function runBrowserSessionGate(input: {
  request: ScreenshotAbilityInput;
  registryEntry: ScreenshotChildRegistryEntry;
  context: ScreenshotRuntimeContext;
}): Promise<{
  decision: { status: "passed" | "failed" | "review_required" | "not_applicable"; reason: string | null };
  sessionSnapshot: ScreenshotBrowserSessionSnapshot | null;
  browserSessionRef: string | null;
  failure: ReturnType<typeof createScreenshotFailure> | null;
}> {
  if (!input.registryEntry.requiresBrowserSession) {
    return {
      decision: { status: "not_applicable", reason: null },
      sessionSnapshot: null,
      browserSessionRef: null,
      failure: null,
    };
  }

  try {
    const sessionSnapshot = await input.context.capturePort.getBrowserSessionSnapshot();
    const browserSessionRef = `${sessionSnapshot.browserProfileRef}:${sessionSnapshot.currentUrl}`;
    const expectedUrl = input.request.pageStateProof?.pageUrl
      ?? (input.request.source.kind === "browser_viewport" ? input.request.source.pageUrl : null);
    const expectedBrowserSessionRef = input.request.source.kind === "browser_viewport"
      ? input.request.source.browserSessionRef
      : null;
    if (sessionSnapshot.browserMode !== "real_chrome_persistent") {
      return {
        decision: { status: "failed", reason: "real_chrome_session_required" },
        sessionSnapshot,
        browserSessionRef,
        failure: createScreenshotFailure({
          code: "browser_session_invalid",
          message: "Screenshot browser capture requires a real Chrome persistent session.",
        }),
      };
    }
    if (sessionSnapshot.profileVerificationStatus !== "operator_verified") {
      return {
        decision: { status: "review_required", reason: "browser_profile_operator_verification_required" },
        sessionSnapshot,
        browserSessionRef,
        failure: createScreenshotFailure({
          code: "browser_session_invalid",
          message: "Screenshot browser capture requires an operator-verified browser profile.",
          detail: sessionSnapshot.profileVerificationReason,
        }),
      };
    }
    if (sessionSnapshot.profileStatus !== "profile_ready" && sessionSnapshot.profileStatus !== "logged_in") {
      return {
        decision: { status: "review_required", reason: "browser_profile_not_ready" },
        sessionSnapshot,
        browserSessionRef,
        failure: createScreenshotFailure({
          code: "browser_session_invalid",
          message: "Screenshot browser session is not in profile_ready state.",
          detail: sessionSnapshot.profileStatus,
        }),
      };
    }
    if (sessionSnapshot.loginState === "login_required" || sessionSnapshot.loginState === "review_required") {
      return {
        decision: { status: "review_required", reason: sessionSnapshot.loginState },
        sessionSnapshot,
        browserSessionRef,
        failure: createScreenshotFailure({
          code: "browser_session_invalid",
          message: "Screenshot browser session is not in a capture-ready login state.",
          detail: sessionSnapshot.loginRequiredReason ?? sessionSnapshot.reviewRequiredReason,
        }),
      };
    }
    if (expectedBrowserSessionRef && expectedBrowserSessionRef !== browserSessionRef) {
      return {
        decision: { status: "failed", reason: "browser_session_ref_mismatch" },
        sessionSnapshot,
        browserSessionRef,
        failure: createScreenshotFailure({
          code: "browser_session_invalid",
          message: "Screenshot browser session does not match the governed browserSessionRef handoff.",
          detail: `expected=${expectedBrowserSessionRef} actual=${browserSessionRef}`,
        }),
      };
    }
    if (expectedUrl && normalizeComparableUrl(sessionSnapshot.currentUrl) !== normalizeComparableUrl(expectedUrl)) {
      return {
        decision: { status: "failed", reason: "browser_session_url_mismatch" },
        sessionSnapshot,
        browserSessionRef,
        failure: createScreenshotFailure({
          code: "browser_session_invalid",
          message: "Screenshot browser session currentUrl does not match the governed page-state/open handoff URL.",
          detail: `expected=${expectedUrl} actual=${sessionSnapshot.currentUrl}`,
        }),
      };
    }
    return {
      decision: { status: "passed", reason: null },
      sessionSnapshot,
      browserSessionRef,
      failure: null,
    };
  } catch (error) {
    return {
      decision: { status: "review_required", reason: "browser_session_read_failed" },
      sessionSnapshot: null,
      browserSessionRef: null,
      failure: createScreenshotFailure({
        code: "browser_session_invalid",
        message: "Screenshot failed to read browser session snapshot.",
        detail: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}
