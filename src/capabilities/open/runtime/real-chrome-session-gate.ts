import type { BrowserSessionSnapshot, OpenSessionDecision } from "../contract.js";
import type { OpenBrowserPort } from "../ports/open-browser-port.js";
import { BrowserSessionSnapshotSchema, OpenSessionDecisionSchema } from "../schema.js";

type RealChromeSessionGateResult = {
  ok: boolean;
  failureCode: "session_gate_blocked" | "session_snapshot_failed" | null;
  status: "failed" | "review_required";
  reason: string | null;
  sessionSnapshot: BrowserSessionSnapshot | null;
  decision: OpenSessionDecision;
};

const buildSessionDecision = (input: {
  status: "allow" | "block" | "review_required";
  reason: string | null;
  browserMode: BrowserSessionSnapshot["browserMode"];
  profileStatus: BrowserSessionSnapshot["profileStatus"];
  profileVerificationStatus: BrowserSessionSnapshot["profileVerificationStatus"];
}) =>
  OpenSessionDecisionSchema.parse({
    status: input.status,
    reason: input.reason,
    browserMode: input.browserMode,
    profileStatus: input.profileStatus,
    profileVerificationStatus: input.profileVerificationStatus,
  });

const buildRealChromeSessionGateResult = (input: {
  ok: boolean;
  failureCode: "session_gate_blocked" | "session_snapshot_failed" | null;
  status: "failed" | "review_required";
  reason: string | null;
  sessionSnapshot: BrowserSessionSnapshot | null;
  decision: OpenSessionDecision;
}): RealChromeSessionGateResult => input;

const buildSnapshotFailureResult = (reason: string): RealChromeSessionGateResult =>
  buildRealChromeSessionGateResult({
    ok: false,
    failureCode: "session_snapshot_failed",
    status: "failed",
    reason,
    sessionSnapshot: null,
    decision: buildSessionDecision({
      status: "block",
      reason,
      browserMode: "unsupported",
      profileStatus: "profile_unavailable",
      profileVerificationStatus: "default_unverified",
    }),
  });

const buildBlockedSessionResult = (input: {
  rawSnapshot: BrowserSessionSnapshot;
  reason: string;
  status: "failed" | "review_required";
}): RealChromeSessionGateResult =>
  buildRealChromeSessionGateResult({
    ok: false,
    failureCode: "session_gate_blocked",
    status: input.status,
    reason: input.reason,
    sessionSnapshot: input.rawSnapshot,
    decision: buildSessionDecision({
      status: input.status === "failed" ? "block" : "review_required",
      reason: input.reason,
      browserMode: input.rawSnapshot.browserMode,
      profileStatus: input.rawSnapshot.profileStatus,
      profileVerificationStatus: input.rawSnapshot.profileVerificationStatus,
    }),
  });

const buildAllowedSessionResult = (rawSnapshot: BrowserSessionSnapshot): RealChromeSessionGateResult =>
  buildRealChromeSessionGateResult({
    ok: true,
    failureCode: null,
    status: "failed",
    reason: null,
    sessionSnapshot: rawSnapshot,
    decision: buildSessionDecision({
      status: "allow",
      reason: null,
      browserMode: rawSnapshot.browserMode,
      profileStatus: rawSnapshot.profileStatus,
      profileVerificationStatus: rawSnapshot.profileVerificationStatus,
    }),
  });

const resolveBrowserAndProfileSessionBlock = (rawSnapshot: BrowserSessionSnapshot): RealChromeSessionGateResult | null => {
  if (rawSnapshot.browserMode !== "real_chrome_persistent") {
    return buildBlockedSessionResult({
      rawSnapshot,
      reason: "governed open requires a real Chrome persistent browser session",
      status: "failed",
    });
  }

  if (rawSnapshot.profileStatus === "profile_missing" || rawSnapshot.profileStatus === "profile_unavailable") {
    return buildBlockedSessionResult({
      rawSnapshot,
      reason: "browser profile is not available for governed open",
      status: "failed",
    });
  }

  if (rawSnapshot.profileStatus === "profile_locked") {
    return buildBlockedSessionResult({
      rawSnapshot,
      reason: "browser profile is locked and requires operator review before governed open",
      status: "review_required",
    });
  }

  if (rawSnapshot.profileVerificationStatus !== "operator_verified") {
    return buildBlockedSessionResult({
      rawSnapshot,
      reason: rawSnapshot.profileVerificationReason ?? "browser profile is not operator verified for governed open",
      status: "review_required",
    });
  }

  return null;
};

const resolveLoginStateSessionBlock = (rawSnapshot: BrowserSessionSnapshot): RealChromeSessionGateResult | null => {
  if (rawSnapshot.loginState === "review_required") {
    return buildBlockedSessionResult({
      rawSnapshot,
      reason: rawSnapshot.reviewRequiredReason ?? "browser session requires operator review before governed open",
      status: "review_required",
    });
  }

  if (rawSnapshot.loginState === "login_required") {
    return buildBlockedSessionResult({
      rawSnapshot,
      reason: rawSnapshot.loginRequiredReason ?? "browser session requires login before governed open",
      status: "review_required",
    });
  }

  return null;
};

const evaluateRealChromeSessionSnapshot = (rawSnapshot: BrowserSessionSnapshot): RealChromeSessionGateResult => {
  const sessionBlock = resolveBrowserAndProfileSessionBlock(rawSnapshot) ?? resolveLoginStateSessionBlock(rawSnapshot);
  if (sessionBlock) {
    return sessionBlock;
  }

  return buildAllowedSessionResult(rawSnapshot);
};

export async function evaluateRealChromeSession(input: { browser: OpenBrowserPort }): Promise<RealChromeSessionGateResult> {
  try {
    const rawSnapshot = BrowserSessionSnapshotSchema.parse(await input.browser.getSessionSnapshot());
    return evaluateRealChromeSessionSnapshot(rawSnapshot);
  } catch (error) {
    return buildSnapshotFailureResult(error instanceof Error ? error.message : "failed to read browser session snapshot");
  }
}