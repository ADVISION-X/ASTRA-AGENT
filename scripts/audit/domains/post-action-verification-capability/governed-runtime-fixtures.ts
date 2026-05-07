import { createPostActionRuntime } from "../../../../src/lib/local-runtime/workbench-post-action-runtime.js";
import { buildPostActionVerificationInput } from "../../../../src/lib/local-runtime/workbench-post-action-dispatch-input.js";

function createFixtureRuntime(currentUrl: string, loginState: "logged_in" | "login_required"): Parameters<typeof buildPostActionVerificationInput>[0] {
  return {
    browserController: {
      getSessionState: () => ({
        currentUrl,
        currentTitle: "For You",
        loginState,
      }),
    },
  } as unknown as Parameters<typeof buildPostActionVerificationInput>[0];
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
  assertCondition(input.expectedOutcome.expectedUrlHost === "www.tiktok.com", "Builder must align observe-page-open-attempt expectedUrlHost with the canonical platform host.");
  assertCondition(pageStateObservation?.kind === "page_state", "Builder must emit a page_state observation for observe-page-open-attempt.");
  assertCondition(pageStateObservation?.source.sourceProofRef === input.actionProof.sourceRuntimeProofRef, "Builder must bind page-state observation back to the governed source proof ref.");

  const verificationResult = await abilityGroup.execute(input);
  assertCondition(verificationResult.status === "success" && verificationResult.output !== null, "observe-page-open-attempt fixture must reach governed success for a ready TikTok feed URL.");

  const invalidInputResult = await abilityGroup.execute({
    ...input,
    runId: "",
  });

  assertCondition(invalidInputResult.runId !== null, "Invalid-input fallback result must not emit runId=null.");
  assertCondition(invalidInputResult.runtimeProof.runId !== null, "Invalid-input fallback proof must not emit runId=null.");
  assertCondition(invalidInputResult.runId === invalidInputResult.runtimeProof.runId, "Invalid-input fallback result/proof runId must remain consistent.");
}
