import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import { resolvePageStatePlatformProfile as resolveObservationPlatformProfile, urlMatchesFeedPath } from "../../capabilities/page-state/shared/page-state-profile.js";
import type { RequestedPlatformId, WorkbenchRuntime } from "./workbench-contract.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadDocumentToObject, payloadValueToString } from "./workbench-payload.js";

const DEFAULT_PLATFORM_URL = {
  "tiktok-web": "https://www.tiktok.com/foryou",
  "facebook-web": "https://www.facebook.com/reel/",
  "macos-local": "grasseye-local-app://iphone-mirroring",
  "iphone-mirroring-facebook-app": "grasseye-local-app://iphone-mirroring/facebook",
  "iphone-mirroring-tiktok-app": "grasseye-local-app://iphone-mirroring/tiktok",
} satisfies Record<RequestedPlatformId, string>;

const PAGE_STATE_CHILD_CAPABILITY_IDS = new Set([
  "observe-login-surface",
  "observe-safety-surface",
  "observe-feed-surface",
  "observe-video-surface",
  "observe-comment-panel-surface",
  "observe-modal-overlay-surface",
  "observe-page-abnormality-surface",
  "observe-platform-surface",
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
  return platformTarget === "facebook-web" || platformTarget === "tiktok-web" || platformTarget === "macos-local" || platformTarget === "iphone-mirroring-facebook-app" || platformTarget === "iphone-mirroring-tiktok-app"
    ? platformTarget
    : null;
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

type BrowserLoginState = ReturnType<WorkbenchRuntime["browserController"]["getSessionState"]>["loginState"];

type ObservationBuildInput = {
  envelope: AbilityCommandEnvelope;
  currentUrl: string;
  loginState: BrowserLoginState;
  platformProfileId: RequestedPlatformId;
  sourceProofRef: string;
  capturedAt: string;
};

type DispatchPayloadBuildInput = {
  envelope: AbilityCommandEnvelope;
  session: ReturnType<WorkbenchRuntime["browserController"]["getSessionState"]>;
  childCapabilityId: string;
  sourceEvidenceRefs: string[];
  openProofRef: string;
  currentUrl: string;
  platformProfileId: RequestedPlatformId;
  capturedAt: string;
  observations: ReturnType<typeof buildPageStateObservations>;
};

const buildObservationSource = (sourceProofRef: string) => ({
  sourceAbilityGroupId: "runtime-signal" as const,
  sourceChildCapabilityId: "page-runtime-signal",
  sourceProofRef,
});

const buildFeedReady = (currentUrl: string, platformProfileId: RequestedPlatformId): boolean => {
  const resolvedProfile = resolveObservationPlatformProfile(platformProfileId);
  return Boolean(resolvedProfile && URL.canParse(currentUrl) && urlMatchesFeedPath(currentUrl, resolvedProfile));
};

const buildCaptchaObservation = (input: ObservationBuildInput) => ({
  observationId: `${input.envelope.inputRef}:captcha-marker`,
  kind: "page_marker" as const,
  capturedAt: input.capturedAt,
  ...buildObservationSource(input.sourceProofRef),
  payload: {
    marker: "captcha" as const,
    present: input.loginState === "review_required",
    detail: input.loginState === "review_required" ? "Browser session requires review." : "No captcha review signal is active.",
  },
});

const buildSafetyWallObservation = (input: ObservationBuildInput) => ({
  observationId: `${input.envelope.inputRef}:safety-wall-marker`,
  kind: "page_marker" as const,
  capturedAt: input.capturedAt,
  ...buildObservationSource(input.sourceProofRef),
  payload: {
    marker: "safety_wall" as const,
    present: false,
    detail: "No governed safety-wall marker is present in the runtime session snapshot.",
  },
});

const buildFeedShellObservation = (input: ObservationBuildInput) => {
  const feedReady = buildFeedReady(input.currentUrl, input.platformProfileId);

  return {
    observationId: `${input.envelope.inputRef}:feed-shell-marker`,
    kind: "page_marker" as const,
    capturedAt: input.capturedAt,
    ...buildObservationSource(input.sourceProofRef),
    payload: {
      marker: "feed_shell" as const,
      present: feedReady,
      detail: feedReady ? `Current URL matches ${input.platformProfileId} feed path.` : "Current URL does not confirm feed-shell readiness.",
    },
  };
};

const buildPostOpenCaptureObservation = (input: ObservationBuildInput) => {
  const feedReady = buildFeedReady(input.currentUrl, input.platformProfileId);

  return {
    observationId: `${input.envelope.inputRef}:post-open-capture`,
    kind: "platform_capture" as const,
    capturedAt: input.capturedAt,
    ...buildObservationSource(input.sourceProofRef),
    payload: {
      captureKind: "post_open_capture" as const,
      tags: feedReady ? ["feed-shell", "feed-ready"] : [],
      confidence: feedReady ? 0.84 : 0.51,
      detail: feedReady ? "Runtime session URL and platform profile indicate feed readiness." : "Runtime session capture does not yet prove feed readiness.",
    },
  };
};

const buildPageStateObservations = (input: {
  envelope: AbilityCommandEnvelope;
  currentUrl: string;
  loginState: ReturnType<WorkbenchRuntime["browserController"]["getSessionState"]>["loginState"];
  platformProfileId: RequestedPlatformId;
  sourceProofRef: string;
  capturedAt: string;
}) => {
  return [
    buildCaptchaObservation(input),
    buildSafetyWallObservation(input),
    buildFeedShellObservation(input),
    buildPostOpenCaptureObservation(input),
  ];
};

const buildPageStateSnapshot = (input: DispatchPayloadBuildInput) => ({
  snapshotId: `${input.envelope.inputRef}:snapshot`,
  currentUrl: input.currentUrl,
  currentTitle: input.session.currentTitle ?? "",
  browserLoginState: input.session.loginState,
  viewport: { width: 1, height: 1, deviceScaleFactor: 1 },
  scrollOffset: { x: 0, y: 0 },
  capturedAt: input.capturedAt,
  sourceAbilityGroupId: "runtime-signal",
  sourceChildCapabilityId: "nerve-bus-dispatch",
  sourceProofRef: input.envelope.inputRef,
});

const buildPageStatePolicies = () => ({
  statePolicy: { expectedPlatformHost: null, allowLocalWorkbench: true, allowModalOverlay: false, allowUnknownState: true },
});

const buildDispatchCurrentUrl = (
  payload: Record<string, string | number | boolean | null>,
  session: ReturnType<WorkbenchRuntime["browserController"]["getSessionState"]>,
  platformProfileId: RequestedPlatformId,
) => payloadValueToString(payload.targetUrl) ?? session.currentUrl ?? DEFAULT_PLATFORM_URL[platformProfileId];

const buildPageStateDispatchPayload = (input: DispatchPayloadBuildInput) => ({
  abilityGroupId: "page-state",
  childCapabilityId: input.childCapabilityId,
  runId: input.envelope.runId,
  missionId: input.envelope.missionId,
  sessionId: input.envelope.sessionId,
  roundId: input.envelope.roundId,
  videoVisitId: input.envelope.videoVisitId,
  stepId: input.envelope.stepId,
  mapPackageId: input.envelope.mapPackageId,
  mapPackageVersion: input.envelope.mapPackageVersion,
  selectedMapId: input.envelope.selectedMapId,
  selectedMapVersion: input.envelope.selectedMapVersion,
  activationSnapshotRef: input.envelope.activationSnapshotRef,
  capabilityCallId: input.envelope.capabilityCallId,
  nerveBusEnvelopeId: input.envelope.nerveBusEnvelopeId,
  requestedBy: "orchestration",
  snapshot: buildPageStateSnapshot(input),
  observations: input.observations,
  sourceEvidenceRefs: input.sourceEvidenceRefs,
  openHandoff: { openProofRef: input.openProofRef, browserSessionRef: input.session.browserProfileRef, platformProfileId: input.platformProfileId },
  previousPageStateFingerprint: null,
  inputRef: input.envelope.inputRef,
  idempotencyKey: input.envelope.idempotencyKey,
  ...buildPageStatePolicies(),
});

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
  const currentUrl = buildDispatchCurrentUrl(payload, session, platformProfileId);
  const observations = buildPageStateObservations({
    envelope,
    currentUrl,
    loginState: session.loginState,
    platformProfileId,
    sourceProofRef: openProofRef,
    capturedAt,
  });

  return JSON.parse(JSON.stringify(buildPageStateDispatchPayload({
    envelope,
    session,
    childCapabilityId,
    sourceEvidenceRefs,
    openProofRef,
    currentUrl,
    platformProfileId,
    capturedAt,
    observations,
  })));
};
