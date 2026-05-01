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
const evaluateRealChromeSessionSnapshot = (rawSnapshot: BrowserSessionSnapshot): RealChromeSessionGateResult => {
  status: "allow" | "block" | "review_required";
  reason: string | null;
  browserMode: BrowserSessionSnapshot["browserMode"];
  profileStatus: BrowserSessionSnapshot["profileStatus"];
  profileVerificationStatus: BrowserSessionSnapshot["profileVerificationStatus"];
}) => OpenSessionDecisionSchema.parse({
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

const buildSnapshotFailureResult = (reason: string): RealChromeSessionGateResult => buildRealChromeSessionGateResult({
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
}): RealChromeSessionGateResult => buildRealChromeSessionGateResult({
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

const buildAllowedSessionResult = (rawSnapshot: BrowserSessionSnapshot): RealChromeSessionGateResult => buildRealChromeSessionGateResult({
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

  return evaluateRealChromeSessionSnapshot(rawSnapshot);
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

  return buildAllowedSessionResult(rawSnapshot);
}