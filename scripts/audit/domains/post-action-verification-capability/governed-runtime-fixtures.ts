import { tmpdir } from "node:os";
import path from "node:path";
import { writeFile } from "node:fs/promises";

import sharp from "sharp";

import { createPostActionRuntime } from "../../../../src/lib/local-runtime/workbench-post-action-runtime.js";
import { buildPostActionVerificationInput } from "../../../../src/lib/local-runtime/workbench-post-action-dispatch-input.js";
import { recordAbilityResultProofSummary } from "../../../../src/capabilities/orchestration/runtime/ability-result-proof-summary-registry.js";

const changedBeforeSignature = `ahash16:${"0".repeat(256)}`;

function createFixtureRuntime(currentUrl: string, loginState: "logged_in" | "login_required"): Parameters<typeof buildPostActionVerificationInput>[0] {
  return {
    browserController: {
      getSessionState: () => ({
        currentUrl,
        currentTitle: "For You",
        loginState,
      }),
      screenshotRegion: async () => {
        const sourceFilePath = path.join(tmpdir(), "grasseye-post-action-video-identity-fixture.png");
        if (currentUrl.includes("after-video")) {
          await sharp({
            create: {
              width: 16,
              height: 16,
              channels: 3,
              background: { r: 255, g: 255, b: 255 },
            },
          }).png().toFile(sourceFilePath);
        } else {
          await writeFile(sourceFilePath, Buffer.from("after-video-frame-fixture"));
        }
        return {
          browserActionId: "browser-action-fixture",
          pageUrl: currentUrl,
          pageTitle: "For You",
          regionLabel: "post-scroll-video-identity",
          regionType: "viewport",
          width: 100,
          height: 100,
          viewportWidth: 100,
          viewportHeight: 100,
          sourceFilePath,
          createdAt: new Date().toISOString(),
        };
      },
    },
  } as unknown as Parameters<typeof buildPostActionVerificationInput>[0];
}

function createFixtureEnvelope(): Parameters<typeof buildPostActionVerificationInput>[1] {
  return {
    commandName: "verify-page-opened",
    missionId: "mission-1",
    runId: "run-1",
    sessionId: "mission-1",
    roundId: "0",
    videoVisitId: null,
    stepId: "verify-page-opened",
    mapPackageId: "builtin.tiktok-seeding-video-discovery",
    mapPackageVersion: "1.0.0",
    selectedMapId: "tiktok.seeding-video.discovery.meta.v1",
    selectedMapVersion: "1.0.0",
    activationSnapshotRef: "activation-snapshot:1",
    capabilityCallId: "mission-1:verify-page-opened:1:ability",
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

function createVideoChangedEnvelope(): Parameters<typeof buildPostActionVerificationInput>[1] {
  return {
    ...createFixtureEnvelope(),
    commandName: "verify-video-changed-after-scroll",
    stepId: "verify-video-changed-after-scroll",
    capabilityCallId: "mission-1:verify-video-changed-after-scroll:1:ability",
    inputRef: "post-action-input-ref-1",
    idempotencyKey: "idem-video-1",
    createdAt: new Date().toISOString(),
  } as Parameters<typeof buildPostActionVerificationInput>[1];
}

function createVideoChangedPayload(): Parameters<typeof buildPostActionVerificationInput>[2] {
  return {
    documentType: "orchestration.ability_dispatch",
    documentRef: "post-action-input-ref-1",
    summary: "Verify video changed after scroll",
    entityRefs: [],
    evidenceRefs: [],
    contentBlocks: [
      { key: "abilityResultRef", value: "scroll-result-ref-1" },
      { key: "promptInputRef", value: "prompt-input-ref-1" },
      { key: "screenshotEvidenceRef", value: "screenshot-evidence-ref-1" },
    ],
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
  assertCondition(input.expectedOutcome.expectedUrlHost === "www.tiktok.com", "Builder must align verify-page-opened expectedUrlHost with the canonical platform host.");
  assertCondition(pageStateObservation?.kind === "page_state", "Builder must emit a page_state observation for verify-page-opened.");
  assertCondition(pageStateObservation?.source.sourceProofRef === input.actionProof.sourceRuntimeProofRef, "Builder must bind page-state observation back to the governed source proof ref.");

  const verificationResult = await abilityGroup.execute(input);
  assertCondition(verificationResult.status === "success" && verificationResult.verificationDecision === "verified", "verify-page-opened fixture must reach governed success for a ready TikTok feed URL.");

  const invalidInputResult = await abilityGroup.execute({
    ...input,
    runId: "",
  });

  assertCondition(invalidInputResult.runId !== null, "Invalid-input fallback result must not emit runId=null.");
  assertCondition(invalidInputResult.runtimeProof.runId !== null, "Invalid-input fallback proof must not emit runId=null.");
  assertCondition(invalidInputResult.runId === invalidInputResult.runtimeProof.runId, "Invalid-input fallback result/proof runId must remain consistent.");

  const now = Date.now();
  recordAbilityResultProofSummary("prompt-input-ref-1", {
    preparedImageHash: changedBeforeSignature,
    sourceScreenshotEvidenceId: "screenshot-evidence-ref-1",
    pageUrl: "https://www.facebook.com/reel/before-video",
  });
  recordAbilityResultProofSummary("scroll-result-ref-1", {
    scrollExecutionRef: "scroll-execution-ref-1",
    primitiveStartedAt: new Date(now - 2_000).toISOString(),
    primitiveEndedAt: new Date(now - 1_000).toISOString(),
  });

  const videoRuntime = createFixtureRuntime("https://www.facebook.com/reel/after-video", "logged_in");
  const videoInput = await buildPostActionVerificationInput(videoRuntime, createVideoChangedEnvelope(), createVideoChangedPayload());
  const videoIdentityObservations = videoInput.observationSet.observations.filter((observation: { kind: string }) => observation.kind === "video_identity");
  assertCondition(videoIdentityObservations.length === 2, "Video-changed builder must emit governed before/after video_identity observations.");
  assertCondition(videoInput.beforeAfterEvidence.beforeEvidence?.evidenceKind === "video_identity", "Video-changed builder must emit before video_identity evidence.");
  assertCondition(videoInput.beforeAfterEvidence.afterEvidence?.evidenceKind === "video_identity", "Video-changed builder must emit after video_identity evidence.");
  assertCondition(videoInput.actionProof.scrollExecutionRef === "scroll-execution-ref-1", "Video-changed builder must bind actionProof to the mouse-scroll execution ref.");

  const videoVerificationResult = await abilityGroup.execute(videoInput);
  assertCondition(videoVerificationResult.status === "success" && videoVerificationResult.verificationDecision === "verified", "verify-video-changed-after-scroll fixture must reach governed success with before/after image hashes.");

  const closeFrameSignature = `${"1".repeat(128)}${"0".repeat(128)}`;
  const closeFrameAfterSignature = `${"1".repeat(124)}${"0".repeat(4)}${"0".repeat(128)}`;
  const [beforeVideoObservation, afterVideoObservation] = videoIdentityObservations;
  assertCondition(beforeVideoObservation !== undefined && afterVideoObservation !== undefined, "Video-changed perceptual fixture must have before/after video observations.");
  const unchangedVideoResult = await abilityGroup.execute({
    ...videoInput,
    observationSet: {
      observations: [
        {
          ...beforeVideoObservation,
          payload: {
            kind: "video_identity",
            role: "before",
            videoId: null,
            visualSignature: `ahash16:${closeFrameSignature}`,
            confirmed: true,
          },
        },
        {
          ...afterVideoObservation,
          payload: {
            kind: "video_identity",
            role: "after",
            videoId: null,
            visualSignature: `ahash16:${closeFrameAfterSignature}`,
            confirmed: true,
          },
        },
      ],
    },
  });
  assertCondition(unchangedVideoResult.status === "failed" && unchangedVideoResult.verificationDecision === "failed", "Video-changed verification must fail same-video perceptual frame drift instead of treating raw image variation as a new video.");

  const rawSignatureDriftResult = await abilityGroup.execute({
    ...videoInput,
    observationSet: {
      observations: [
        {
          ...beforeVideoObservation,
          payload: {
            kind: "video_identity",
            role: "before",
            videoId: null,
            visualSignature: "sha256:before-frame-drift",
            confirmed: true,
          },
        },
        {
          ...afterVideoObservation,
          payload: {
            kind: "video_identity",
            role: "after",
            videoId: null,
            visualSignature: "sha256:after-frame-drift",
            confirmed: true,
          },
        },
      ],
    },
  });
  assertCondition(rawSignatureDriftResult.status === "review_required" && rawSignatureDriftResult.verificationDecision === "review_required", "Video-changed verification must not pass raw frame-signature drift without governed before/after video identity.");

  const urlOnlyChangeResult = await abilityGroup.execute({
    ...videoInput,
    observationSet: {
      observations: [
        {
          ...beforeVideoObservation,
          payload: {
            kind: "video_identity",
            role: "before",
            videoId: "https://www.facebook.com/reel/before-video",
            visualSignature: changedBeforeSignature,
            confirmed: true,
          },
        },
        {
          ...afterVideoObservation,
          payload: {
            kind: "video_identity",
            role: "after",
            videoId: "https://www.facebook.com/reel/after-video",
            visualSignature: changedBeforeSignature,
            confirmed: true,
          },
        },
      ],
    },
  });
  assertCondition(urlOnlyChangeResult.status === "failed" && urlOnlyChangeResult.verificationDecision === "failed", "Video-changed verification must fail URL-only changes when perceptual video identity is unchanged.");
}
