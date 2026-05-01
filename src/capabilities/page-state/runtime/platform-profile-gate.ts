import type { PageStateProfilePort } from "../ports/page-state-profile-port.js";
import type { PageStateAbilityInput, PageStateDataQualityFlag, PageStateFailureReason } from "../schema.js";
import { DEFAULT_PAGE_STATE_PLATFORM_PROFILES } from "../shared/page-state-profile.js";
import type { PageStateGateFailure, PageStateResolvedPlatformProfile } from "../shared/page-state-types.js";

function createPlatformProfileFailure(input: {
  status: "failed" | "review_required";
  decision: "block" | "review_required";
  failureReason: PageStateFailureReason;
  stateSummary: string;
  reviewRequiredReason: string | null;
  pageStateType: PageStateGateFailure["pageStateType"];
  dataQualityFlags: PageStateDataQualityFlag[];
}): { ok: false; platformDecision: "review_required" | "block"; failure: PageStateGateFailure } {
  return {
    ok: false,
    platformDecision: input.decision,
    failure: {
      status: input.status,
      decision: input.decision,
      failureReason: input.failureReason,
      stateSummary: input.stateSummary,
      reviewRequiredReason: input.reviewRequiredReason,
      pageStateType: input.pageStateType,
      confidence: 0,
      dataQualityFlags: input.dataQualityFlags,
    },
  };
}

function resolveAboutBlankPlatformProfileFailure(): { ok: false; platformDecision: "review_required" | "block"; failure: PageStateGateFailure } {
  return createPlatformProfileFailure({
    status: "failed",
    decision: "block",
    failureReason: "platform_mismatch",
    stateSummary: "Page State blocked execution because the browser is still at about:blank.",
    reviewRequiredReason: "Review required because the platform page was never established.",
    pageStateType: "wrong_domain",
    dataQualityFlags: ["platform_mismatch"],
  });
}

function resolveMissingProfileFailure(): { ok: false; platformDecision: "review_required" | "block"; failure: PageStateGateFailure } {
  return createPlatformProfileFailure({
    status: "failed",
    decision: "block",
    failureReason: "platform_mismatch",
    stateSummary: "Page State blocked execution because the URL does not match any governed platform profile.",
    reviewRequiredReason: "Review required because the current domain is outside the governed platform profiles.",
    pageStateType: "wrong_domain",
    dataQualityFlags: ["platform_mismatch", "unsupported_platform"],
  });
}

function resolveLocalWorkbenchPlatformProfileFailure(input: {
  request: PageStateAbilityInput;
  resolvedProfile: PageStateResolvedPlatformProfile;
}): { ok: false; platformDecision: "review_required" | "block"; failure: PageStateGateFailure } | null {
  if (input.resolvedProfile.profile.kind !== "local_workbench" || input.request.statePolicy.allowLocalWorkbench) {
    return null;
  }

  return createPlatformProfileFailure({
    status: "failed",
    decision: "block",
    failureReason: "platform_mismatch",
    stateSummary: "Page State blocked execution because local workbench is not allowed for this request.",
    reviewRequiredReason: "Review required because the request expected a real platform page.",
    pageStateType: "local_workbench",
    dataQualityFlags: ["platform_mismatch"],
  });
}

function resolveExpectedHostPlatformProfileFailure(input: {
  request: PageStateAbilityInput;
  resolvedProfile: PageStateResolvedPlatformProfile;
}): { ok: false; platformDecision: "review_required" | "block"; failure: PageStateGateFailure } | null {
  const expectedHost = input.request.statePolicy.expectedPlatformHost;
  if (!expectedHost || input.resolvedProfile.matchedHost === expectedHost.toLowerCase().replace(/\.$/, "")) {
    return null;
  }

  return createPlatformProfileFailure({
    status: "review_required",
    decision: "review_required",
    failureReason: "platform_mismatch",
    stateSummary: `Page State detected a governed host mismatch: expected ${expectedHost}, got ${input.resolvedProfile.matchedHost}.`,
    reviewRequiredReason: "Review required because the resolved platform profile does not match the requested host.",
    pageStateType: "wrong_domain",
    dataQualityFlags: ["platform_mismatch"],
  });
}

function resolvePlatformProfileFailure(input: {
  request: PageStateAbilityInput;
  profilePort: PageStateProfilePort;
}): { resolvedProfile: PageStateResolvedPlatformProfile | null; failure: { ok: false; platformDecision: "review_required" | "block"; failure: PageStateGateFailure } | null } {
  const currentUrl = input.request.snapshot.currentUrl;
  if (currentUrl === "about:blank") {
    return {
      resolvedProfile: null,
      failure: resolveAboutBlankPlatformProfileFailure(),
    };
  }

  const resolvedProfile = input.profilePort.resolve(currentUrl, input.request.openHandoff.platformProfileId);
  if (!resolvedProfile) {
    return {
      resolvedProfile: null,
      failure: resolveMissingProfileFailure(),
    };
  }

  const localWorkbenchFailure = resolveLocalWorkbenchPlatformProfileFailure({ request: input.request, resolvedProfile });
  if (localWorkbenchFailure) {
    return { resolvedProfile, failure: localWorkbenchFailure };
  }

  const expectedHostFailure = resolveExpectedHostPlatformProfileFailure({ request: input.request, resolvedProfile });
  if (expectedHostFailure) {
    return { resolvedProfile, failure: expectedHostFailure };
  }

  return { resolvedProfile, failure: null };
}

export function createDefaultPageStateProfilePort(): PageStateProfilePort {
  return {
    listProfiles() {
      return DEFAULT_PAGE_STATE_PLATFORM_PROFILES;
    },
    resolve(currentUrl, expectedProfileId) {
      const parsed = new URL(currentUrl);
      const normalizedHost = parsed.hostname.toLowerCase().replace(/\.$/, "");
      const expectedProfile = DEFAULT_PAGE_STATE_PLATFORM_PROFILES.find((profile) => profile.profileId === expectedProfileId);
      if (!expectedProfile) {
        return null;
      }
      const matchedHost = expectedProfile.hosts.find((host) => host === normalizedHost) ?? null;
      if (!matchedHost) {
        return null;
      }
      return {
        profile: expectedProfile,
        profileId: expectedProfile.profileId,
        expectedProfileId,
        matchKind: expectedProfile.kind === "local_workbench" ? "local_workbench" : "host",
        matchedHost,
        hostMatched: true,
      };
    },
  };
}

export function gatePlatformProfile(input: {
  request: PageStateAbilityInput;
  profilePort: PageStateProfilePort;
}):
  | { ok: true; platformDecision: "match"; profile: PageStateResolvedPlatformProfile }
  | { ok: false; platformDecision: "review_required" | "block"; failure: PageStateGateFailure } {
  const resolution = resolvePlatformProfileFailure(input);
  if (resolution.failure) {
    return resolution.failure;
  }

  return { ok: true, platformDecision: "match", profile: resolution.resolvedProfile! };
}