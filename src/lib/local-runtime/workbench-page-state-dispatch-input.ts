import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";

export const buildPageStateDispatchInput = (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
) => {
  const session = runtime.browserController.getSessionState();
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
      currentUrl: session.currentUrl || "https://www.tiktok.com/foryou",
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
    openHandoff: { openProofRef: envelope.inputRef, browserSessionRef: envelope.missionId, platformProfileId: "tiktok-web" },
    previousPageStateFingerprint: null,
  }));
};