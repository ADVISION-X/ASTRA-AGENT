import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { executionFailureMetadata, failureCode, oldTargetUnavailableFact } from
  "../../../lib/execution-failure.js";
import { createGptAbilityGroup } from "../index.js";
import { isProviderEffectReadbackProofV1 } from "../production-child-support.js";
import { gptCanonicalHash, gptExactCallIdentityHash } from "../contract.js";
import { ProductionGptChildTools } from "../production-child-tools.js";
import { readPersistedGptImageEvidence } from "../evidence-artifacts.js";
import { exactAssistantTurnReply } from "./gpt-exact-target-browser-fixture.js";
import { browserExactCallIdentityHash,
  type BrowserDomIntent } from "../../../lib/browser/browser-authority-api.js";
import { browserExecutionFailure } from "../../../lib/browser/browser-failure.js";

const hash = (value: string | Uint8Array): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const HASH_A = `sha256:${"a".repeat(64)}` as const;
const HASH_B = `sha256:${"b".repeat(64)}` as const;
const jobId = "job:artifact-recovery";
const attemptId = "attempt:artifact-recovery";
const sessionKey = "session:artifact-recovery";
const conversationUrl = "https://chatgpt.com/c/artifact-recovery";
const checkpointInput = { canonicalConversationUrl: conversationUrl, probeBudgetMs: 200_000,
  userTurnId: "conversation-turn-1", turnMarker: "artifact-recovery" } as const;
const checkpointCall = { sessionKey, productStepId: "research", callId: "text-checkpoint",
  child: "checkpoint_gpt_text_response", actionOrdinal: 2, input: checkpointInput } as const;
const checkpointExactCallIdentityHash = gptExactCallIdentityHash({ jobId, attemptId,
  resultRevision: 0, productStepId: checkpointCall.productStepId, callId: checkpointCall.callId,
  childCapabilityId: checkpointCall.child, inputHash: gptCanonicalHash(checkpointInput) });
const rawDomHtml = "<article>saved response</article>";
const semanticText = "saved response";
const persistedContent = JSON.stringify({ schemaVersion: "agent-observed-response-artifact.v1",
  assistantTurnId: "conversation-turn-2", rawDomHtml, rawDomHash: hash(rawDomHtml),
  semanticText, semanticTextHash: hash(semanticText) });
const persistedArtifactKey = `gpt-call-artifact:v1:${checkpointExactCallIdentityHash}:observed-response`;
const persistedArtifactRef = "artifact:persisted-response";
const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const imageHash = hash(imageBytes);

const temporary = await mkdtemp(join(tmpdir(), "gpt-artifact-recovery-"));
try {
  const artifacts = new Map<string, Readonly<{ artifactRef: string; content: Uint8Array;
    mimeType: string; integrityHash: `sha256:${string}` }>>([
    [persistedArtifactKey, { artifactRef: persistedArtifactRef,
      content: new TextEncoder().encode(persistedContent), mimeType: "application/json",
      integrityHash: hash(new TextEncoder().encode(persistedContent)) }],
  ]);
  const corruptArtifacts = new Set<string>();
  let artifactAppends = 0;
  const evidenceStore = {
    appendArtifact: async (input: Readonly<{ idempotencyKey: string;
      content?: string | Uint8Array }>) => {
      if (artifacts.has(input.idempotencyKey)) return { status: "failed" as const,
        failureReason: "FORENSICS_IDEMPOTENCY_CONFLICT" };
      const content = typeof input.content === "string" ? new TextEncoder().encode(input.content)
        : input.content ?? new Uint8Array();
      const artifactRef = `artifact:${hash(input.idempotencyKey)}`;
      const mimeType = "mimeType" in input && typeof input.mimeType === "string"
        ? input.mimeType : "application/octet-stream";
      artifacts.set(input.idempotencyKey, { artifactRef, content, mimeType, integrityHash: hash(content) });
      artifactAppends += 1;
      return { status: "success" as const, artifactRef };
    },
    readArtifact: async (input: Readonly<{ idempotencyKey: string }>) => {
      const artifact = artifacts.get(input.idempotencyKey);
      if (!artifact) return { status: "failed" as const,
        failureReason: "FORENSICS_ARTIFACT_NOT_FOUND" };
      if (corruptArtifacts.has(input.idempotencyKey)) return { status: "failed" as const,
        failureReason: "FORENSICS_ARTIFACT_INTEGRITY_MISMATCH" };
      return { status: "success" as const, artifactRef: artifact.artifactRef,
        artifact: { content: artifact.content, mimeType: artifact.mimeType,
          integrityHash: artifact.integrityHash } };
    },
  };

  let checkpointBrowserReads = 0;
  let checkpointPageObservations = 0;
  let exactConversationSelections = 0;
  let authenticatedImageReads = 0;
  const submitOutcome = { state: "confirmed", mutationOutcome: "confirmed",
    providerEffectIdentityHash: HASH_A, terminalAt: "2026-09-13T00:00:00.000Z",
    failureCode: null, nativeFailureCode: null, authorityRef: "browser-mutation:submit",
    authorityHash: HASH_B, targetRef: "target:recovery", documentRef: "document:recovery",
    physicalInputCount: 0, downloadGuidHash: null, downloadCompleted: false,
    identityRevalidated: true, terminalPayload: { canonicalConversationUrl: conversationUrl,
      promptHash: HASH_A, userTurnId: "conversation-turn-1", exactCallIdentityHash: HASH_A,
      observationRevisionHash: HASH_A, targetRefHash: HASH_A, documentRefHash: HASH_A,
      rawCount: 1, eligibleCount: 1 } } as const;
  const submitInput = { files: [], promptHash: HASH_A } as const;
  const submitAtomicInputHash = gptCanonicalHash([0, gptCanonicalHash(submitInput)]);
  const submitExactCallIdentityHash = browserExactCallIdentityHash({
    jobId, attemptId, resultRevision: 0, writerFenceHash: HASH_A,
    productStepId: "research", callId: "turn-submit",
    childCapabilityId: "submit_exact_gpt_turn_once", inputHash: submitAtomicInputHash,
    replayPolicy: "provider-effect-once",
  });
  const browser = { target: { targetRef: "target:recovery" },
    document: { documentRef: "document:recovery" },
    writerFenceHash: HASH_A,
    readAtomicStepOutcome: (identity: Readonly<{ childCapabilityId: string }>) => {
      if (identity.childCapabilityId === "submit_exact_gpt_turn_once") return submitOutcome;
      checkpointBrowserReads += 1;
      return null;
    },
    runAtomicStep: async (_identity: unknown, action: () => Promise<unknown>) => action(),
    executeDomIntent: async (intent: BrowserDomIntent) => {
      if (intent.kind === "selectExactGptConversation") exactConversationSelections += 1;
      else if (intent.kind === "readExactAssistantTurn") {
        checkpointPageObservations += 1;
        return exactAssistantTurnReply(intent, "first observed response");
      } else throw new Error(`UNEXPECTED_RECOVERY_BROWSER_INTENT:${intent.kind}`);
    },
    readAuthenticatedMedia: async () => {
      authenticatedImageReads += 1;
      return { authorityTargetHash: HASH_A, authorityDocumentHash: HASH_B,
        assistantTurnId: "conversation-turn-2", precedingUserTurnId: "conversation-turn-1",
        currentUrl: conversationUrl, semanticMediaId: "gpt-generated-image-main",
        bytesBase64: Buffer.from(imageBytes).toString("base64"), sha256: imageHash,
        sizeBytes: imageBytes.byteLength, mediaType: "image/png" };
    },
    pendingMutationCount: () => 0,
    park: async () => undefined,
  };
  const authority = {
    readProviderEffectStepCallFact: () => ({
      exactCallIdentityHash: submitExactCallIdentityHash, inputHash: submitAtomicInputHash,
      mutation: {
        effectScope: "provider_effect", providerEffectIdentityHash: HASH_A,
        outcome: "CONFIRMED", mutationOutcome: "confirmed", terminalAt: submitOutcome.terminalAt,
        failureCode: null, nativeFailureCode: null, authorityRef: submitOutcome.authorityRef,
        authorityHash: HASH_B, targetRef: submitOutcome.targetRef,
        documentRef: submitOutcome.documentRef, productStepId: "research", callId: "turn-submit",
        childCapabilityId: "submit_exact_gpt_turn_once", actionOrdinal: 1,
        physicalInputCount: 1, downloadGuidHash: null, downloadCompleted: false,
        identityRevalidated: true,
      },
    }),
    countProviderTurnDispatches: () => 0,
    acquireJobBoundTargetLease: async () => browser };
  const execution = new ProductionGptChildTools(temporary, HASH_A, createGptAbilityGroup(),
    evidenceStore, authority as never, createRuntimeLogger({ producer: "gpt-artifact-recovery",
      owner: "production-runtime", component: "gpt-child", terminalEnabled: false,
      fileSink: { directoryPath: join(temporary, "runtime-logs") } }), {
      assertProviderSubmitAllowed: () => undefined,
      pendingIncidents: () => Object.freeze([]),
      beginIncident: async () => { throw new Error("UNEXPECTED_PROVIDER_RATE_LIMIT"); },
    }).createExecution({  jobId,
    productId: "public_knowledge_article_pipeline",
    attemptId, resultRevision: 0, ownerRef: "owner:1", subjectRef: "subject:1",
    readbackOnlyCalls: [{ productStepId: "research", callId: "turn-submit",
      childCapabilityId: "submit_exact_gpt_turn_once" }],
    authorizationRef: "authorization:1", deviceId: "device:1", leaseVersion: 1,
    executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
    expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
    abortSignal: new AbortController().signal, parentSpanId: "parent", maxProviderTurns: 1 });
  const recoveredSubmit = await execution.tools.readConfirmedSubmit({ sessionKey,
    productStepId: "research", callId: "turn-submit", child: "submit_exact_gpt_turn_once",
    actionOrdinal: 1, input: submitInput });
  assert.equal(recoveredSubmit?.value.userTurnId, "conversation-turn-1");
  const providerReadbackProof = execution.readProviderEffectReadbackProof();
  assert.equal(isProviderEffectReadbackProofV1(providerReadbackProof), true);
  assert.equal(providerReadbackProof?.provider_effect_identity_hash, HASH_A);
  assert.equal(providerReadbackProof?.exact_call_identity_hash, submitExactCallIdentityHash);
  assert.equal(providerReadbackProof?.browser_authority_ref, submitOutcome.authorityRef);
  assert.equal(providerReadbackProof?.browser_authority_hash, submitOutcome.authorityHash);
  assert.equal(providerReadbackProof?.readback_provider_input_delta, 0,
    "a confirmed Provider effect recovery must add zero Browser input even when the original WAL input was one");
  await assert.rejects(execution.tools.execute({ ...checkpointCall,
    input: { ...checkpointCall.input, userTurnId: "conversation-turn-999" } }),
  (error: unknown) => failureCode(error) === "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
  const recovered = await execution.tools.execute(checkpointCall);
  assert.equal(recovered.value.semanticText, semanticText);
  assert.equal(recovered.artifactRefs[0], persistedArtifactRef);
  assert.deepEqual([exactConversationSelections, checkpointBrowserReads, checkpointPageObservations], [1, 0, 0],
    "valid persisted checkpoint must add zero Browser page observations");

  const missing = await execution.tools.execute({ ...checkpointCall,
    callId: "text-checkpoint-missing", actionOrdinal: 3 });
  assert.equal(missing.value.semanticText, "first observed response");
  assert.notEqual(missing.artifactRefs[0], persistedArtifactRef);
  assert.deepEqual([checkpointBrowserReads, checkpointPageObservations], [1, 1],
    "missing checkpoint artifact must perform one first Browser observation and append it");
  assert.equal(artifactAppends, 1);

  const sourceEffectIdentityHash = hash("old-provider-effect");
  const sourceWalAuthorityHash = hash("old-provider-wal");
  const sourcePromptHash = hash("old-prompt");
  const newPromptHash = hash("new-revision-prompt");
  let sourceBrowserReads = 0;
  let sourceAcquisitions = 0;
  const settledCheckpoints: unknown[] = [];
  const sourceAuthority = {
    readSourceConfirmedProviderEffect: () => {
      sourceBrowserReads += 1;
      return {
        exactCallIdentityHash: submitExactCallIdentityHash, actionOrdinal: 1,
        inputHash: submitAtomicInputHash,
        terminalPayload: { canonicalConversationUrl: conversationUrl,
          promptHash: sourcePromptHash, userTurnId: "conversation-turn-1",
          exactCallIdentityHash: submitExactCallIdentityHash,
          rawCount: 1, eligibleCount: 1 },
        authorityRef: "browser-mutation:old-submit",
        authorityHash: sourceWalAuthorityHash,
        terminalAt: "2026-09-13T00:00:00.000Z",
      };
    },
    acquireJobBoundTargetLease: async () => {
      sourceAcquisitions += 1;
      throw new Error("SOURCE_REUSE_MUST_NOT_ACQUIRE_BROWSER");
    },
  };
  const riskOnlyExecution = new ProductionGptChildTools(join(temporary, "risk-call-rename"),
    HASH_A, createGptAbilityGroup(), evidenceStore, sourceAuthority as never,
    createRuntimeLogger({ producer: "gpt-risk-call-rename", owner: "production-runtime",
      component: "gpt-child", terminalEnabled: false,
      fileSink: { directoryPath: join(temporary, "risk-call-rename-logs") } }), {
      assertProviderSubmitAllowed: () => undefined,
      pendingIncidents: () => Object.freeze([]),
      beginIncident: async () => { throw new Error("UNEXPECTED_PROVIDER_RATE_LIMIT"); },
    }).createExecution({ jobId, productId: "public_knowledge_article_pipeline",
      attemptId: "attempt:risk-call-rename", resultRevision: 1,
      ownerRef: "owner:1", subjectRef: "subject:1", authorizationRef: "authorization:1",
      deviceId: "device:1", leaseVersion: 2, executionFenceHash: HASH_A,
      capabilityManifestHash: HASH_B, expiresAtMonotonic: performance.now() + 10_000,
      commandTtlMs: 1_000, abortSignal: new AbortController().signal,
      parentSpanId: "parent", maxProviderTurns: 1,
      deliveryPriorityReplayCalls: [{ productStepId: "corpus_research", callId: "turn-submit",
        childCapabilityId: "submit_exact_gpt_turn_once", sourceEffectSetHash: HASH_A,
        callGrantHash: HASH_B }],
    });
  await assert.rejects(riskOnlyExecution.tools.readConfirmedSubmit({ sessionKey,
    productStepId: "renamed-step", callId: "turn-submit",
    child: "submit_exact_gpt_turn_once", actionOrdinal: 13,
    input: { files: [], promptHash: newPromptHash } }),
  (error: unknown) => failureCode(error) === "PRODUCTION_REPLAY_GRANT_SOURCE_MISMATCH");
  await assert.rejects(riskOnlyExecution.tools.readConfirmedSubmit({ sessionKey,
    productStepId: "corpus_research", callId: "renamed-submit",
    child: "submit_exact_gpt_turn_once", actionOrdinal: 13,
    input: { files: [], promptHash: newPromptHash } }),
  (error: unknown) => failureCode(error) === "PRODUCTION_REPLAY_GRANT_SOURCE_MISMATCH");
  await assert.rejects(riskOnlyExecution.tools.execute({ sessionKey,
    productStepId: "renamed-step", callId: "fresh-chat", child: "prepare_clean_gpt_chat",
    actionOrdinal: 1, input: { timeoutMs: 60_000 } }),
  (error: unknown) => failureCode(error) === "PRODUCTION_REPLAY_GRANT_SOURCE_MISMATCH");
  assert.deepEqual([sourceBrowserReads, sourceAcquisitions], [0, 0],
    "a renamed call cannot bypass an unconsumed Website risk grant");
  await riskOnlyExecution.settle(null);
  const sourceExecution = new ProductionGptChildTools(join(temporary, "source-reuse"), HASH_A,
    createGptAbilityGroup(), evidenceStore, sourceAuthority as never,
    createRuntimeLogger({ producer: "gpt-artifact-source-reuse",
      owner: "production-runtime", component: "gpt-child", terminalEnabled: false,
      fileSink: { directoryPath: join(temporary, "source-reuse-logs") } }), {
      assertProviderSubmitAllowed: () => undefined,
      pendingIncidents: () => Object.freeze([]),
      beginIncident: async () => { throw new Error("UNEXPECTED_PROVIDER_RATE_LIMIT"); },
    }).createExecution({ jobId, productId: "public_knowledge_article_pipeline",
      attemptId: "attempt:new-revision", resultRevision: 1,
      ownerRef: "owner:1", subjectRef: "subject:1",
      authorizationRef: "authorization:1", deviceId: "device:1", leaseVersion: 2,
      executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
      expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
      abortSignal: new AbortController().signal, parentSpanId: "parent", maxProviderTurns: 1,
      deliveryPriorityReplayCalls: [{ productStepId: "other-step", callId: "other-submit",
        childCapabilityId: "submit_exact_gpt_turn_once", sourceEffectSetHash: HASH_A,
        callGrantHash: HASH_B }],
      sourceReusableCalls: [{ productStepId: "research", callId: "turn-submit",
        childCapabilityId: "submit_exact_gpt_turn_once", sourceEffectSetHash: HASH_A,
        sourceAttemptId: attemptId, sourceResultRevision: 0,
        effectIdentityHash: sourceEffectIdentityHash, walAuthorityHash: sourceWalAuthorityHash,
        checkpointExactCallIdentityHash, artifactRef: persistedArtifactRef,
        artifactContentHash: hash(new TextEncoder().encode(persistedContent)),
        submitPromptHash: sourcePromptHash, canonicalConversationHash: hash(conversationUrl),
        userTurnHash: hash("conversation-turn-1") }],
      recordSettledCheckpoint: (checkpoint) => { settledCheckpoints.push(checkpoint); },
    });
  const oldSubmit = await sourceExecution.tools.readConfirmedSubmit({ sessionKey,
    productStepId: "research", callId: "turn-submit", child: "submit_exact_gpt_turn_once",
    actionOrdinal: 1, input: { files: [], promptHash: newPromptHash } });
  assert.equal(oldSubmit?.value.promptHash, sourcePromptHash,
    "a new revision must reuse the old confirmed Provider effect despite prompt drift");
  const oldCheckpoint = await sourceExecution.tools.execute(checkpointCall);
  assert.equal(oldCheckpoint.value.semanticText, semanticText);
  assert.equal(oldCheckpoint.artifactRefs[0], persistedArtifactRef);
  assert.deepEqual([sourceBrowserReads, sourceAcquisitions, settledCheckpoints.length], [1, 0, 1],
    "settled source reuse must read original WAL and Forensics with zero Browser acquisition");
  await sourceExecution.settle(null);

  const unavailable = new Error("BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE") as Error & {
    oldTargetUnavailableFact?: Readonly<{ jobRefHash: `sha256:${string}`;
      targetRefHash: `sha256:${string}`; proofHash: `sha256:${string}` }>;
  };
  unavailable.oldTargetUnavailableFact = { jobRefHash: hash(jobId),
    targetRefHash: hash("target:recovery"), proofHash: hash("old-instance-unavailable") };
  const unavailableExecution = new ProductionGptChildTools(join(temporary, "unavailable-readback"), HASH_A,
    createGptAbilityGroup(), evidenceStore, {
      ...authority, acquireJobBoundTargetLease: async () => { throw browserExecutionFailure(unavailable); },
    } as never,
    createRuntimeLogger({ producer: "gpt-artifact-unavailable-readback",
      owner: "production-runtime", component: "gpt-child", terminalEnabled: false,
      fileSink: { directoryPath: join(temporary, "unavailable-readback-logs") } }), {
      assertProviderSubmitAllowed: () => undefined,
      pendingIncidents: () => Object.freeze([]),
      beginIncident: async () => { throw new Error("UNEXPECTED_PROVIDER_RATE_LIMIT"); },
    }).createExecution({ jobId, productId: "public_knowledge_article_pipeline",
      attemptId, resultRevision: 0, ownerRef: "owner:1", subjectRef: "subject:1",
      authorizationRef: "authorization:1", deviceId: "device:1", leaseVersion: 1,
      executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
      expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
      abortSignal: new AbortController().signal, parentSpanId: "parent", maxProviderTurns: 1 });
  await assert.rejects(unavailableExecution.tools.readConfirmedSubmit({ sessionKey,
    productStepId: "research", callId: "turn-submit", child: "submit_exact_gpt_turn_once",
    actionOrdinal: 1, input: submitInput }), (error: unknown) => {
    assert.equal(failureCode(error), "BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE");
    assert.equal(executionFailureMetadata(error)?.browserEffect?.providerEffectIdentityHash, HASH_A);
    assert.equal(oldTargetUnavailableFact(error)?.proofHash, unavailable.oldTargetUnavailableFact?.proofHash);
    return true;
  });

  corruptArtifacts.add(persistedArtifactKey);
  await assert.rejects(execution.tools.execute(checkpointCall), (error: unknown) =>
    failureCode(error) === "EVIDENCE_ARTIFACT_READBACK_FAILED");
  assert.equal(checkpointPageObservations, 1, "corrupt persisted checkpoint must fail before Browser observation");
  assert.equal(artifactAppends, 1, "recovery must not append an overwrite artifact");
  await execution.settle(null);

  const imageCall = { sessionKey, productStepId: "research",
    callId: "image-checkpoint", child: "checkpoint_gpt_generated_image", actionOrdinal: 4,
    input: { canonicalConversationUrl: conversationUrl, probeBudgetMs: 200_000,
      userTurnId: "conversation-turn-1", turnMarker: "artifact-recovery-image" } } as const;
  const imageExactCallIdentityHash = gptExactCallIdentityHash({ jobId, attemptId,
    resultRevision: 0, productStepId: imageCall.productStepId, callId: imageCall.callId,
    childCapabilityId: imageCall.child, inputHash: gptCanonicalHash(imageCall.input) });
  const realTools = new ProductionGptChildTools(join(temporary, "real-execution"), HASH_A,
    createGptAbilityGroup(), evidenceStore, authority as never,
    createRuntimeLogger({ producer: "gpt-artifact-recovery-real-store",
      owner: "production-runtime", component: "gpt-child", terminalEnabled: false,
      fileSink: { directoryPath: join(temporary, "real-runtime-logs") } }), {
      assertProviderSubmitAllowed: () => undefined,
      pendingIncidents: () => Object.freeze([]),
      beginIncident: async () => { throw new Error("UNEXPECTED_PROVIDER_RATE_LIMIT"); },
    });
  const realExecution = realTools.createExecution({  jobId,
    productId: "public_knowledge_article_pipeline",
    attemptId, resultRevision: 0, ownerRef: "owner:1", subjectRef: "subject:1",
    authorizationRef: "authorization:1", deviceId: "device:1", leaseVersion: 1,
    executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
    expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
    abortSignal: new AbortController().signal, parentSpanId: "parent", maxProviderTurns: 1 });
  const realRecoveredSubmit = await realExecution.tools.readConfirmedSubmit({ sessionKey,
    productStepId: "research", callId: "turn-submit", child: "submit_exact_gpt_turn_once",
    actionOrdinal: 1, input: submitInput });
  assert.equal(realRecoveredSubmit?.value.userTurnId, "conversation-turn-1");
  const image = await realExecution.tools.execute(imageCall);
  assert.equal(image.value.originalSha256, imageHash,
    "the production facade must settle the generated image with originalSha256");
  assert.deepEqual(image.value.originalBytes, imageBytes);
  assert.equal(image.artifactRefs.length, 1);
  assert.equal(authenticatedImageReads, 1);
  const imageReadback = await evidenceStore.readArtifact({
    idempotencyKey: `gpt-call-artifact:v1:${imageExactCallIdentityHash}:original` });
  assert.equal(imageReadback.status, "success");
  if (imageReadback.status === "success") {
    assert.equal(imageReadback.artifactRef, image.artifactRefs[0]);
    assert.equal(imageReadback.artifact.mimeType, "image/png");
    assert.deepEqual(imageReadback.artifact.content, imageBytes);
  }
  const imageEvidence = await readPersistedGptImageEvidence({
    evidenceStore, jobId, attemptId, exactCallIdentityHash: imageExactCallIdentityHash,
  });
  assert.equal(imageEvidence?.originalArtifactRef, image.artifactRefs[0]);
  assert.equal(imageEvidence?.binding.originalSha256, imageHash);
  const bindingKey = `gpt-call-artifact:v1:${imageExactCallIdentityHash}:source-binding`;
  const savedBinding = artifacts.get(bindingKey);
  assert.ok(savedBinding);
  artifacts.delete(bindingKey);
  assert.equal(await readPersistedGptImageEvidence({ evidenceStore, jobId, attemptId,
    exactCallIdentityHash: imageExactCallIdentityHash }), null,
  "an original image without its identity binding cannot be a settled source");
  await assert.rejects(realTools.verifySourceCheckpointArtifact({
    jobId, sourceAttemptId: attemptId,
    checkpointExactCallIdentityHash: imageExactCallIdentityHash,
    artifactRef: imageEvidence!.artifactRef, artifactContentHash: imageEvidence!.integrityHash,
  }), (error: unknown) => failureCode(error) === "PRODUCTION_SOURCE_CHECKPOINT_ARTIFACT_UNAVAILABLE");
  artifacts.set(bindingKey, savedBinding);
  assert.equal(artifactAppends, 3,
    "the image checkpoint must bind the original bytes with one internal identity artifact");
  const imageSourceExecution = new ProductionGptChildTools(join(temporary, "image-source-reuse"),
    HASH_A, createGptAbilityGroup(), evidenceStore, sourceAuthority as never,
    createRuntimeLogger({ producer: "gpt-image-source-reuse", owner: "production-runtime",
      component: "gpt-child", terminalEnabled: false,
      fileSink: { directoryPath: join(temporary, "image-source-logs") } }), {
      assertProviderSubmitAllowed: () => undefined,
      pendingIncidents: () => Object.freeze([]),
      beginIncident: async () => { throw new Error("UNEXPECTED_PROVIDER_RATE_LIMIT"); },
    }).createExecution({ jobId, productId: "public_knowledge_article_pipeline",
      attemptId: "attempt:image-source-revision", resultRevision: 1,
      ownerRef: "owner:1", subjectRef: "subject:1", authorizationRef: "authorization:1",
      deviceId: "device:1", leaseVersion: 2, executionFenceHash: HASH_A,
      capabilityManifestHash: HASH_B, expiresAtMonotonic: performance.now() + 10_000,
      commandTtlMs: 1_000, abortSignal: new AbortController().signal,
      parentSpanId: "parent", maxProviderTurns: 1, sourceReuseZeroSubmitGrant: true,
      deliveryPriorityReplayCalls: [],
      sourceReusableCalls: [{ productStepId: "research", callId: "turn-submit",
        childCapabilityId: "submit_exact_gpt_turn_once", sourceEffectSetHash: HASH_A,
        sourceAttemptId: attemptId, sourceResultRevision: 0,
        effectIdentityHash: sourceEffectIdentityHash, walAuthorityHash: sourceWalAuthorityHash,
        checkpointExactCallIdentityHash: imageExactCallIdentityHash,
        artifactRef: imageEvidence!.artifactRef, artifactContentHash: imageEvidence!.integrityHash,
        submitPromptHash: sourcePromptHash, canonicalConversationHash: hash(conversationUrl),
        userTurnHash: hash("conversation-turn-1") }],
      recordSettledCheckpoint: (checkpoint) => { settledCheckpoints.push(checkpoint); },
    });
  await assert.rejects(imageSourceExecution.tools.readConfirmedSubmit({ sessionKey,
    productStepId: "renamed-step", callId: "turn-submit",
    child: "submit_exact_gpt_turn_once", actionOrdinal: 1,
    input: { files: [], promptHash: newPromptHash } }),
  (error: unknown) => failureCode(error) === "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH");
  await assert.rejects(imageSourceExecution.tools.readConfirmedSubmit({ sessionKey,
    productStepId: "research", callId: "renamed-submit",
    child: "submit_exact_gpt_turn_once", actionOrdinal: 1,
    input: { files: [], promptHash: newPromptHash } }),
  (error: unknown) => failureCode(error) === "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH");
  await assert.rejects(imageSourceExecution.tools.execute({ ...imageCall,
    productStepId: "renamed-step" }),
  (error: unknown) => failureCode(error) === "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH");
  assert.deepEqual([sourceBrowserReads, sourceAcquisitions], [1, 0],
    "a zero-submit grant must reject renamed calls before Browser Target or Provider input");
  const imageSourceSubmit = await imageSourceExecution.tools.readConfirmedSubmit({ sessionKey,
    productStepId: "research", callId: "turn-submit", child: "submit_exact_gpt_turn_once",
    actionOrdinal: 1, input: { files: [], promptHash: newPromptHash } });
  assert.equal(imageSourceSubmit?.value.promptHash, sourcePromptHash);
  const reusedImage = await imageSourceExecution.tools.execute(imageCall);
  assert.deepEqual(reusedImage.value.originalBytes, imageBytes);
  assert.equal(reusedImage.artifactRefs[0], image.artifactRefs[0]);
  assert.deepEqual([sourceBrowserReads, sourceAcquisitions, settledCheckpoints.length], [2, 0, 2],
    "article image source reuse must return original media with zero Provider input or Target acquisition");
  await imageSourceExecution.settle(null);
  await realExecution.settle(null);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
