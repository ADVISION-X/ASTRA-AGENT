import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { executionFailureMetadata, failureCode } from "../../../lib/execution-failure.js";
import { createGptAbilityGroup } from "../index.js";
import { isProviderEffectReadbackProofV1 } from "../production-child-support.js";
import { gptCanonicalHash, gptExactCallIdentityHash } from "../contract.js";
import { ProductionGptChildTools } from "../production-child-tools.js";
import { readPersistedGptImageEvidence } from "../evidence-artifacts.js";
import { createWorkbenchEvidenceStore } from "../../../lib/local-runtime/workbench-evidence-support.js";
import { exactAssistantTurnReply } from "./gpt-exact-target-browser-fixture.js";
import { browserExactCallIdentityHash, type BrowserAtomicStepIdentity, type BrowserDomIntent } from "../../../lib/browser/browser-authority-api.js";
import { browserExecutionFailure } from "../../../lib/browser/browser-failure.js";

const digest = (value: string | Uint8Array): `sha256:${string}` => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const A = `sha256:${"a".repeat(64)}` as const, B = `sha256:${"b".repeat(64)}` as const;
const jobId = "job:artifact-recovery", attemptId = "attempt:artifact-recovery", sessionKey = "session:artifact-recovery";
const url = "https://chatgpt.com/c/artifact-recovery", user = "00000000-0000-4000-8000-000000000001";
const textCall = { sessionKey, productStepId: "research", callId: "text-checkpoint", child: "checkpoint_gpt_text_response",
  actionOrdinal: 2, input: { canonicalConversationUrl: url, probeBudgetMs: 200_000, userTurnId: user, turnMarker: "artifact-recovery" } } as const;
const checkpointHash = gptExactCallIdentityHash({ jobId, attemptId, resultRevision: 0, productStepId: textCall.productStepId,
  callId: textCall.callId, childCapabilityId: textCall.child, inputHash: gptCanonicalHash(textCall.input) });
const savedText = "saved response", raw = `<article>${savedText}</article>`;
const content = JSON.stringify({ schemaVersion: "agent-observed-response-artifact.v1", assistantTurnId: "00000000-0000-4000-8000-000000000002",
  rawDomHtml: raw, rawDomHash: digest(raw), semanticText: savedText, semanticTextHash: digest(savedText) });
const textKey = `gpt-call-artifact:v1:${checkpointHash}:observed-response`, textRef = "artifact:persisted-response", integrity = digest(`envelope:${textRef}:${digest(content)}`);
const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), imageHash = digest(bytes);
const root = await mkdtemp(join(tmpdir(), "gpt-recovery-rebuild-"));
try {
  const artifacts = new Map<string, { artifactRef: string; content: Uint8Array; mimeType: string; integrityHash: `sha256:${string}` }>([
    [textKey, { artifactRef: textRef, content: new TextEncoder().encode(content), mimeType: "application/json", integrityHash: integrity }] ]);
  const corrupt = new Set<string>(); let appends = 0, pageReads = 0, atomicReads = 0, selections = 0, imageReads = 0, acquisitions = 0;
  const evidence = { appendArtifact: async (input: Readonly<{ idempotencyKey: string; content?: string | Uint8Array; mimeType?: string }>) => {
    if (artifacts.has(input.idempotencyKey)) return { status: "failed" as const, failureReason: "FORENSICS_IDEMPOTENCY_CONFLICT" };
    const data = typeof input.content === "string" ? new TextEncoder().encode(input.content) : input.content ?? new Uint8Array();
    const artifactRef = `artifact:${digest(input.idempotencyKey)}`; artifacts.set(input.idempotencyKey, { artifactRef, content: data,
      mimeType: input.mimeType ?? "application/octet-stream", integrityHash: digest(`envelope:${artifactRef}:${digest(data)}`) }); appends += 1;
    return { status: "success" as const, artifactRef };
  }, readArtifact: async (input: Readonly<{ idempotencyKey: string }>) => {
    const artifact = artifacts.get(input.idempotencyKey);
    if (!artifact || corrupt.has(input.idempotencyKey)) return { status: "failed" as const,
      failureReason: artifact ? "FORENSICS_ARTIFACT_INTEGRITY_MISMATCH" : "FORENSICS_ARTIFACT_NOT_FOUND" };
    return { status: "success" as const, artifactRef: artifact.artifactRef,
      artifact: { content: artifact.content, mimeType: artifact.mimeType, integrityHash: artifact.integrityHash } };
  } };
  const submitInput = { files: [], promptHash: A } as const;
  const original: BrowserAtomicStepIdentity = { resultRevision: 0, productStepId: "research", callId: "turn-submit", childCapabilityId: "submit_exact_gpt_turn_once",
    inputHash: gptCanonicalHash([0, gptCanonicalHash(submitInput)]), actionOrdinal: 1, replayPolicy: "provider-effect-once" };
  const exact = browserExactCallIdentityHash({ jobId, attemptId, writerFenceHash: A, ...original });
  const terminalPayload = { canonicalConversationUrl: url, promptHash: A, userTurnId: user, exactCallIdentityHash: exact,
    observationRevisionHash: A, targetRefHash: A, documentRefHash: B, rawCount: 1, eligibleCount: 1 };
  const outcome = { state: "confirmed", mutationOutcome: "confirmed", providerEffectIdentityHash: A, terminalAt: "2026-09-13T00:00:00.000Z",
    failureCode: null, nativeFailureCode: null, authorityRef: "browser-mutation:submit", authorityHash: B, targetRef: "target:recovery",
    documentRef: "document:recovery", physicalInputCount: 1, downloadGuidHash: null, downloadCompleted: false, identityRevalidated: true, terminalPayload } as const;
  const browser = { target: { targetRef: outcome.targetRef }, document: { documentRef: outcome.documentRef }, writerFenceHash: A,
    readAtomicStepOutcome: (identity: BrowserAtomicStepIdentity) => { if (identity.childCapabilityId !== original.childCapabilityId) { atomicReads += 1; return null; }
      assert.deepEqual(identity, original); return outcome; }, runAtomicStep: async (_identity: unknown, action: () => Promise<unknown>) => action(),
    executeDomIntent: async (intent: BrowserDomIntent) => { if (intent.kind === "selectExactGptConversation") { selections += 1; assert.equal(intent.canonicalConversationUrl, url); return; }
      assert.equal(intent.kind, "readExactAssistantTurn"); if (intent.kind !== "readExactAssistantTurn") throw new Error("UNEXPECTED_PAGE_INPUT");
      pageReads += 1; return exactAssistantTurnReply(intent, "first observed response"); },
    readAuthenticatedMedia: async () => { imageReads += 1; return { authorityTargetHash: A, authorityDocumentHash: B,
      assistantTurnId: "00000000-0000-4000-8000-000000000002", precedingUserTurnId: user, currentUrl: url,
      semanticMediaId: "gpt-generated-image-main", bytesBase64: Buffer.from(bytes).toString("base64"), sha256: imageHash, sizeBytes: bytes.byteLength, mediaType: "image/png" }; },
    pendingMutationCount: () => 0, park: async () => undefined };
  const authority = { readProviderEffectStepCallFact: () => ({ exactCallIdentityHash: exact, inputHash: original.inputHash, mutation: {
    effectScope: "provider_effect", providerEffectIdentityHash: A, outcome: "CONFIRMED", mutationOutcome: "confirmed", terminalAt: outcome.terminalAt,
    failureCode: null, nativeFailureCode: null, authorityRef: outcome.authorityRef, authorityHash: B, targetRef: outcome.targetRef, documentRef: outcome.documentRef,
    productStepId: original.productStepId, callId: original.callId, childCapabilityId: original.childCapabilityId, actionOrdinal: 1,
    physicalInputCount: 1, downloadGuidHash: null, downloadCompleted: false, identityRevalidated: true } }), countProviderTurnDispatches: () => 0,
    acquireJobBoundTargetLease: async () => { acquisitions += 1; return browser; } };
  const control = { assertProviderSubmitAllowed: () => undefined, pendingIncidents: () => Object.freeze([]), beginIncident: async () => { throw new Error("UNEXPECTED_RATE_LIMIT"); } };
  const input = { jobId, attemptId, resultRevision: 0, productId: "public_knowledge_article_pipeline", ownerRef: "owner:1", subjectRef: "subject:1", authorizationRef: "authorization:1",
    deviceId: "device:1", leaseVersion: 1, executionFenceHash: A, capabilityManifestHash: B, expiresAtMonotonic: performance.now() + 60_000,
    commandTtlMs: 1_000, abortSignal: new AbortController().signal, parentSpanId: "parent", maxProviderTurns: 1 };
  const logger = (name: string) => createRuntimeLogger({ producer: name, owner: "production-runtime", component: "gpt-child", terminalEnabled: false,
    fileSink: { directoryPath: join(root, `${name}-logs`) } });
  const tools = new ProductionGptChildTools(root, A, createGptAbilityGroup(), evidence, authority as never, logger("recovery"), control);
  const execution = tools.createExecution({ ...input, readbackOnlyCalls: [{ productStepId: original.productStepId, callId: original.callId, childCapabilityId: "submit_exact_gpt_turn_once" }] });
  const submitCall = { sessionKey, productStepId: original.productStepId, callId: original.callId, child: "submit_exact_gpt_turn_once", actionOrdinal: 1, input: submitInput } as const;
  const submit = await execution.tools.readConfirmedSubmit(submitCall); assert.equal(submit?.value.userTurnId, user);
  const proof = execution.readProviderEffectReadbackProof(); assert.equal(isProviderEffectReadbackProofV1(proof), true);
  assert.equal(proof?.provider_effect_identity_hash, A); assert.equal(proof?.exact_call_identity_hash, exact);
  assert.equal(proof?.browser_authority_ref, outcome.authorityRef); assert.equal(proof?.browser_authority_hash, B); assert.equal(proof?.readback_provider_input_delta, 0);
  await assert.rejects(execution.tools.execute({ ...textCall, input: { ...textCall.input, userTurnId: "00000000-0000-4000-8000-000000000999" } }),
    (error: unknown) => failureCode(error) === "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
  const restored = await execution.tools.execute(textCall); assert.equal(restored.value.semanticText, savedText); assert.equal(restored.artifactRefs[0], textRef);
  assert.deepEqual([selections, atomicReads, pageReads], [1, 0, 0]);
  const missing = await execution.tools.execute({ ...textCall, callId: "text-checkpoint-missing", actionOrdinal: 3 });
  assert.equal(missing.value.semanticText, "first observed response"); assert.notEqual(missing.artifactRefs[0], textRef);
  assert.deepEqual([atomicReads, pageReads, appends], [1, 1, 1]);
  const sourceEffect = digest("source-effect"), sourceWal = digest("source-wal"), sourcePrompt = digest("old-prompt"), newPrompt = digest("new-prompt");
  let sourceReads = 0, sourceAcquisitions = 0; const checkpoints: unknown[] = [];
  const sourceAuthority = { readSourceConfirmedProviderEffect: () => { sourceReads += 1; return { exactCallIdentityHash: exact, inputHash: original.inputHash,
    actionOrdinal: 1, terminalPayload: { ...terminalPayload, promptHash: sourcePrompt }, authorityRef: "browser-mutation:source", authorityHash: sourceWal, terminalAt: outcome.terminalAt }; },
    acquireJobBoundTargetLease: async () => { sourceAcquisitions += 1; throw new Error("SOURCE_REUSE_ACQUIRED_TARGET"); } };
  const replay = new ProductionGptChildTools(join(root, "replay"), A, createGptAbilityGroup(), evidence, sourceAuthority as never, logger("replay"), control).createExecution({
    ...input, attemptId: "new-attempt", resultRevision: 1, leaseVersion: 2, deliveryPriorityReplayCalls: [{ productStepId: "corpus_research", callId: "turn-submit",
      childCapabilityId: "submit_exact_gpt_turn_once", sourceEffectSetHash: A, callGrantHash: B }] });
  for (const call of [{ ...submitCall, productStepId: "renamed-step" }, { ...submitCall, productStepId: "corpus_research", callId: "renamed-submit" }])
    await assert.rejects(replay.tools.readConfirmedSubmit(call), (error: unknown) => failureCode(error) === "PRODUCTION_REPLAY_GRANT_SOURCE_MISMATCH");
  await assert.rejects(replay.tools.execute({ sessionKey, productStepId: "renamed-step", callId: "fresh-chat", child: "prepare_clean_gpt_chat", actionOrdinal: 1,
    input: { timeoutMs: 60_000 } }), (error: unknown) => failureCode(error) === "PRODUCTION_REPLAY_GRANT_SOURCE_MISMATCH");
  assert.deepEqual([sourceReads, sourceAcquisitions], [0, 0]); await replay.settle(null);
  const grant = { productStepId: "research", callId: "turn-submit", childCapabilityId: "submit_exact_gpt_turn_once", sourceEffectSetHash: A,
    sourceAttemptId: attemptId, sourceResultRevision: 0, effectIdentityHash: sourceEffect, walAuthorityHash: sourceWal,
    checkpointExactCallIdentityHash: checkpointHash, artifactRef: textRef, artifactContentHash: integrity,
    submitPromptHash: sourcePrompt, canonicalConversationHash: digest(url), userTurnHash: digest(user) };
  const reuse = new ProductionGptChildTools(join(root, "reuse"), A, createGptAbilityGroup(), evidence, sourceAuthority as never, logger("reuse"), control).createExecution({
    ...input, attemptId: "reuse-attempt", resultRevision: 1, leaseVersion: 2,
    deliveryPriorityReplayCalls: [{ productStepId: "other-step", callId: "other-submit", childCapabilityId: "submit_exact_gpt_turn_once", sourceEffectSetHash: A, callGrantHash: B }],
    sourceReusableCalls: [grant], recordSettledCheckpoint: checkpoint => { checkpoints.push(checkpoint); } });
  assert.equal((await reuse.tools.readConfirmedSubmit({ ...submitCall, input: { files: [], promptHash: newPrompt } }))?.value.promptHash, sourcePrompt);
  assert.equal((await reuse.tools.execute(textCall)).artifactRefs[0], textRef); assert.deepEqual([sourceReads, sourceAcquisitions, checkpoints.length], [1, 0, 1]); await reuse.settle(null);
  const unavailable = new ProductionGptChildTools(join(root, "unavailable"), A, createGptAbilityGroup(), evidence,
    { ...authority, acquireJobBoundTargetLease: async () => { throw browserExecutionFailure(new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE")); } } as never,
    logger("unavailable"), control).createExecution(input);
  await assert.rejects(unavailable.tools.readConfirmedSubmit(submitCall), (error: unknown) => { assert.equal(failureCode(error), "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    assert.equal(executionFailureMetadata(error)?.browserEffect?.providerEffectIdentityHash, A); return true; });
  corrupt.add(textKey); await assert.rejects(execution.tools.execute(textCall), (error: unknown) => failureCode(error) === "EVIDENCE_ARTIFACT_READBACK_FAILED");
  assert.equal(pageReads, 1); assert.equal(appends, 1); await execution.settle(null);
  const imageCall = { ...textCall, callId: "image-checkpoint", child: "checkpoint_gpt_generated_image", actionOrdinal: 4,
    input: { ...textCall.input, turnMarker: "artifact-recovery-image" } } as const;
  const imageExact = gptExactCallIdentityHash({ jobId, attemptId, resultRevision: 0, productStepId: imageCall.productStepId,
    callId: imageCall.callId, childCapabilityId: imageCall.child, inputHash: gptCanonicalHash(imageCall.input) });
  const imageTools = new ProductionGptChildTools(join(root, "image"), A, createGptAbilityGroup(), evidence, authority as never, logger("image"), control), imageExecution = imageTools.createExecution(input);
  await imageExecution.tools.readConfirmedSubmit(submitCall); const image = await imageExecution.tools.execute(imageCall);
  assert.equal(image.value.originalSha256, imageHash); assert.deepEqual(image.value.originalBytes, bytes); assert.equal(image.artifactRefs.length, 1); assert.equal(imageReads, 1);
  const originalArtifact = await evidence.readArtifact({ idempotencyKey: `gpt-call-artifact:v1:${imageExact}:original` });
  assert.equal(originalArtifact.status, "success"); if (originalArtifact.status === "success") { assert.deepEqual(originalArtifact.artifact.content, bytes); assert.equal(originalArtifact.artifact.mimeType, "image/png"); }
  const imageEvidence = await readPersistedGptImageEvidence({ evidenceStore: evidence, jobId, attemptId, exactCallIdentityHash: imageExact });
  assert.equal(imageEvidence?.originalArtifactRef, image.artifactRefs[0]); assert.equal(imageEvidence?.binding.originalSha256, imageHash);
  const bindingKey = `gpt-call-artifact:v1:${imageExact}:source-binding`, binding = artifacts.get(bindingKey)!; assert.ok(binding);
  const real = createWorkbenchEvidenceStore(join(root, "forensics"), logger("forensics"));
  const realOriginal = await real.appendArtifact({ missionId: jobId, runId: attemptId, artifactType: "ai_raw_output", mimeType: "image/png", content: bytes,
    idempotencyKey: `gpt-call-artifact:v1:${imageExact}:original` }); assert.equal(realOriginal.status, "success");
  const realBindingBytes = new TextEncoder().encode(JSON.stringify({ ...JSON.parse(new TextDecoder().decode(binding.content)) as Record<string, unknown>, originalArtifactRef: realOriginal.artifactRef }));
  assert.equal((await real.appendArtifact({ missionId: jobId, runId: attemptId, artifactType: "other", mimeType: "application/json", content: realBindingBytes, idempotencyKey: bindingKey })).status, "success");
  const realEvidence = await readPersistedGptImageEvidence({ evidenceStore: real, jobId, attemptId, exactCallIdentityHash: imageExact });
  assert.deepEqual(realEvidence?.originalBytes, bytes); assert.equal(realEvidence?.originalArtifactRef, realOriginal.artifactRef); assert.notEqual(realEvidence?.integrityHash, digest(realBindingBytes));
  artifacts.delete(bindingKey); assert.equal(await readPersistedGptImageEvidence({ evidenceStore: evidence, jobId, attemptId, exactCallIdentityHash: imageExact }), null);
  await assert.rejects(imageTools.verifySourceCheckpointArtifact({ jobId, sourceAttemptId: attemptId, checkpointExactCallIdentityHash: imageExact,
    artifactRef: imageEvidence!.artifactRef, artifactContentHash: imageEvidence!.integrityHash }), (error: unknown) => failureCode(error) === "PRODUCTION_SOURCE_CHECKPOINT_ARTIFACT_UNAVAILABLE");
  artifacts.set(bindingKey, binding); assert.equal(appends, 3);
  const imageReuse = new ProductionGptChildTools(join(root, "image-reuse"), A, createGptAbilityGroup(), evidence, sourceAuthority as never, logger("image-reuse"), control).createExecution({
    ...input, attemptId: "image-reuse-attempt", resultRevision: 1, leaseVersion: 2, sourceReuseZeroSubmitGrant: true, deliveryPriorityReplayCalls: [],
    sourceReusableCalls: [{ ...grant, checkpointExactCallIdentityHash: imageExact, artifactRef: imageEvidence!.artifactRef, artifactContentHash: imageEvidence!.integrityHash }],
    recordSettledCheckpoint: checkpoint => { checkpoints.push(checkpoint); } });
  for (const renamed of [{ ...submitCall, productStepId: "renamed-step" }, { ...submitCall, callId: "renamed-submit" }])
    await assert.rejects(imageReuse.tools.readConfirmedSubmit(renamed), (error: unknown) => failureCode(error) === "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH");
  await assert.rejects(imageReuse.tools.execute({ ...imageCall, productStepId: "renamed-step" }), (error: unknown) => failureCode(error) === "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH");
  assert.deepEqual([sourceReads, sourceAcquisitions], [1, 0]);
  assert.equal((await imageReuse.tools.readConfirmedSubmit({ ...submitCall, input: { files: [], promptHash: newPrompt } }))?.value.promptHash, sourcePrompt);
  const restoredImage = await imageReuse.tools.execute(imageCall); assert.deepEqual(restoredImage.value.originalBytes, bytes); assert.equal(restoredImage.artifactRefs[0], image.artifactRefs[0]);
  assert.deepEqual([sourceReads, sourceAcquisitions, checkpoints.length], [2, 0, 2]); await imageReuse.settle(null); await imageExecution.settle(null);
  assert.ok(acquisitions > 0);
} finally { await rm(root, { recursive: true, force: true }); }
