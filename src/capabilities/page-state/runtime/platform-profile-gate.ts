import type { PageStateProfilePort } from "../ports/page-state-profile-port.js";
import type { PageStateAbilityInput } from "../schema.js";
import { DEFAULT_PAGE_STATE_PLATFORM_PROFILES } from "../shared/page-state-profile.js";
import type { PageStateGateFailure, PageStateResolvedPlatformProfile } from "../shared/page-state-types.js";

export function createDefaultPageStateProfilePort(): PageStateProfilePort {
  return {
    listProfiles() {
      return DEFAULT_PAGE_STATE_PLATFORM_PROFILES;
    },
    resolve(currentUrl, expectedProfileId) {
      const parsed = new URL(currentUrl);
      const matchedProfile = DEFAULT_PAGE_STATE_PLATFORM_PROFILES.find((profile) => profile.profileId === expectedProfileId)
        ?? DEFAULT_PAGE_STATE_PLATFORM_PROFILES.find((profile) => profile.hosts.includes(parsed.hostname.toLowerCase()));
      if (!matchedProfile) {
        return null;
      }

      const matchedHost = matchedProfile.hosts.find((host) => host === parsed.hostname.toLowerCase())
        ?? parsed.hostname.toLowerCase();
      return {
        profile: matchedProfile,
        profileId: matchedProfile.profileId,
        matchKind: matchedProfile.kind === "local_workbench" ? "local_workbench" : "host",
        matchedHost,
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
  const currentUrl = input.request.snapshot.currentUrl;
  if (currentUrl === "about:blank") {
    return {
      ok: false,
      platformDecision: "block",
      failure: {
        status: "blocked",
        decision: "block",
        failureReason: "platform_mismatch",
        stateSummary: "Page State blocked execution because the browser is still at about:blank.",
        reviewRequiredReason: "Review required because the platform page was never established.",
        pageStateType: "wrong_domain",
        confidence: 0,
        dataQualityFlags: ["platform_mismatch"],
      },
    };
  }

  const resolvedProfile = input.profilePort.resolve(currentUrl, input.request.openHandoff.platformProfileId);
  if (!resolvedProfile) {
    return {
      ok: false,
      platformDecision: "block",
      failure: {
        status: "blocked",
        decision: "block",
        failureReason: "platform_mismatch",
        stateSummary: "Page State blocked execution because the URL does not match any governed platform profile.",
        reviewRequiredReason: "Review required because the current domain is outside the governed platform profiles.",
        pageStateType: "wrong_domain",
        confidence: 0,
        dataQualityFlags: ["platform_mismatch", "unsupported_platform"],
      },
    };
  }

  if (resolvedProfile.profile.kind === "local_workbench" && !input.request.statePolicy.allowLocalWorkbench) {
    return {
      ok: false,
      platformDecision: "block",
      failure: {
        status: "blocked",
        decision: "block",
        failureReason: "platform_mismatch",
        stateSummary: "Page State blocked execution because local workbench is not allowed for this request.",
        reviewRequiredReason: "Review required because the request expected a real platform page.",
        pageStateType: "local_workbench",
        confidence: 0,
        dataQualityFlags: ["platform_mismatch"],
      },
    };
  }

  const expectedHost = input.request.statePolicy.expectedPlatformHost;
  if (expectedHost && !resolvedProfile.profile.hosts.includes(expectedHost)) {
    return {
      ok: false,
      platformDecision: "review_required",
      failure: {
        status: "review_required",
        decision: "review_required",
        failureReason: "platform_mismatch",
        stateSummary: `Page State detected a governed host mismatch: expected ${expectedHost}, got ${resolvedProfile.matchedHost}.`,
        reviewRequiredReason: "Review required because the resolved platform profile does not match the requested host.",
        pageStateType: "wrong_domain",
        confidence: 0,
        dataQualityFlags: ["platform_mismatch"],
      },
    };
  }

  return { ok: true, platformDecision: "match", profile: resolvedProfile };
}