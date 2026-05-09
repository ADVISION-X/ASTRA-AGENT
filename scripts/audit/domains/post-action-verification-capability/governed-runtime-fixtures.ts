import { createPostActionRuntime } from "../../../../src/lib/local-runtime/workbench-post-action-runtime.js";
import { buildPostActionVerificationInput } from "../../../../src/lib/local-runtime/workbench-post-action-dispatch-input.js";

const buildFixtureActionResult = (message: string) => ({
  browserActionId: `fixture:${message}`,
  ok: true,
  message,
  createdAt: "2026-05-05T00:00:00.000Z",
  fallbackUsed: false,
});

const buildFixtureGeometrySnapshot = (currentUrl: string, currentTitle: string) => ({
  windowX: 0,
  windowY: 0,
  viewportWidth: 1440,
  viewportHeight: 900,
  screenshotWidth: 1440,
  screenshotHeight: 900,
  scaleFactor: 1,
  currentUrl,
  pageTitle: currentTitle,
  visibleContentBounds: {
    x: 0,
    y: 0,
    width: 1440,
    height: 900,
  },
  capturedAt: "2026-05-05T00:00:00.000Z",
});

const buildFixtureSessionState = (
  currentUrl: string,
  currentTitle: string,
  loginState: "logged_in" | "login_required",
) => ({
  browserMode: "fixture" as const,
  browserProfileRef: "fixture-profile",
  browserExecutablePath: null,
  profileStatus: loginState,
  profileDirectory: "/tmp/grasseye-fixture-profile",
  profileProvisioning: "managed_default" as const,
  profileVerificationStatus: "operator_verified" as const,
  profileVerificationReason: null,
  currentUrl,
  lastLoginCheckAt: null,
  loginRequiredReason: loginState === "login_required" ? "fixture_login_required" : null,
  currentTitle,
  loginState,
  reviewRequiredReason: null,
  open: true,
  browserExecutable: null,
});

const buildFixtureScreenshotResult = (currentUrl: string, currentTitle: string) => ({
  browserActionId: "fixture:screenshot",
  pageUrl: currentUrl,
  pageTitle: currentTitle,
  regionLabel: "fixture-region",
  regionType: "full_page",
  width: 1440,
  height: 900,
  viewportWidth: 1440,
  viewportHeight: 900,
  sourceFilePath: "/tmp/grasseye-fixture.png",
  createdAt: "2026-05-05T00:00:00.000Z",
});

const buildFixtureBrowserActionHandlers = (currentUrl: string, currentTitle: string) => ({
  open: async () => buildFixtureActionResult("open"),
  scroll: async () => buildFixtureActionResult("scroll"),
  click: async () => buildFixtureActionResult("click"),
  textInput: async () => buildFixtureActionResult("text-input"),
  screenshotRegion: async () => buildFixtureScreenshotResult(currentUrl, currentTitle),
  wait: async () => buildFixtureActionResult("wait"),
  close: async () => buildFixtureActionResult("close"),
});

const buildFixtureBrowserController = (
  currentUrl: string,
  currentTitle: string,
  loginState: "logged_in" | "login_required",
) => ({
  getHealth: () => ({ ok: true, detail: "fixture_browser_ready" }),
  getSessionState: () => buildFixtureSessionState(currentUrl, currentTitle, loginState),
  getGeometrySnapshot: async () => buildFixtureGeometrySnapshot(currentUrl, currentTitle),
  ...buildFixtureBrowserActionHandlers(currentUrl, currentTitle),
});

function createFixtureRuntime(currentUrl: string, loginState: "logged_in" | "login_required"): Parameters<typeof buildPostActionVerificationInput>[0] {
  const currentTitle = "For You";
  return {
    browserController: buildFixtureBrowserController(currentUrl, currentTitle, loginState),
  };
}

function createFixtureEnvelope(): Parameters<typeof buildPostActionVerificationInput>[1] {
  return {
    commandName: "observe-page-open-attempt",
    missionId: "mission-1",
    runId: "run-1",
    sessionId: "mission-1",
    roundId: "0",
    videoVisitId: null,
    stepId: "observe-page-open-attempt",
    mapPackageId: "builtin.tiktok-seeding-video-discovery",
    mapPackageVersion: "1.0.0",
    selectedMapId: "tiktok.seeding-video.discovery.meta.v1",
    selectedMapVersion: "1.0.0",
    activationSnapshotRef: "activation-snapshot:1",
    capabilityCallId: "mission-1:observe-page-open-attempt:1:ability",
    nerveBusEnvelopeId: "env-1",
    inputRef: "result-ref-1",
    idempotencyKey: "idem-1",
    createdAt: "2026-05-05T00:00:00.000Z",
  } as Parameters<typeof buildPostActionVerificationInput>[1];
}

function createDefaultVerificationEnvelope(): Parameters<typeof buildPostActionVerificationInput>[1] {
  return {
    ...createFixtureEnvelope(),
    commandName: "verify-action-result",
    stepId: "verify-action-result",
    capabilityCallId: "mission-1:verify-action-result:1:ability",
  } as Parameters<typeof buildPostActionVerificationInput>[1];
}

function createFixturePayload(): Parameters<typeof buildPostActionVerificationInput>[2] {
  return {
    documentType: "orchestration.ability_dispatch",
    documentRef: "result-ref-1",
    summary: "Verify opened page",
    entityRefs: [],
    evidenceRefs: [],
    contentBlocks: [{ key: "abilityResultRef", value: "result-ref-1" }],
  } as Parameters<typeof buildPostActionVerificationInput>[2];
}

function assertCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export async function runPostActionGovernedRuntimeFixtures(): Promise<void> {
  const runtime = createFixtureRuntime("https://www.tiktok.com/foryou", "logged_in");
  const input = await buildPostActionVerificationInput(runtime, createFixtureEnvelope(), createFixturePayload());
  const pageStateObservation = input.observationSet.observations[0];
  const abilityGroup = createPostActionRuntime().postActionVerificationAbilityGroup;

  assertCondition(input.runId === "run-1", "Builder must preserve runId from the governed envelope.");
  assertCondition(!("confidencePolicy" in input), "Builder must not emit cognition-owned confidencePolicy into the PAV request.");
  assertCondition(input.expectedOutcome.expectedUrlHost === "www.tiktok.com", "Builder must align observe-page-open-attempt expectedUrlHost with the canonical platform host.");
  assertCondition(pageStateObservation?.kind === "page_state", "Builder must emit a page_state observation for observe-page-open-attempt.");
  assertCondition(pageStateObservation?.source.sourceProofRef === input.actionProof.sourceRuntimeProofRef, "Builder must bind page-state observation back to the governed source proof ref.");

  const verificationResult = await abilityGroup.execute(input);
  assertCondition(verificationResult.status === "success" && verificationResult.output !== null, "observe-page-open-attempt fixture must reach governed success for a ready TikTok feed URL.");
  const successOutput = verificationResult.output;
  assertCondition(!("verificationDecision" in verificationResult), "PAV result must not emit final verificationDecision.");
  assertCondition(!("verificationDecision" in verificationResult.runtimeProof), "PAV runtime proof must not emit final verificationDecision.");
  assertCondition(successOutput !== null && successOutput.postActionObservationRef.length > 0, "Governed success must emit postActionObservationRef.");
  assertCondition(successOutput !== null && successOutput.actionObservationBundleRef.length > 0, "Governed success must emit actionObservationBundleRef.");

  const invalidInputResult = await abilityGroup.execute({
    ...input,
    runId: "",
  });

  assertCondition(invalidInputResult.runId !== null, "Invalid-input fallback result must not emit runId=null.");
  assertCondition(invalidInputResult.runtimeProof.runId !== null, "Invalid-input fallback proof must not emit runId=null.");
  assertCondition(invalidInputResult.runId === invalidInputResult.runtimeProof.runId, "Invalid-input fallback result/proof runId must remain consistent.");

  const defaultVerificationInput = await buildPostActionVerificationInput(runtime, createDefaultVerificationEnvelope(), createFixturePayload());
  const defaultVerificationResult = await abilityGroup.execute(defaultVerificationInput);
  assertCondition(defaultVerificationResult.status === "failed", "Generic verify-action-result must fail when before/after evidence is required but missing.");
}
