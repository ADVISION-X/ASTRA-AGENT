import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import { resolvePageStatePlatformProfile as resolveObservationPlatformProfile, urlMatchesFeedPath } from "../../capabilities/page-state/shared/page-state-profile.js";
import type { RequestedPlatformId, WorkbenchRuntime } from "./workbench-contract.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadDocumentToObject, payloadValueToString } from "./workbench-payload.js";

const DEFAULT_PLATFORM_URL = {
  "tiktok-web": "https://www.tiktok.com/foryou",
  "facebook-web": "https://www.facebook.com/reel/",
} satisfies Record<RequestedPlatformId, string>;

const PAGE_STATE_CHILD_CAPABILITY_IDS = new Set([
  "detect-login-state",
  "detect-safety-page",
  "detect-feed-ready",
  "detect-video-stable",
  "detect-comment-panel-state",
  "detect-modal-overlay-state",
  "detect-page-abnormality",
  "detect-platform-page-kind",
]);

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

const resolvePageStateChildCapabilityId = (commandName: string) => {
  if (PAGE_STATE_CHILD_CAPABILITY_IDS.has(commandName)) {
    return commandName;
  }

  throw new Error(`Unsupported Page State child capability "${commandName}".`);
};

const collectSourceEvidenceRefs = (
  payload: Record<string, string | number | boolean | null>,
  envelope: AbilityCommandEnvelope,
) => {
  return [
    payloadValueToString(payload.sourceEvidenceRef),
    envelope.sourceRef,
    envelope.inputRef,
  ].filter((value, index, refs): value is string => Boolean(value) && refs.indexOf(value) === index);
};

const buildPageStateObservations = (input: {
  envelope: AbilityCommandEnvelope;
  currentUrl: string;
  loginState: ReturnType<WorkbenchRuntime["browserController"]["getSessionState"]>["loginState"];
  platformProfileId: RequestedPlatformId;
  sourceProofRef: string;
  capturedAt: string;
}) => {
  const resolvedProfile = resolveObservationPlatformProfile(input.platformProfileId);
  const feedReady = Boolean(resolvedProfile && URL.canParse(input.currentUrl) && urlMatchesFeedPath(input.currentUrl, resolvedProfile));
  const source = {
    sourceAbilityGroupId: "runtime-signal" as const,
    sourceChildCapabilityId: "page-runtime-signal",
    sourceProofRef: input.sourceProofRef,
  };

  return [
    {
      observationId: `${input.envelope.inputRef}:captcha-marker`,
      kind: "page_marker" as const,
      capturedAt: input.capturedAt,
      ...source,
      payload: {
        marker: "captcha" as const,
        present: input.loginState === "review_required",
        detail: input.loginState === "review_required" ? "Browser session requires review." : "No captcha review signal is active.",
      },
    },
    {
      observationId: `${input.envelope.inputRef}:safety-wall-marker`,
      kind: "page_marker" as const,
      capturedAt: input.capturedAt,
      ...source,
      payload: {
        marker: "safety_wall" as const,
        present: false,
        detail: "No governed safety-wall marker is present in the runtime session snapshot.",
      },
    },
    {
      observationId: `${input.envelope.inputRef}:feed-shell-marker`,
      kind: "page_marker" as const,
      capturedAt: input.capturedAt,
      ...source,
      payload: {
        marker: "feed_shell" as const,
        present: feedReady,
        detail: feedReady ? `Current URL matches ${input.platformProfileId} feed path.` : "Current URL does not confirm feed-shell readiness.",
      },
    },
    {
      observationId: `${input.envelope.inputRef}:post-open-capture`,
      kind: "platform_capture" as const,
      capturedAt: input.capturedAt,
      ...source,
      payload: {
        captureKind: "post_open_capture" as const,
        tags: feedReady ? ["feed-shell", "feed-ready"] : [],
        confidence: feedReady ? 0.84 : 0.51,
        detail: feedReady ? "Runtime session URL and platform profile indicate feed readiness." : "Runtime session capture does not yet prove feed readiness.",
      },
    },
  ];
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
  inputPayload: NerveBusPayloadDocument,
) => {
  const session = runtime.browserController.getSessionState();
  const platformProfileId = await resolvePageStatePlatformProfile(runtime);
  const payload = payloadDocumentToObject(inputPayload);
  const childCapabilityId = resolvePageStateChildCapabilityId(envelope.commandName);
  const sourceEvidenceRefs = collectSourceEvidenceRefs(payload, envelope);
  const openProofRef = sourceEvidenceRefs[0] ?? envelope.inputRef;
  const capturedAt = new Date().toISOString();
  const currentUrl = payloadValueToString(payload.targetUrl) ?? session.currentUrl ?? DEFAULT_PLATFORM_URL[platformProfileId];
  return JSON.parse(JSON.stringify({
    abilityGroupId: "page-state",
    childCapabilityId,
    runId: envelope.runId,
    missionId: envelope.missionId,
    sessionId: envelope.sessionId,
    roundId: envelope.roundId,
    videoVisitId: envelope.videoVisitId,
    stepId: envelope.stepId,
    mapPackageId: envelope.mapPackageId,
    mapPackageVersion: envelope.mapPackageVersion,
    selectedMapId: envelope.selectedMapId,
    selectedMapVersion: envelope.selectedMapVersion,
    activationSnapshotRef: envelope.activationSnapshotRef,
    capabilityCallId: envelope.capabilityCallId,
    nerveBusEnvelopeId: envelope.nerveBusEnvelopeId,
    requestedBy: "orchestration",
    snapshot: {
      snapshotId: `${envelope.inputRef}:snapshot`,
      currentUrl,
      currentTitle: session.currentTitle ?? "",
      browserLoginState: session.loginState,
      viewport: { width: 1, height: 1, deviceScaleFactor: 1 },
      scrollOffset: { x: 0, y: 0 },
      capturedAt,
      sourceAbilityGroupId: "runtime-signal",
      sourceChildCapabilityId: "nerve-bus-dispatch",
      sourceProofRef: envelope.inputRef,
    },
    observations: buildPageStateObservations({
      envelope,
      currentUrl,
      loginState: session.loginState,
      platformProfileId,
      sourceProofRef: openProofRef,
      capturedAt,
    }),
    sourceEvidenceRefs,
    freshnessPolicy: { maxSnapshotAgeMs: 300000, maxObservationAgeMs: 300000, maxObservationSkewMs: 300000 },
    confidencePolicy: { minimumConfidence: 0.5, allowReviewRequired: true },
    statePolicy: { expectedPlatformHost: null, allowLocalWorkbench: true, allowModalOverlay: false, allowUnknownState: true },
    openHandoff: { openProofRef, browserSessionRef: session.browserProfileRef, platformProfileId },
    previousPageStateFingerprint: null,
    inputRef: envelope.inputRef,
    idempotencyKey: envelope.idempotencyKey,
  }));
};