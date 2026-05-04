import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { RequestedPlatformId, WorkbenchRuntime } from "./workbench-contract.js";

const DEFAULT_PLATFORM_URL = {
  "tiktok-web": "https://www.tiktok.com/foryou",
  "facebook-web": "https://www.facebook.com/reel/",
} satisfies Record<RequestedPlatformId, string>;

const resolvePlatformFromUrl = (currentUrl: string): RequestedPlatformId | null => {
  if (!URL.canParse(currentUrl)) {
    return null;
  }

  const { hostname } = new URL(currentUrl);
  if (hostname.includes("facebook.com")) {
    return "facebook-web";
  }
  if (hostname.includes("tiktok.com")) {
    return "tiktok-web";
  }

  return null;
};

const resolveShellPlatform = (platformTarget: WorkbenchRuntime["options"]["platformTarget"]): RequestedPlatformId | null => {
  return platformTarget === "facebook-web" || platformTarget === "tiktok-web" ? platformTarget : null;
};

const resolvePageStatePlatformProfile = async (runtime: WorkbenchRuntime): Promise<RequestedPlatformId> => {
  const session = runtime.browserController.getSessionState();
  const platformFromUrl = resolvePlatformFromUrl(session.currentUrl);
  if (platformFromUrl) {
    return platformFromUrl;
  }

  const mission = await runtime.orchestrationAbilityGroup.getMissionState();
  if (mission.requestedPlatform) {
    return mission.requestedPlatform;
  }

  const shellPlatform = resolveShellPlatform(runtime.options.platformTarget);
  if (shellPlatform) {
    return shellPlatform;
  }

  throw new Error("Page State dispatch requires a mission requestedPlatform or a known real-platform currentUrl.");
};

export const buildPageStateDispatchInput = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
) => {
  const session = runtime.browserController.getSessionState();
  const platformProfileId = await resolvePageStatePlatformProfile(runtime);
  return JSON.parse(JSON.stringify({
    childCapabilityId: envelope.commandName === "detect-feed-ready" ? "detect-feed-ready" : "detect-platform-page-kind",
    runId: envelope.mapId,
    missionId: envelope.missionId,
    sessionId: envelope.missionId,
    roundId: envelope.stepId,
    videoVisitId: "page-state-dispatch",
    requestedBy: "orchestration",
    snapshot: {
      snapshotId: `${envelope.inputRef}:snapshot`,
      currentUrl: session.currentUrl || DEFAULT_PLATFORM_URL[platformProfileId],
      currentTitle: session.currentTitle ?? "",
      browserLoginState: session.loginState,
      viewport: { width: 1, height: 1, deviceScaleFactor: 1 },
      scrollOffset: { x: 0, y: 0 },
      capturedAt: new Date().toISOString(),
      sourceAbilityGroupId: "runtime-signal",
      sourceChildCapabilityId: "nerve-bus-dispatch",
      sourceProofRef: envelope.inputRef,
    },
    observations: [],
    sourceEvidenceRefs: [envelope.inputRef],
    freshnessPolicy: { maxSnapshotAgeMs: 300000, maxObservationAgeMs: 300000, maxObservationSkewMs: 300000 },
    confidencePolicy: { minimumConfidence: 0.5, allowReviewRequired: true },
    statePolicy: { expectedPlatformHost: null, allowLocalWorkbench: true, allowModalOverlay: false, allowUnknownState: true },
    openHandoff: { openProofRef: envelope.inputRef, browserSessionRef: envelope.missionId, platformProfileId },
    previousPageStateFingerprint: null,
  }));
};