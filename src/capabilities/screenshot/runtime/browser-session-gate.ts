import { URL } from "node:url";

import type { ScreenshotAbilityInput, ScreenshotBrowserSessionSnapshot } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import type { ScreenshotChildRegistryEntry } from "./screenshot-child-contract.js";
import type { ScreenshotRuntimeContext } from "./screenshot-runtime-context.js";

function normalizeComparableUrl(value: string) {
  if (!URL.canParse(value)) {
    return value;
  }

  const url = new URL(value);
  url.hash = "";
  return url.toString();
}

function buildBrowserSessionGateFailure(input: {
  status: "failed" | "review_required";
  reason: string;
  message: string;
  detail?: string | null;
  sessionSnapshot: ScreenshotBrowserSessionSnapshot | null;
  browserSessionRef: string | null;
}) {
  return {
    decision: { status: input.status, reason: input.reason },
    sessionSnapshot: input.sessionSnapshot,
    browserSessionRef: input.browserSessionRef,
    failure: createScreenshotFailure({
      code: "browser_session_invalid",
      message: input.message,
      detail: input.detail ?? null,
    }),
  };
}

function resolveBrowserSessionModeFailure(sessionSnapshot: ScreenshotBrowserSessionSnapshot, browserSessionRef: string) {
  if (sessionSnapshot.browserMode === "real_chrome_persistent") {
    return null;
  }

  return buildBrowserSessionGateFailure({
    status: "failed",
    reason: "real_chrome_session_required",
    message: "Screenshot browser capture requires a real Chrome persistent session.",
    sessionSnapshot,
    browserSessionRef,
  });
}

function resolveBrowserSessionProfileVerificationFailure(sessionSnapshot: ScreenshotBrowserSessionSnapshot, browserSessionRef: string) {
  if (sessionSnapshot.profileVerificationStatus === "operator_verified") {
    return null;
  }

  return buildBrowserSessionGateFailure({
    status: "review_required",
    reason: "browser_profile_operator_verification_required",
    message: "Screenshot browser capture requires an operator-verified browser profile.",
    detail: sessionSnapshot.profileVerificationReason,
    sessionSnapshot,
    browserSessionRef,
  });
}

function resolveBrowserSessionProfileStateFailure(sessionSnapshot: ScreenshotBrowserSessionSnapshot, browserSessionRef: string) {
  if (sessionSnapshot.profileStatus === "profile_ready" || sessionSnapshot.profileStatus === "logged_in") {
    return null;
  }

  return buildBrowserSessionGateFailure({
    status: "review_required",
    reason: "browser_profile_not_ready",
    message: "Screenshot browser session is not in profile_ready state.",
    detail: sessionSnapshot.profileStatus,
    sessionSnapshot,
    browserSessionRef,
  });
}

function resolveBrowserSessionLoginStateFailure(sessionSnapshot: ScreenshotBrowserSessionSnapshot, browserSessionRef: string) {
  if (sessionSnapshot.loginState !== "login_required" && sessionSnapshot.loginState !== "review_required") {
    return null;
  }

  return buildBrowserSessionGateFailure({
    status: "review_required",
    reason: sessionSnapshot.loginState,
    message: "Screenshot browser session is not in a capture-ready login state.",
    detail: sessionSnapshot.loginRequiredReason ?? sessionSnapshot.reviewRequiredReason,
    sessionSnapshot,
    browserSessionRef,
  });
}

function resolveBrowserSessionRefFailure(expectedBrowserSessionRef: string | null, browserSessionRef: string, sessionSnapshot: ScreenshotBrowserSessionSnapshot) {
  if (!expectedBrowserSessionRef || expectedBrowserSessionRef === browserSessionRef) {
    return null;
  }

  return buildBrowserSessionGateFailure({
    status: "failed",
    reason: "browser_session_ref_mismatch",
    message: "Screenshot browser session does not match the governed browserSessionRef handoff.",
    detail: `expected=${expectedBrowserSessionRef} actual=${browserSessionRef}`,
    sessionSnapshot,
    browserSessionRef,
  });
}

function resolveBrowserSessionUrlFailure(expectedUrl: string | null, sessionSnapshot: ScreenshotBrowserSessionSnapshot, browserSessionRef: string) {
  if (!expectedUrl) {
    return null;
  }

  const currentComparableUrl = normalizeComparableUrl(sessionSnapshot.currentUrl);
  const expectedComparableUrl = normalizeComparableUrl(expectedUrl);
  if (currentComparableUrl === expectedComparableUrl) {
    return null;
  }

  return buildBrowserSessionGateFailure({
    status: "failed",
    reason: "browser_session_url_mismatch",
    message: "Screenshot browser session currentUrl does not match the governed page-state/open handoff URL.",
    detail: `expected=${expectedUrl} actual=${sessionSnapshot.currentUrl}`,
    sessionSnapshot,
    browserSessionRef,
  });
}

function resolveBrowserSessionGate(input: {
  request: ScreenshotAbilityInput;
  registryEntry: ScreenshotChildRegistryEntry;
  context: ScreenshotRuntimeContext;
}) {
  if (!input.registryEntry.requiresBrowserSession) {
    return {
      decision: { status: "not_applicable" as const, reason: null },
      sessionSnapshot: null,
      browserSessionRef: null,
      failure: null,
    };
  }

  const sessionSnapshot = input.context.capturePort.getBrowserSessionSnapshot();
  return Promise.resolve(sessionSnapshot).then((resolvedSessionSnapshot) => {
    const browserSessionRef = `${resolvedSessionSnapshot.browserProfileRef}:${resolvedSessionSnapshot.currentUrl}`;
    const expectedUrl = input.request.pageStateProof?.pageUrl
      ?? (input.request.source.kind === "browser_viewport" ? input.request.source.pageUrl : null);
    const expectedBrowserSessionRef = input.request.source.kind === "browser_viewport"
      ? input.request.source.browserSessionRef
      : null;

    const failure =
      resolveBrowserSessionModeFailure(resolvedSessionSnapshot, browserSessionRef)
      ?? resolveBrowserSessionProfileVerificationFailure(resolvedSessionSnapshot, browserSessionRef)
      ?? resolveBrowserSessionProfileStateFailure(resolvedSessionSnapshot, browserSessionRef)
      ?? resolveBrowserSessionLoginStateFailure(resolvedSessionSnapshot, browserSessionRef)
      ?? resolveBrowserSessionRefFailure(expectedBrowserSessionRef, browserSessionRef, resolvedSessionSnapshot)
      ?? resolveBrowserSessionUrlFailure(expectedUrl, resolvedSessionSnapshot, browserSessionRef);

    if (failure) {
      return failure;
    }

    return {
      decision: { status: "passed" as const, reason: null },
      sessionSnapshot: resolvedSessionSnapshot,
      browserSessionRef,
      failure: null,
    };
  });
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
  try {
    return await resolveBrowserSessionGate(input);
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
