import type {
  BrowserSessionSnapshot,
  OpenChildCapabilityId,
  OpenPlatformId,
  OpenResult,
  OpenTargetKind,
} from "../contract.js";
import { createOpenFailure } from "../shared/open-failure.js";
import { buildOpenResult } from "./open-result-builder.js";

function createFallbackSession(): BrowserSessionSnapshot {
  return {
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
    profileVerificationReason: "session snapshot unavailable",
    loginState: "unknown",
    lastLoginCheckAt: null,
    loginRequiredReason: null,
    reviewRequiredReason: null,
  };
}

export function buildOpenDispatchFailure(input: {
  request: {
    childCapabilityId: OpenChildCapabilityId;
    platformId: OpenPlatformId;
    targetKind: OpenTargetKind;
    missionId: string;
    runId: string;
    sessionId: string;
    roundId: string | null;
    videoVisitId: string | null;
    sourceAbilityGroupId: string;
    sourceChildCapabilityId: string | null;
    targetUrl: string;
    targetTitle: string | null;
    sourceRef: string | null;
  };
  failureCode: "unknown_child" | "input_schema_invalid" | "target_policy_blocked" | "url_policy_blocked" | "session_gate_blocked" | "session_snapshot_failed" | "navigation_timeout" | "navigation_failed" | "post_open_state_failed" | "child_execution_failed" | "duplicate_open_blocked";
  startedAt: string;
  endedAt: string;
  startedMonotonicMs: number;
  endedMonotonicMs: number;
  reason: string;
  status: OpenResult["status"];
}): OpenResult {
  const session = createFallbackSession();
  const scheme = input.request.targetUrl.startsWith("https://") ? "https" : "http";
  return buildOpenResult({
    request: {
      abilityGroupId: "open",
      requestedBy: "invalid-input",
      reason: input.reason,
      ...input.request,
    },
    profile: {
      childCapabilityId: input.request.childCapabilityId,
      targetKind: input.request.targetKind,
      platformId: input.request.platformId,
      allowedHostnames: ["127.0.0.1"],
      defaultUrl: input.request.targetUrl,
      defaultTitle: input.request.targetTitle ?? input.request.childCapabilityId,
      requiresRealChromeSession: true,
      allowsLocalhost: input.request.targetKind === "local-workbench",
      maxOpenDurationMs: 1,
      allowedSchemes: [scheme],
      postOpenStatePolicy: {
        allowLoginWallReview: true,
        allowSecurityWallReview: true,
        allowBlankPageReview: true,
        requirePageTitle: true,
      },
      pageStateHandoffRequired: true,
      allowReplay: false,
    },
    targetPolicyDecision: {
      status: "allow",
      reason: null,
      targetProfileRef: `open-target-profile:${input.request.childCapabilityId}`,
      resolvedTargetUrl: input.request.targetUrl,
      resolvedTargetTitle: input.request.targetTitle ?? input.request.childCapabilityId,
    },
    urlSafetyDecision: {
      status: "allow",
      reason: null,
      normalizedUrl: input.request.targetUrl,
      hostname: "127.0.0.1",
      scheme,
    },
    sessionDecision: {
      status: "block",
      reason: input.reason,
      browserMode: session.browserMode,
      profileStatus: session.profileStatus,
      profileVerificationStatus: session.profileVerificationStatus,
    },
    navigationDecision: {
      status: "browser_failed",
      reason: input.reason,
      browserActionId: null,
      fallbackUsed: false,
      openedUrl: session.currentUrl,
      pageTitleAfter: session.currentTitle,
      navigationAttemptRef: `${input.request.runId}:dispatch-failure`,
      redirectChain: [input.request.targetUrl],
    },
    postOpenStateDecision: {
      status: input.status,
      classification: "unknown",
      reason: input.reason,
      openedUrl: session.currentUrl,
      pageTitleAfter: session.currentTitle,
      pageStateHandoffRequired: false,
    },
    idempotencyKey: `${input.request.runId}:dispatch-failure`,
    beforeSession: session,
    afterSession: session,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    startedMonotonicMs: input.startedMonotonicMs,
    endedMonotonicMs: input.endedMonotonicMs,
    failureReason: createOpenFailure({
      code: input.failureCode,
      message: input.reason,
    }),
    reviewRequiredReason: input.status === "review_required" ? input.reason : null,
    dataQualityFlags: ["dispatch_failure"],
  });
}