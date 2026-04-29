import type { BrowserSessionSnapshot, OpenSessionDecision } from "../contract.js";
import type { OpenBrowserPort } from "../ports/open-browser-port.js";
import { BrowserSessionSnapshotSchema, OpenSessionDecisionSchema } from "../schema.js";

export async function evaluateRealChromeSession(input: {
  browser: OpenBrowserPort;
}): Promise<{
  ok: boolean;
  failureCode: "session_gate_blocked" | "session_snapshot_failed" | null;
  status: "failed" | "review_required";
  reason: string | null;
  sessionSnapshot: BrowserSessionSnapshot | null;
  decision: OpenSessionDecision;
}> {
  let rawSnapshot: BrowserSessionSnapshot;
  try {
    rawSnapshot = BrowserSessionSnapshotSchema.parse(await input.browser.getSessionSnapshot());
  } catch (error) {
    return {
      ok: false,
      failureCode: "session_snapshot_failed",
      status: "failed",
      reason: error instanceof Error ? error.message : "open browser session snapshot failed",
      sessionSnapshot: null,
      decision: OpenSessionDecisionSchema.parse({
        status: "block",
        reason: error instanceof Error ? error.message : "open browser session snapshot failed",
        browserMode: "unsupported",
        profileStatus: "profile_unavailable",
        profileVerificationStatus: "default_unverified",
      }),
    };
  }

  if (rawSnapshot.browserMode !== "real_chrome_persistent") {
    return {
      ok: false,
      failureCode: "session_gate_blocked",
      status: "failed",
      reason: "open requires a real_chrome_persistent browser session",
      sessionSnapshot: rawSnapshot,
      decision: OpenSessionDecisionSchema.parse({
        status: "block",
        reason: "open requires a real_chrome_persistent browser session",
        browserMode: rawSnapshot.browserMode,
        profileStatus: rawSnapshot.profileStatus,
        profileVerificationStatus: rawSnapshot.profileVerificationStatus,
      }),
    };
  }

  if (rawSnapshot.profileVerificationStatus !== "operator_verified") {
    return {
      ok: false,
      failureCode: "session_gate_blocked",
      status: "review_required",
      reason: "browser session profile must be operator_verified before governed open",
      sessionSnapshot: rawSnapshot,
      decision: OpenSessionDecisionSchema.parse({
        status: "review_required",
        reason: "browser session profile must be operator_verified before governed open",
        browserMode: rawSnapshot.browserMode,
        profileStatus: rawSnapshot.profileStatus,
        profileVerificationStatus: rawSnapshot.profileVerificationStatus,
      }),
    };
  }

  if (rawSnapshot.profileStatus !== "profile_ready" && rawSnapshot.profileStatus !== "logged_in") {
    return {
      ok: false,
      failureCode: "session_gate_blocked",
      status: "review_required",
      reason: `browser profile is not ready for governed open: ${rawSnapshot.profileStatus}`,
      sessionSnapshot: rawSnapshot,
      decision: OpenSessionDecisionSchema.parse({
        status: "review_required",
        reason: `browser profile is not ready for governed open: ${rawSnapshot.profileStatus}`,
        browserMode: rawSnapshot.browserMode,
        profileStatus: rawSnapshot.profileStatus,
        profileVerificationStatus: rawSnapshot.profileVerificationStatus,
      }),
    };
  }

  if (rawSnapshot.loginState === "review_required") {
    return {
      ok: false,
      failureCode: "session_gate_blocked",
      status: "review_required",
      reason: rawSnapshot.reviewRequiredReason ?? "browser session requires operator review before governed open",
      sessionSnapshot: rawSnapshot,
      decision: OpenSessionDecisionSchema.parse({
        status: "review_required",
        reason: rawSnapshot.reviewRequiredReason ?? "browser session requires operator review before governed open",
        browserMode: rawSnapshot.browserMode,
        profileStatus: rawSnapshot.profileStatus,
        profileVerificationStatus: rawSnapshot.profileVerificationStatus,
      }),
    };
  }

  if (rawSnapshot.loginState === "login_required") {
    return {
      ok: false,
      failureCode: "session_gate_blocked",
      status: "review_required",
      reason: rawSnapshot.loginRequiredReason ?? "browser session requires login before governed open",
      sessionSnapshot: rawSnapshot,
      decision: OpenSessionDecisionSchema.parse({
        status: "review_required",
        reason: rawSnapshot.loginRequiredReason ?? "browser session requires login before governed open",
        browserMode: rawSnapshot.browserMode,
        profileStatus: rawSnapshot.profileStatus,
        profileVerificationStatus: rawSnapshot.profileVerificationStatus,
      }),
    };
  }

  return {
    ok: true,
    failureCode: null,
    status: "failed",
    reason: null,
    sessionSnapshot: rawSnapshot,
    decision: OpenSessionDecisionSchema.parse({
      status: "allow",
      reason: null,
      browserMode: rawSnapshot.browserMode,
      profileStatus: rawSnapshot.profileStatus,
      profileVerificationStatus: rawSnapshot.profileVerificationStatus,
    }),
  };
}