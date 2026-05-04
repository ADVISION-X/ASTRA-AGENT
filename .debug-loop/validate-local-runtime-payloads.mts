import { strict as assert } from "node:assert";

import { TextInputAbilityInputSchema } from "../src/capabilities/text-input/index.ts";
import { buildAbilityDispatchDocument, buildAiDispatchDocument } from "../src/capabilities/orchestration/runtime/orchestration-nerve-bus-envelope-builders.ts";
import { getDevelopmentMapPluginRegistry } from "../src/map-plugins/registry/map-plugin-registry.ts";
import { buildTextInputCommand } from "../src/lib/local-runtime/workbench-action-dispatch-inputs.ts";
import { buildHumanCommandDispatchInput } from "../src/lib/local-runtime/workbench-human-command-dispatch.ts";
import { handleHumanCommandEnvelope } from "../src/lib/local-runtime/workbench-human-command.ts";
import { handleWorkbenchNerveBusAiRequest } from "../src/lib/local-runtime/workbench-nerve-bus-ai-request.ts";

const mapRecord = getDevelopmentMapPluginRegistry().active.getActiveOperationalMapRecord("tiktok.discovery.intake.v1");

assert.ok(mapRecord, "Expected active development map record for tiktok.discovery.intake.v1");

const payloadRefs = {
  requestedPlatformId: "facebook-web",
  selectedMapId: mapRecord.mapId,
  operatorNote: "review before typing",
  targetUrl: "https://example.com/product-link",
  targetTitle: "Example Product",
  sourceEvidenceRef: "evidence-1",
  sourceTargetRef: "comment-composer-target",
  screenshotEvidenceRef: "shot-1",
  commentsEvidenceRef: null,
  visualTargetRef: "visual-1",
  geometryProofRef: "geometry-1",
  pageStateRef: "page-state-1",
  aiResultRef: null,
  abilityResultRef: "click-1",
  promptInputRef: "prepared-ai-input-1",
  commandInputRef: "Check this product link: https://example.com/product-link",
  reviewReasonRef: null,
  runtimeLogRef: null,
} as const;

const abilityDispatchDocument = buildAbilityDispatchDocument({
  missionId: "mission-1",
  mapId: mapRecord.mapId,
  stepId: "draft-safe-comment",
  runId: "run-1",
  sessionId: "mission-1",
  roundId: "0",
  videoVisitId: null,
  mapPackageId: mapRecord.packageId,
  mapPackageVersion: mapRecord.packageVersion,
  selectedMapVersion: mapRecord.mapVersion,
  activationId: mapRecord.activationId,
  activationSnapshotRef: mapRecord.activationSnapshotRef,
  targetAbilityGroupId: "text-input",
  childCapabilityId: "type-text",
  expectedOutputSchemaRef: "text-input.type-text.output",
  postActionVerificationRequired: true,
  payloadRefs,
  sequenceNo: 1,
  idempotencyKey: "idempotency-1",
  timeoutMs: 1000,
});

const documentContent = Object.fromEntries(abilityDispatchDocument.contentBlocks.map((block) => [block.key, block.value]));
assert.equal(documentContent.commandInputRef, payloadRefs.commandInputRef, "Ability dispatch document should carry commandInputRef");
assert.equal(documentContent.targetUrl, payloadRefs.targetUrl, "Ability dispatch document should carry targetUrl");

const textInputCommand = buildTextInputCommand({
  abilityGroupId: "nerve-bus",
  channelId: "orchestration-to-ability",
  envelopeKind: "ability_command",
  envelopeId: "env-1",
  nerveBusEnvelopeId: "env-1",
  transportId: "transport-1",
  traceId: "trace-1",
  spanId: "span-1",
  attemptId: "attempt-1",
  missionId: "mission-1",
  runId: "run-1",
  sessionId: "mission-1",
  roundId: "0",
  videoVisitId: null,
  mapId: mapRecord.mapId,
  mapPackageId: mapRecord.packageId,
  mapPackageVersion: mapRecord.packageVersion,
  selectedMapId: mapRecord.mapId,
  selectedMapVersion: mapRecord.mapVersion,
  activationId: mapRecord.activationId,
  activationSnapshotRef: mapRecord.activationSnapshotRef,
  stepId: "draft-safe-comment",
  capabilityCallId: "call-1",
  sourceRef: "source-1",
  idempotencyKey: "idempotency-1",
  sequenceNo: 1,
  inputRef: "input-1",
  payloadRef: ["input-1"],
  payload: { summary: "payload", entityRefs: [], evidenceRefs: [], tags: ["text-input"], attributes: [] },
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  commandId: "command-1",
  from: "orchestration",
  to: "text-input",
  targetAbilityGroupId: "text-input",
  targetChildCapabilityId: "type-text",
  commandName: "type-text",
  capabilityInputRef: "input-1",
  expectedOutputSchemaRef: "text-input.type-text.output",
  postActionVerificationRequired: true,
}, abilityDispatchDocument);

const parsedTextInput = TextInputAbilityInputSchema.parse(textInputCommand);
assert.equal(parsedTextInput.inputText, payloadRefs.commandInputRef, "Text input should use commandInputRef as governed text");
assert.ok(parsedTextInput.approvedTextSourceRef, "Text input should include approvedTextSourceRef");
assert.ok(parsedTextInput.approvedTextApprovalRef, "Text input should include approvedTextApprovalRef");

const aiDispatchDocument = buildAiDispatchDocument({
  missionId: "mission-1",
  mapId: mapRecord.mapId,
  stepId: "ask-product-presence",
  runId: "run-1",
  sessionId: "mission-1",
  roundId: "0",
  videoVisitId: null,
  mapPackageId: mapRecord.packageId,
  mapPackageVersion: mapRecord.packageVersion,
  selectedMapVersion: mapRecord.mapVersion,
  activationId: mapRecord.activationId,
  activationSnapshotRef: mapRecord.activationSnapshotRef,
  promptContractId: "vision.productPresence.v1",
  promptContractVersion: "v1",
  outputSchemaRef: "ai.product_presence_judgment.v1",
  aiInputRefs: ["prepared-ai-input-1"],
  providerPolicyRef: "provider-policy-1",
  payloadRefs,
  sequenceNo: 1,
  idempotencyKey: "idempotency-ai-1",
  timeoutMs: 1000,
});

let capturedAiInput: Record<string, unknown> | null = null;

await handleWorkbenchNerveBusAiRequest(
  {
    aiAbilityGroup: {
      execute: async (input) => {
        capturedAiInput = input as Record<string, unknown>;
        return {
          status: "success",
          taskType: "product_presence_judgment",
          confidence: 0.91,
          failureReason: null,
          reviewRequiredReason: null,
          output: {
            inputMode: "single_frame_fallback",
            multiFrameEvidenceSetId: null,
            contactSheetEvidenceId: null,
            frameEvidenceIds: [],
            screenshotEvidenceId: "shot-1",
            sampledFrameCount: 1,
            validFrameCount: 1,
            expectedFrameCount: 1,
            fallbackReason: null,
            missingFrames: [],
            isProductVideo: false,
            confidence: 0.91,
            visibleProductTypes: [],
            evidenceObservations: ["no product"],
            reason: "No product",
            frameLevelObservations: [],
            aggregateReason: "No product",
            suggestedNextAction: "scroll_next",
            uncertainty: [],
            mustReview: false,
          },
        };
      },
    },
  } as never,
  {
    abilityGroupId: "nerve-bus",
    channelId: "orchestration-to-ai",
    envelopeKind: "ai_request",
    envelopeId: "ai-env-1",
    nerveBusEnvelopeId: "ai-env-1",
    transportId: "transport-ai-1",
    traceId: "trace-ai-1",
    spanId: "span-ai-1",
    attemptId: "attempt-ai-1",
    missionId: "mission-1",
    runId: "run-1",
    sessionId: "mission-1",
    roundId: "0",
    videoVisitId: null,
    mapId: mapRecord.mapId,
    mapPackageId: mapRecord.packageId,
    mapPackageVersion: mapRecord.packageVersion,
    selectedMapId: mapRecord.mapId,
    selectedMapVersion: mapRecord.mapVersion,
    activationId: mapRecord.activationId,
    activationSnapshotRef: mapRecord.activationSnapshotRef,
    stepId: "ask-product-presence",
    capabilityCallId: "call-ai-1",
    requestId: "request-ai-1",
    sourceRef: "source-ai-1",
    idempotencyKey: "idempotency-ai-1",
    sequenceNo: 1,
    inputRef: "ai-input-1",
    payloadRef: ["ai-input-1"],
    payload: { summary: "payload", entityRefs: [], evidenceRefs: [], tags: ["ai"], attributes: [] },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    from: "orchestration",
    to: "ai",
    taskType: "product_presence_judgment",
    promptContractId: "vision.productPresence.v1",
    promptContractVersion: "v1",
    outputSchemaRef: "ai.product_presence_judgment.v1",
    aiInputRefs: ["prepared-ai-input-1"],
    modelPolicyRef: null,
    providerPolicyRef: "provider-policy-1",
  },
  aiDispatchDocument,
  new AbortController().signal,
);

assert.ok(capturedAiInput, "Expected AI input to be captured");
assert.equal(capturedAiInput?.taskType, "product_presence_judgment", "AI request should keep the task type");
assert.deepEqual((capturedAiInput?.input as Record<string, unknown>).frameEvidenceIds, [], "Single-frame fallback should not claim multi-image frame refs");
assert.equal((capturedAiInput?.input as Record<string, unknown>).contactSheetEvidenceId, payloadRefs.promptInputRef, "AI request should bridge promptInputRef into contactSheetEvidenceId for fallback mode");
assert.equal((capturedAiInput?.input as Record<string, unknown>).sourceUrl, payloadRefs.targetUrl, "AI request should bridge targetUrl into sourceUrl");

const humanDispatch = await buildHumanCommandDispatchInput({} as never, {
  commandId: "start-command-1",
  idempotencyKey: "start-idempotency-1",
  timeoutMs: 1000,
  commandType: "start-mission",
  targetMissionId: null,
  selectedMapId: mapRecord.mapId,
  requestedPlatformId: "facebook-web",
  humanGoal: "Review-safe comment draft mission",
  maxRounds: 3,
  maxMinutes: 5,
  operatorNote: "review first",
  targetRecordRef: null,
  payload: {
    kind: "start-mission",
    requestedBy: "commander-console",
    requestedPlatformId: "facebook-web",
    selectedMapId: mapRecord.mapId,
    taskTemplateId: mapRecord.taskTemplateId,
    activationId: mapRecord.activationId,
    humanGoal: "Review-safe comment draft mission",
    operatorNote: "review first",
    targetUrl: payloadRefs.targetUrl,
    targetTitle: payloadRefs.targetTitle,
    sourceEvidenceRef: payloadRefs.sourceEvidenceRef,
    sourceTargetRef: payloadRefs.sourceTargetRef,
    promptInputRef: payloadRefs.promptInputRef,
    commandInputRef: payloadRefs.commandInputRef,
  },
});

const humanDispatchContent = Object.fromEntries(humanDispatch.inputPayload.contentBlocks.map((block) => [block.key, block.value]));
assert.equal(humanDispatchContent.targetUrl, payloadRefs.targetUrl, "Human command dispatch payload should carry targetUrl");
assert.equal(humanDispatchContent.commandInputRef, payloadRefs.commandInputRef, "Human command dispatch payload should carry commandInputRef");

let capturedStartMissionInput: Record<string, unknown> | null = null;

await handleHumanCommandEnvelope(
  {
    orchestrationAbilityGroup: {
      getMissionState: async () => ({
        missionId: null,
        status: "idle",
        humanGoal: null,
        activeTaskRunId: null,
        currentRoundIndex: 0,
        requestedPlatform: null,
        mapId: null,
        lastHumanCommand: null,
        reviewRequiredReason: null,
        failureReason: null,
        startedAt: null,
        updatedAt: null,
        endedAt: null,
        currentStepId: null,
      }),
      startMission: async (input: unknown) => {
        capturedStartMissionInput = input as Record<string, unknown>;
        return {
          missionId: "mission-1",
          status: "running",
          humanGoal: "Review-safe comment draft mission",
          activeTaskRunId: "mission-1:run",
          currentRoundIndex: 0,
          requestedPlatform: "facebook-web",
          mapId: mapRecord.mapId,
          lastHumanCommand: "start-mission",
          reviewRequiredReason: null,
          failureReason: null,
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          endedAt: null,
          currentStepId: "open-facebook-feed",
        };
      },
    },
  } as never,
  humanDispatch.envelope,
  humanDispatch.inputPayload,
  new AbortController().signal,
);

assert.ok(capturedStartMissionInput, "Expected startMission input to be captured");
assert.equal(((capturedStartMissionInput?.initialPayload as Record<string, unknown>).targetUrl), payloadRefs.targetUrl, "startMission should receive initialPayload.targetUrl");
assert.equal(((capturedStartMissionInput?.initialPayload as Record<string, unknown>).commandInputRef), payloadRefs.commandInputRef, "startMission should receive initialPayload.commandInputRef");

console.log(JSON.stringify({
  ok: true,
  textInputApprovedTextSourceRef: parsedTextInput.approvedTextSourceRef,
  humanDispatchContent,
  startMissionInitialPayload: capturedStartMissionInput?.initialPayload,
  aiInput: capturedAiInput?.input,
}, null, 2));