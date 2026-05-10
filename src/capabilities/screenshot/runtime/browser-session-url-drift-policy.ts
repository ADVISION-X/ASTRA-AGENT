import { URL } from "node:url";

import type { ScreenshotBrowserSessionSnapshot } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";

const FACEBOOK_ALLOWED_HOSTS = new Set(["facebook.com", "www.facebook.com", "m.facebook.com"]);
const TIKTOK_ALLOWED_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com"]);

export type BrowserSessionGateResult = {
  decision: { status: "passed" | "failed" | "review_required" | "not_applicable"; reason: string | null };
  sessionSnapshot: ScreenshotBrowserSessionSnapshot | null;
  browserSessionRef: string | null;
  failure: ReturnType<typeof createScreenshotFailure> | null;
};

type UrlDriftPolicy = {
  platformId: "facebook-web" | "tiktok-web";
  allowedHosts: Set<string>;
  samePlatformStatus: "passed" | "review_required";
  samePlatformReason: string;
  samePlatformAction: "continue_capture" | "reopen_entry";
};

function normalizeComparableUrl(value: string) {
  if (!URL.canParse(value)) {
    return value;
  }

  const url = new URL(value);
  url.hash = "";
  return url.toString();
}

function parseComparableUrl(value: string | null): URL | null {
  if (!value || !URL.canParse(value)) {
    return null;
  }

  const url = new URL(value);
  url.hash = "";
  return url;
}

function resolveUrlDriftPolicy(expectedUrl: string): UrlDriftPolicy | null {
  const comparableUrl = parseComparableUrl(expectedUrl);
  const hostname = comparableUrl?.hostname.toLowerCase();
  if (!hostname) {
    return null;
  }

  if (FACEBOOK_ALLOWED_HOSTS.has(hostname)) {
    return {
      platformId: "facebook-web",
      allowedHosts: FACEBOOK_ALLOWED_HOSTS,
      samePlatformStatus: "passed",
      samePlatformReason: "facebook_same_platform_url_drift_warning",
      samePlatformAction: "continue_capture",
    };
  }

  if (TIKTOK_ALLOWED_HOSTS.has(hostname)) {
    return {
      platformId: "tiktok-web",
      allowedHosts: TIKTOK_ALLOWED_HOSTS,
      samePlatformStatus: "review_required",
      samePlatformReason: "tiktok_url_drift_reopen_entry",
      samePlatformAction: "reopen_entry",
    };
  }

  return null;
}

function isAllowedPlatformHost(url: URL | null, allowedHosts: Set<string>) {
  return url !== null && allowedHosts.has(url.hostname.toLowerCase());
}

function buildUrlDriftMessage(input: {
  event: "URL_DRIFT_WARNING" | "URL_DRIFT_RECOVERY_REQUIRED" | "URL_DRIFT_BLOCKED";
  platformId: string;
  action: string;
  expectedUrl: string;
  currentUrl: string;
}) {
  return `${input.event} platform=${input.platformId} action=${input.action} expected=${input.expectedUrl} actual=${input.currentUrl}`;
}

export function buildBrowserSessionGatePass(input: {
  reason: string | null;
  sessionSnapshot: ScreenshotBrowserSessionSnapshot;
  browserSessionRef: string;
}): BrowserSessionGateResult {
  return {
    decision: { status: "passed", reason: input.reason },
    sessionSnapshot: input.sessionSnapshot,
    browserSessionRef: input.browserSessionRef,
    failure: null,
  };
}

export function buildBrowserSessionGateFailure(input: {
  status: "failed" | "review_required";
  reason: string;
  message: string;
  detail?: string | null;
  sessionSnapshot: ScreenshotBrowserSessionSnapshot | null;
  browserSessionRef: string | null;
}): BrowserSessionGateResult {
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

function isSamePlatformUrlDrift(input: {
  driftPolicy: UrlDriftPolicy | null;
  expectedUrl: string;
  currentUrl: string;
}) {
  const expectedComparable = parseComparableUrl(input.expectedUrl);
  const currentComparable = parseComparableUrl(input.currentUrl);
  return Boolean(
    input.driftPolicy
      && isAllowedPlatformHost(expectedComparable, input.driftPolicy.allowedHosts)
      && isAllowedPlatformHost(currentComparable, input.driftPolicy.allowedHosts),
  );
}

function buildBlockedUrlDriftFailure(input: {
  driftPolicy: UrlDriftPolicy | null;
  expectedUrl: string;
  sessionSnapshot: ScreenshotBrowserSessionSnapshot;
  browserSessionRef: string;
}) {
  return buildBrowserSessionGateFailure({
    status: "failed",
    reason: "browser_session_url_mismatch",
    message: buildUrlDriftMessage({
      event: "URL_DRIFT_BLOCKED",
      platformId: input.driftPolicy?.platformId ?? "strict-url-match",
      action: "block_capture",
      expectedUrl: input.expectedUrl,
      currentUrl: input.sessionSnapshot.currentUrl,
    }),
    detail: `expected=${input.expectedUrl} actual=${input.sessionSnapshot.currentUrl}`,
    sessionSnapshot: input.sessionSnapshot,
    browserSessionRef: input.browserSessionRef,
  });
}

function buildSamePlatformUrlDriftOutcome(input: {
  driftPolicy: UrlDriftPolicy;
  expectedUrl: string;
  sessionSnapshot: ScreenshotBrowserSessionSnapshot;
  browserSessionRef: string;
}) {
  return input.driftPolicy.samePlatformStatus === "passed"
    ? buildBrowserSessionGatePass({
      reason: input.driftPolicy.samePlatformReason,
      sessionSnapshot: input.sessionSnapshot,
      browserSessionRef: input.browserSessionRef,
    })
    : buildBrowserSessionGateFailure({
      status: "review_required",
      reason: input.driftPolicy.samePlatformReason,
      message: buildUrlDriftMessage({
        event: "URL_DRIFT_RECOVERY_REQUIRED",
        platformId: input.driftPolicy.platformId,
        action: input.driftPolicy.samePlatformAction,
        expectedUrl: input.expectedUrl,
        currentUrl: input.sessionSnapshot.currentUrl,
      }),
      detail: `expected=${input.expectedUrl} actual=${input.sessionSnapshot.currentUrl}`,
      sessionSnapshot: input.sessionSnapshot,
      browserSessionRef: input.browserSessionRef,
    });
}

export function resolveBrowserSessionUrlFailure(input: {
  expectedUrl: string | null;
  sessionSnapshot: ScreenshotBrowserSessionSnapshot;
  browserSessionRef: string;
}): BrowserSessionGateResult | null {
  if (!input.expectedUrl) {
    return null;
  }

  const currentComparableUrl = normalizeComparableUrl(input.sessionSnapshot.currentUrl);
  const expectedComparableUrl = normalizeComparableUrl(input.expectedUrl);
  if (currentComparableUrl === expectedComparableUrl) {
    return null;
  }

  const driftPolicy = resolveUrlDriftPolicy(input.expectedUrl);
  if (!driftPolicy || !isSamePlatformUrlDrift({
    driftPolicy,
    expectedUrl: input.expectedUrl,
    currentUrl: input.sessionSnapshot.currentUrl,
  })) {
    return buildBlockedUrlDriftFailure({
      driftPolicy,
      expectedUrl: input.expectedUrl,
      sessionSnapshot: input.sessionSnapshot,
      browserSessionRef: input.browserSessionRef,
    });
  }

  return buildSamePlatformUrlDriftOutcome({
    driftPolicy,
    expectedUrl: input.expectedUrl,
    sessionSnapshot: input.sessionSnapshot,
    browserSessionRef: input.browserSessionRef,
  });
}