import { readSubmittedConversationLocator } from "../../../lib/browser/exact-target/browser-submitted-conversation-locator.js";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { createRuntimeLogger, requireRuntimeLogWrite, runtimeFailureFromError, runtimeLogCauseEventId, withRuntimeLogCause } from "../../../lib/runtime-logs/index.js";
import { runtimeTransportFailure } from "../../../lib/local-runtime/production/transport-failure.js";
import { executionFailure, executionFailureMetadata, failureCode } from "../../../lib/execution-failure.js";
import { serializeTerminalFailure } from "../../../lib/local-runtime/production/terminal-failure.js";
import { ProductionGptExecutionSession } from "../production-execution-session.js";
import { ProductionGptSourceReuse } from "../production-execution-source-reuse.js";
import { ProductionGptBrowserLifecycle } from "../production-browser-lifecycle.js";
import { acquireProductionBrowserCall } from "../production-call-preparation.js";
import { executeProductionGptAtomicCall } from "../production-atomic-call.js";
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
const content = JSON.stringify({ schemaVersion: "agent-observed-response-artifact.v1", assistantTurnId: "fallback-turn-4",
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
    documentRef: "document:recovery", physicalInputCount: 1, downloadGuidHash: null, downloadCompleted: false, identityRevalidated: true, terminalPayload,
    conversationLocator: readSubmittedConversationLocator({ terminalPayload }, { exactCallIdentityHash: exact, providerEffectIdentityHash: A }) } as const;
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
  const authority = { readProviderEffectStepCallFact: () => ({ exactCallIdentityHash: exact, inputHash: original.inputHash, confirmedOutcome: outcome, mutation: {
    effectScope: "provider_effect", providerEffectIdentityHash: A, outcome: "CONFIRMED", mutationOutcome: "confirmed", terminalAt: outcome.terminalAt,
    failureCode: null, nativeFailureCode: null, authorityRef: outcome.authorityRef, authorityHash: B, targetRef: outcome.targetRef, documentRef: outcome.documentRef,
    productStepId: original.productStepId, callId: original.callId, childCapabilityId: original.childCapabilityId, actionOrdinal: 1,
    physicalInputCount: 1, downloadGuidHash: null, downloadCompleted: false, identityRevalidated: true } }), countProviderTurnDispatches: () => 0,
    acquireJobBoundTargetLease: async () => { acquisitions += 1; return browser; } };
  const control = { assertProviderSubmitAllowed: () => undefined, assertIncidentFailureIsolated: (error: unknown) => { throw error; }, pendingIncidents: () => Object.freeze([]), beginIncident: async () => { throw new Error("UNEXPECTED_RATE_LIMIT"); } };
  const input = { jobId, attemptId, resultRevision: 0, productId: "public_knowledge_article_pipeline", ownerRef: "owner:1", subjectRef: "subject:1", authorizationRef: "authorization:1",
    deviceId: "device:1", leaseVersion: 1, executionFenceHash: A, capabilityManifestHash: B, expiresAtMonotonic: performance.now() + 60_000,
    commandTtlMs: 1_000, abortSignal: new AbortController().signal, parentSpanId: "parent", maxProviderTurns: 1 };
  const logger = (name: string) => createRuntimeLogger({ producer: name, owner: "production-runtime", component: "gpt-child", terminalEnabled: false,
    fileSink: { directoryPath: join(root, `${name}-logs`) } });
  const tools = new ProductionGptChildTools(root, A, createGptAbilityGroup(), evidence, authority as never, logger("recovery"), control);
  const execution = tools.createExecution({ ...input, readbackOnlyCalls: [{ productStepId: original.productStepId, callId: original.callId, childCapabilityId: "submit_exact_gpt_turn_once" }] });
  const submitCall = { sessionKey, productStepId: original.productStepId, callId: original.callId, child: "submit_exact_gpt_turn_once", actionOrdinal: 1, input: submitInput } as const;
  const locate = async (active: typeof execution, effect = A) => active.tools.execute({ sessionKey,
    productStepId: original.productStepId, callId: "conversation-url", child: "get_submitted_gpt_conversation_url",
    actionOrdinal: 2, input: { submitCallId: original.callId, providerEffectIdentityHash: effect, timeoutMs: 15_000 } });
  const submit = await execution.tools.readConfirmedSubmit(submitCall); assert.equal(submit?.value.userTurnId, user);
  await locate(execution);
  const proof = execution.readProviderEffectReadbackProof(); assert.equal(isProviderEffectReadbackProofV1(proof), true);
  assert.equal(proof?.provider_effect_identity_hash, A); assert.equal(proof?.exact_call_identity_hash, exact);
  assert.equal(proof?.browser_authority_ref, outcome.authorityRef); assert.equal(proof?.browser_authority_hash, B); assert.equal(proof?.readback_provider_input_delta, 0);
  await assert.rejects(execution.tools.execute({ ...textCall, input: { ...textCall.input, userTurnId: "00000000-0000-4000-8000-000000000999" } }),
    (error: unknown) => failureCode(error) === "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
  const restored = await execution.tools.execute(textCall); assert.equal(restored.value.semanticText, savedText); assert.equal(restored.artifactRefs[0], textRef);
  assert.deepEqual([acquisitions, selections, atomicReads, pageReads], [0, 0, 0, 0]);
  for (const cause of [new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID"), executionFailure("failed", "LOCALIZATION_STATIC_SELECTOR_SELECTION_INVALID")]) {
    const failure = serializeTerminalFailure(execution.decorateSettledResultFailure(cause));
    assert.equal(failure.code, "RESULT_SETTLED_UNUSABLE"); assert.equal(failure.cause?.code, cause.message);
    const facts = executionFailureMetadata(execution.decorateSettledResultFailure(cause));
    assert.equal(facts?.settledResultPayloadHash, digest(savedText)); assert.equal(facts?.browserEffect?.providerEffectIdentityHash, A);
  }
  const causeLogger = logger("settled-cause");
  const nativeError = runtimeTransportFailure("LOCALIZATION_SOURCE_READ_FAILED", 503,
    Object.assign(new Error("socket reset"), { code: "ECONNRESET" }));
  const rootFailure = requireRuntimeLogWrite(causeLogger.emitError({ traceId: jobId, owner: "gpt", component: "gpt-child",
    operation: "gpt.child", typedIdentity: { kind: "gpt-call", jobId, attemptId, stepId: "research", capabilityCallId: "call:source" },
    failure: runtimeFailureFromError({ error: nativeError, code: nativeError.code, responsibleOwner: "gpt" }) }));
  const decoratedNative = execution.decorateSettledResultFailure(withRuntimeLogCause(nativeError, rootFailure.eventId));
  assert.equal(failureCode(decoratedNative), "RESULT_SETTLED_UNUSABLE");
  assert.equal(runtimeLogCauseEventId(decoratedNative), rootFailure.eventId);
  const nativeDetails = runtimeFailureFromError({ error: decoratedNative, code: failureCode(decoratedNative), responsibleOwner: "product-plugin" });
  assert.equal(nativeDetails.nativeCause, "ECONNRESET"); assert.equal(nativeDetails.httpStatus, 503);
  const live = new ProductionGptBrowserLifecycle(authority as never, logger("live-cache"), A, input);
  const liveCall = await live.browserFor(sessionKey, original.productStepId, original.callId);
  await live.recordConfirmedProviderEffect(liveCall, { exactCallIdentityHash: submit!.exactCallIdentityHash, childCapabilityId: "submit_exact_gpt_turn_once",
    providerEffectIdentityHash: A, effectScope: "provider_effect", browserOutcome: "CONFIRMED", mutationOutcome: "confirmed",
    terminalAt: outcome.terminalAt, evidenceRef: outcome.authorityRef, evidenceHash: B }, original, url, user);
  const liveSession = new ProductionGptExecutionSession(input, live, evidence, new ProductionGptSourceReuse(input, evidence, authority as never), () => {},
    async (call) => (call.child === "get_submitted_gpt_conversation_url" ? { ...restored, value: { canonicalConversationUrl: url, userTurnId: user } } : restored) as never, async (_call, _recorder, recordIdentity) => { recordIdentity(original); return submit; }).createExecution();
  await liveSession.tools.readConfirmedSubmit(submitCall); await locate(liveSession); const liveAcquisitions = acquisitions;
  await liveSession.tools.execute(textCall); assert.equal(liveCall.settledResultPayloadHash, digest(savedText)); assert.equal(acquisitions, liveAcquisitions);
  await liveSession.tools.execute({ ...submitCall, sessionKey: "next-live", productStepId: "next-live", child: "prepare_clean_gpt_chat", input: { timeoutMs: 1_000 } });
  await liveSession.settle(null);
  const missing = await execution.tools.execute({ ...textCall, callId: "text-checkpoint-missing", actionOrdinal: 3 });
  assert.equal(missing.value.semanticText, "first observed response"); assert.notEqual(missing.artifactRefs[0], textRef);
  assert.deepEqual([atomicReads, pageReads, appends], [1, 1, 1]);
  const sourceEffect = digest("source-effect"), sourceWal = digest("source-wal"), sourcePrompt = digest("old-prompt"), newPrompt = digest("new-prompt");
  let sourceReads = 0, sourceAcquisitions = 0; const checkpoints: unknown[] = [];
  const sourceAuthority = { readSourceConfirmedProviderEffect: () => { sourceReads += 1; return { exactCallIdentityHash: exact, inputHash: original.inputHash,
    actionOrdinal: 1, terminalPayload: { ...terminalPayload, promptHash: sourcePrompt },
    conversationLocator: readSubmittedConversationLocator({ terminalPayload: { ...terminalPayload, promptHash: sourcePrompt } },
      { exactCallIdentityHash: exact, providerEffectIdentityHash: sourceEffect }), authorityRef: "browser-mutation:source", authorityHash: sourceWal, terminalAt: outcome.terminalAt }; },
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
  await locate(reuse, sourceEffect);
  assert.equal((await reuse.tools.execute(textCall)).artifactRefs[0], textRef); assert.deepEqual([sourceReads, sourceAcquisitions, checkpoints.length], [3, 0, 1]);
  assert.equal(executionFailureMetadata(reuse.decorateSettledResultFailure(new Error("SOURCE_SCHEMA_INVALID")))?.settledResultPayloadHash, digest(savedText));
  assert.equal(executionFailureMetadata(reuse.decorateSettledResultFailure(new Error("SOURCE_SCHEMA_INVALID")))?.browserEffect?.providerEffectIdentityHash, sourceEffect);
  await reuse.settle(null);
  const unavailable = new ProductionGptChildTools(join(root, "unavailable"), A, createGptAbilityGroup(), evidence,
    { ...authority, acquireJobBoundTargetLease: async () => { throw browserExecutionFailure(new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE")); } } as never,
    logger("unavailable"), control).createExecution(input);
  assert.equal((await unavailable.tools.readConfirmedSubmit(submitCall))?.value.userTurnId, user);
  await locate(unavailable);
  assert.equal((await unavailable.tools.execute(textCall)).artifactRefs[0], textRef);
  assert.equal(failureCode(unavailable.decorateSettledResultFailure(new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID"))), "RESULT_SETTLED_UNUSABLE");
  for (const scope of [sessionKey, "different-session"]) {
    await unavailable.tools.readConfirmedSubmit(submitCall); await locate(unavailable); await unavailable.tools.execute(textCall);
    await assert.rejects(unavailable.tools.execute({ ...submitCall, sessionKey: scope, productStepId: "next-turn", child: "prepare_clean_gpt_chat", input: { timeoutMs: 1_000 } }),
      (error: unknown) => unavailable.decorateSettledResultFailure(error) === error);
  }
  corrupt.add(textKey); await assert.rejects(execution.tools.execute(textCall), (error: unknown) => {
    const decorated = execution.decorateSettledResultFailure(error), facts = executionFailureMetadata(decorated);
    assert.equal(failureCode(decorated), "EVIDENCE_ARTIFACT_READBACK_FAILED"); assert.equal(facts?.mutationOutcome, "confirmed");
    assert.equal(facts?.browserEffect?.providerEffectIdentityHash, A); assert.equal(facts?.evidence?.evidenceHash, B);
    assert.equal(facts?.settledResultPayloadHash, undefined);
    assert.ok(runtimeLogCauseEventId(error)); assert.equal(runtimeLogCauseEventId(decorated), runtimeLogCauseEventId(error)); return true;
  });
  assert.equal(pageReads, 1); assert.equal(appends, 1); await execution.settle(null);
  const imageCall = { ...textCall, callId: "image-checkpoint", child: "checkpoint_gpt_generated_image", actionOrdinal: 4,
    input: { ...textCall.input, turnMarker: "artifact-recovery-image" } } as const;
  const imageExact = gptExactCallIdentityHash({ jobId, attemptId, resultRevision: 0, productStepId: imageCall.productStepId,
    callId: imageCall.callId, childCapabilityId: imageCall.child, inputHash: gptCanonicalHash(imageCall.input) });
  const imageTools = new ProductionGptChildTools(join(root, "image"), A, createGptAbilityGroup(), evidence, authority as never, logger("image"), control), imageExecution = imageTools.createExecution(input);
  await imageExecution.tools.readConfirmedSubmit(submitCall); await locate(imageExecution); const image = await imageExecution.tools.execute(imageCall);
  assert.equal(image.value.originalSha256, imageHash); assert.deepEqual(image.value.originalBytes, bytes); assert.equal(image.artifactRefs.length, 1); assert.equal(imageReads, 1);
  const originalArtifact = await evidence.readArtifact({ idempotencyKey: `gpt-call-artifact:v1:${imageExact}:original` });
  assert.equal(originalArtifact.status, "success"); if (originalArtifact.status === "success") { assert.deepEqual(originalArtifact.artifact.content, bytes); assert.equal(originalArtifact.artifact.mimeType, "image/png"); }
  const imageEvidence = await readPersistedGptImageEvidence({ evidenceStore: evidence, jobId, attemptId, exactCallIdentityHash: imageExact });
  assert.equal(imageEvidence?.originalArtifactRef, image.artifactRefs[0]); assert.equal(imageEvidence?.binding.originalSha256, imageHash);
  const bindingKey = `gpt-call-artifact:v1:${imageExact}:source-binding`, binding = artifacts.get(bindingKey)!; assert.ok(binding);
  const coldImage = imageTools.createExecution(input); await coldImage.tools.readConfirmedSubmit(submitCall); await locate(coldImage);
  const imageBefore = [acquisitions, imageReads, appends, selections, atomicReads];
  assert.deepEqual((await coldImage.tools.execute(imageCall)).value.originalBytes, bytes);
  assert.deepEqual([acquisitions, imageReads, appends, selections, atomicReads], imageBefore);
  assert.equal(executionFailureMetadata(coldImage.decorateSettledResultFailure(new Error("IMAGE_SCHEMA_INVALID")))?.settledResultPayloadHash, imageHash);
  const real = createWorkbenchEvidenceStore(join(root, "forensics"), logger("forensics"));
  const realOriginal = await real.appendArtifact({ missionId: jobId, runId: attemptId, artifactType: "ai_raw_output", mimeType: "image/png", content: bytes,
    idempotencyKey: `gpt-call-artifact:v1:${imageExact}:original` }); assert.equal(realOriginal.status, "success");
  const realBindingBytes = new TextEncoder().encode(JSON.stringify({ ...JSON.parse(new TextDecoder().decode(binding.content)) as Record<string, unknown>, originalArtifactRef: realOriginal.artifactRef }));
  assert.equal((await real.appendArtifact({ missionId: jobId, runId: attemptId, artifactType: "other", mimeType: "application/json", content: realBindingBytes, idempotencyKey: bindingKey })).status, "success");
  const realEvidence = await readPersistedGptImageEvidence({ evidenceStore: real, jobId, attemptId, exactCallIdentityHash: imageExact });
  assert.deepEqual(realEvidence?.originalBytes, bytes); assert.equal(realEvidence?.originalArtifactRef, realOriginal.artifactRef); assert.notEqual(realEvidence?.integrityHash, digest(realBindingBytes));
  const descriptorReads: string[] = [];
  const descriptorOnly = { appendArtifact: real.appendArtifact.bind(real),
    readArtifact: async (query: Parameters<typeof real.readArtifact>[0]) => {
      descriptorReads.push(query.idempotencyKey);
      assert.equal(query.idempotencyKey, bindingKey, "cross-parent continuation must never read text or original image bytes");
      return real.readArtifact(query);
    } };
  const descriptorTools = new ProductionGptChildTools(join(root, "descriptor-only"), A, createGptAbilityGroup(),
    descriptorOnly, authority as never, logger("descriptor-only"), control);
  const descriptorInput = { jobId, sourceAttemptId: attemptId, checkpointExactCallIdentityHash: imageExact,
    artifactRef: realEvidence!.artifactRef, artifactContentHash: realEvidence!.integrityHash,
    canonicalConversationHash: digest(url), userTurnHash: digest(user) };
  assert.equal(await descriptorTools.readAdoptedImageReference(descriptorInput), realOriginal.artifactRef);
  assert.deepEqual(descriptorReads, [bindingKey]);
  for (const wrong of [{ jobId: "other-parent" }, { sourceAttemptId: "completion-not-source" },
    { artifactRef: "wrong-descriptor-ref" }, { artifactContentHash: A },
    { canonicalConversationHash: A }, { userTurnHash: B }]) {
    await assert.rejects(descriptorTools.readAdoptedImageReference({ ...descriptorInput, ...wrong }));
  }
  const altered = JSON.parse(new TextDecoder().decode(realBindingBytes)) as Record<string, unknown>;
  for (const [index, wrong] of [{ unexpected: true }, { originalArtifactRef: "" }, { schemaVersion: "unknown" },
    { originalSha256: "bad" }, { canonicalConversationHash: B }, { userTurnHash: B }].entries()) {
    const invalidAttempt = `invalid-source:${index}`;
    const invalid = await real.appendArtifact({ missionId: jobId, runId: invalidAttempt, artifactType: "other",
      mimeType: "application/json", content: JSON.stringify({ ...altered, ...wrong }), idempotencyKey: bindingKey });
    if (invalid.status !== "success") throw new Error("INVALID_DESCRIPTOR_FIXTURE_COLLISION");
    const stored = await real.readArtifact({ missionId: jobId, runId: invalidAttempt, idempotencyKey: bindingKey });
    if (stored.status !== "success") throw new Error("INVALID_DESCRIPTOR_FIXTURE_MISSING");
    await assert.rejects(descriptorTools.readAdoptedImageReference({ ...descriptorInput,
      sourceAttemptId: invalidAttempt, artifactRef: stored.artifactRef,
      artifactContentHash: stored.artifact.integrityHash as `sha256:${string}` }));
  }
  const failedDescriptor = new ProductionGptChildTools(join(root, "descriptor-io"), A, createGptAbilityGroup(),
    { ...descriptorOnly, readArtifact: async query => { assert.equal(query.idempotencyKey, bindingKey);
      return { status: "failed" as const, failureReason: "FORENSICS_ARTIFACT_INTEGRITY_MISMATCH" }; } },
    authority as never, logger("descriptor-io"), control);
  await assert.rejects(failedDescriptor.readAdoptedImageReference(descriptorInput), /EVIDENCE_ARTIFACT_READBACK_FAILED/u);
  artifacts.delete(bindingKey);
  await assert.rejects(coldImage.tools.execute(imageCall), (error: unknown) => {
    const decorated = coldImage.decorateSettledResultFailure(error), facts = executionFailureMetadata(decorated);
    assert.equal(failureCode(decorated), "GPT_GENERATED_IMAGE_TASK_ARTIFACT_INVALID"); assert.equal(facts?.mutationOutcome, "confirmed");
    assert.equal(facts?.settledResultPayloadHash, undefined);
    assert.ok(runtimeLogCauseEventId(error)); assert.equal(runtimeLogCauseEventId(decorated), runtimeLogCauseEventId(error)); return true;
  });
  assert.deepEqual([acquisitions, imageReads, appends, selections, atomicReads], imageBefore);
  await assert.rejects(readPersistedGptImageEvidence({ evidenceStore: evidence, jobId, attemptId, exactCallIdentityHash: imageExact }),
    (error: unknown) => failureCode(error) === "GPT_GENERATED_IMAGE_TASK_ARTIFACT_INVALID");
  await assert.rejects(imageTools.verifySourceCheckpointArtifact({ jobId, sourceAttemptId: attemptId, checkpointExactCallIdentityHash: imageExact,
    artifactRef: imageEvidence!.artifactRef, artifactContentHash: imageEvidence!.integrityHash }), (error: unknown) => failureCode(error) === "GPT_GENERATED_IMAGE_TASK_ARTIFACT_INVALID");
  artifacts.set(bindingKey, binding); assert.equal(appends, 3);
  const imageReuse = new ProductionGptChildTools(join(root, "image-reuse"), A, createGptAbilityGroup(), evidence, sourceAuthority as never, logger("image-reuse"), control).createExecution({
    ...input, attemptId: "image-reuse-attempt", resultRevision: 1, leaseVersion: 2, sourceReuseZeroSubmitGrant: true, deliveryPriorityReplayCalls: [],
    sourceReusableCalls: [{ ...grant, checkpointExactCallIdentityHash: imageExact, artifactRef: imageEvidence!.artifactRef, artifactContentHash: imageEvidence!.integrityHash }],
    recordSettledCheckpoint: checkpoint => { checkpoints.push(checkpoint); } });
  for (const renamed of [{ ...submitCall, productStepId: "renamed-step" }, { ...submitCall, callId: "renamed-submit" }])
    await assert.rejects(imageReuse.tools.readConfirmedSubmit(renamed), (error: unknown) => failureCode(error) === "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH");
  await assert.rejects(imageReuse.tools.execute({ ...imageCall, productStepId: "renamed-step" }), (error: unknown) => failureCode(error) === "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH");
  assert.deepEqual([sourceReads, sourceAcquisitions], [3, 0]);
  assert.equal((await imageReuse.tools.readConfirmedSubmit({ ...submitCall, input: { files: [], promptHash: newPrompt } }))?.value.promptHash, sourcePrompt);
  await locate(imageReuse, sourceEffect);
  const restoredImage = await imageReuse.tools.execute(imageCall); assert.deepEqual(restoredImage.value.originalBytes, bytes); assert.equal(restoredImage.artifactRefs[0], image.artifactRefs[0]);
  assert.deepEqual([sourceReads, sourceAcquisitions, checkpoints.length], [6, 0, 2]);
  assert.equal(executionFailureMetadata(imageReuse.decorateSettledResultFailure(new Error("SOURCE_IMAGE_SCHEMA_INVALID")))?.settledResultPayloadHash, imageHash);
  await assert.rejects(imageReuse.tools.execute({ ...submitCall, sessionKey: "next-source", productStepId: "next-source", child: "prepare_clean_gpt_chat", input: { timeoutMs: 1_000 } }),
    (error: unknown) => { assert.equal(failureCode(error), "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH"); return imageReuse.decorateSettledResultFailure(error) === error; });
  const abort = new AbortController(), aborted = imageTools.createExecution({ ...input, abortSignal: abort.signal });
  await aborted.tools.readConfirmedSubmit(submitCall); await locate(aborted); await aborted.tools.execute(imageCall); abort.abort("NEXT_TURN_ABORTED");
  await assert.rejects(aborted.tools.execute({ ...submitCall, child: "prepare_clean_gpt_chat", input: { timeoutMs: 1_000 } }),
    (error: unknown) => { assert.equal(failureCode(error), "NEXT_TURN_ABORTED"); return aborted.decorateSettledResultFailure(error) === error; });
  await aborted.settle(null);
  await imageReuse.settle(null); await imageExecution.settle(null); await coldImage.settle(null);
  const { canonicalConversationUrl: _historicalUrl, ...messageProof } = terminalPayload;
  let unlocatedAcquisitions = 0;
  const unlocated = new ProductionGptChildTools(join(root, "unlocated"), A, createGptAbilityGroup(), evidence, {
    ...authority, readProviderEffectStepCallFact: () => ({ ...authority.readProviderEffectStepCallFact(),
      confirmedOutcome: { ...outcome, terminalPayload: { schemaVersion: "grasseye.browser.confirmed-submit-proof.v2", ...messageProof },
        conversationLocator: null } }),
    acquireJobBoundTargetLease: async (_binding: unknown, _owner: unknown, wait: { targetMode: string }) => {
      unlocatedAcquisitions += 1; assert.equal(wait.targetMode, "bound-observation");
      throw browserExecutionFailure(new Error("BROWSER_TARGET_INVALID"));
    },
  } as never, logger("unlocated"), control).createExecution({ ...input,
    readbackOnlyCalls: [{ productStepId: original.productStepId, callId: original.callId, childCapabilityId: "submit_exact_gpt_turn_once" }] });
  const confirmedWithoutUrl = await unlocated.tools.readConfirmedSubmit(submitCall);
  assert.equal(confirmedWithoutUrl?.effectReceipt?.outcome, "CONFIRMED");
  assert.equal(unlocatedAcquisitions, 0, "absence of locator must not acquire a fresh Browser or negate the send");
  await assert.rejects(locate(unlocated), error => {
    const facts = executionFailureMetadata(error);
    assert.equal(failureCode(error), "BROWSER_TARGET_INVALID");
    assert.equal(facts?.mutationOutcome, "confirmed");
    assert.equal(facts?.browserEffect?.providerEffectIdentityHash, A);
    assert.equal(facts?.browserEffect?.browserOutcome, "CONFIRMED"); return true;
  });
  assert.equal(unlocatedAcquisitions, 1); await unlocated.settle(null);
  corrupt.delete(textKey);
  for (const source of [true, false]) {
    let currentUrl = source ? url : "https://chatgpt.com/", currentDocument = "document:next-target";
    let acquired = 0, selected = 0, navigated = 0, reached = 0;
    let commandIdentity: BrowserAtomicStepIdentity | null = null;
    const nextBrowser = { ...browser, get document() { return { documentRef: currentDocument }; },
      runAtomicStep: async (identity: BrowserAtomicStepIdentity, action: () => Promise<unknown>) => {
        commandIdentity = identity;
        try { return await action(); } finally { commandIdentity = null; }
      },
      executeDomIntent: async (intent: BrowserDomIntent) => {
        assert.equal(intent.kind, "selectExactGptConversation");
        if (intent.kind !== "selectExactGptConversation") throw new Error("UNEXPECTED_URL_SEAM_COMMAND");
        assert.equal(intent.canonicalConversationUrl, url); assert.equal(commandIdentity?.callId, "next-url-probe");
        selected += 1;
        if (currentUrl !== intent.canonicalConversationUrl) {
          currentUrl = intent.canonicalConversationUrl; currentDocument = "document:after-exact-navigation"; navigated += 1;
        }
      },
    };
    const baseGpt = createGptAbilityGroup();
    const probeGpt: typeof baseGpt = { execute: async (intent, context) => {
      if (intent.callId !== "next-url-probe") return baseGpt.execute(intent, context);
      assert.equal(currentUrl, url); assert.equal(context.browser?.document.documentRef, currentDocument);
      assert.equal(context.browserAtomicIdentity?.productStepId, "other-step");
      reached += 1; throw executionFailure("failed", "URL_SEAM_REACHED");
    } };
    const probeAuthority = { ...authority, ...sourceAuthority,
      readProviderEffectStepCallFact: (query: { productStepId: string }) => query.productStepId === "research"
        ? authority.readProviderEffectStepCallFact() : null,
      acquireJobBoundTargetLease: async (_binding: unknown, _owner: string, wait: { targetMode: string }) => {
        acquired += 1;
        if (wait.targetMode === "fresh") currentUrl = "https://chatgpt.com/";
        assert.equal(wait.targetMode, "confirmed-readback", "settled answer must retain its original URL for the next turn");
        return nextBrowser;
      },
    };
    const probe = new ProductionGptChildTools(join(root, `url-${source}`), A, probeGpt, evidence,
      probeAuthority as never, logger(`url-${source}`), control).createExecution({ ...input,
      ...(source ? { attemptId: "url-source-attempt", resultRevision: 1, leaseVersion: 2,
        sourceReusableCalls: [grant], deliveryPriorityReplayCalls: [{ productStepId: "other-step", callId: "other-submit",
          childCapabilityId: "submit_exact_gpt_turn_once" as const, sourceEffectSetHash: A, callGrantHash: B }] } : {}) });
    await probe.tools.readConfirmedSubmit(submitCall); await locate(probe, source ? sourceEffect : A);
    assert.equal((await probe.tools.execute(textCall)).artifactRefs[0], textRef);
    assert.deepEqual([acquired, selected, navigated, reached], [0, 0, 0, 0]);
    assert.equal(await probe.tools.readConfirmedSubmit({ ...submitCall, productStepId: "other-step", callId: "other-submit" }), null);
    await assert.rejects(probe.tools.execute({ sessionKey, productStepId: "other-step", callId: "next-url-probe",
      child: "write_exact_gpt_prompt", actionOrdinal: 3, input: { prompt: "next authorized turn" } }),
    error => failureCode(error) === "URL_SEAM_REACHED");
    assert.deepEqual([acquired, selected, navigated, reached], [1, 1, source ? 0 : 1, 1]);
    await probe.settle(null);
  }
  assert.ok(acquisitions > 0);
  let conflictingUrl = url;
  const consistent = new ProductionGptBrowserLifecycle(authority as never, logger("url-consistency"), A, input);
  const consistentSession = new ProductionGptExecutionSession(input, consistent, evidence,
    new ProductionGptSourceReuse(input, evidence, authority as never), () => {},
    async call => (call.child === "get_submitted_gpt_conversation_url"
      ? { ...restored, value: { canonicalConversationUrl: conflictingUrl, userTurnId: user } } : restored) as never,
    async (_call, _recorder, recordIdentity) => { recordIdentity(original); return submit; }).createExecution();
  await consistentSession.tools.readConfirmedSubmit(submitCall); await locate(consistentSession);
  await consistentSession.tools.execute(textCall);
  conflictingUrl = "https://chatgpt.com/c/conflicting-settled-url";
  await consistentSession.tools.readConfirmedSubmit(submitCall); await locate(consistentSession);
  await assert.rejects(consistentSession.tools.execute({ ...textCall, input: { ...textCall.input, canonicalConversationUrl: conflictingUrl } }), error => {
    const decorated = consistentSession.decorateSettledResultFailure(error), facts = executionFailureMetadata(decorated);
    assert.equal(failureCode(decorated), "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
    assert.equal(facts?.browserEffect?.providerEffectIdentityHash, A);
    assert.equal(facts?.settledResultPayloadHash, undefined); return true;
  });
  const retained = await consistent.browserFor(sessionKey, "next", "probe");
  await consistent.selectSettledConversation(retained);
  await consistentSession.settle(null);
  for (const retirement of ["fresh", "session", "settle", "park-failure", "job"] as const) {
    const modes: string[] = [];
    let failPark = retirement === "park-failure";
    const retireAuthority = { acquireJobBoundTargetLease: async (_binding: unknown, _owner: string, wait: { targetMode: string }) => {
      modes.push(wait.targetMode);
      return { ...browser, park: async () => { if (failPark) throw executionFailure("failed", "BROWSER_TARGET_INVALID"); } };
    } };
    const lifecycle = new ProductionGptBrowserLifecycle(retireAuthority as never, logger(`retire-${retirement}`), A, input);
    lifecycle.recordSettledResult(A, B, { sessionKey, canonicalConversationUrl: url });
    if (retirement === "settle" || retirement === "park-failure") {
      if (failPark) await lifecycle.browserFor(sessionKey, "next", "before-settle");
      if (failPark) await assert.rejects(lifecycle.settle(null), /GPT_BROWSER_LIFECYCLE_FAILED/u);
      else await lifecycle.settle(null);
    }
    const target = retirement === "job" ? new ProductionGptBrowserLifecycle(retireAuthority as never,
      logger("retire-other-job"), A, { ...input, jobId: "job:other" }) : lifecycle;
    await acquireProductionBrowserCall(target, { ...submitCall, sessionKey: retirement === "session" ? "different-session" : sessionKey,
      productStepId: "next", callId: "retire-probe", child: retirement === "fresh" ? "prepare_clean_gpt_chat" : "write_exact_gpt_prompt",
      input: retirement === "fresh" ? { timeoutMs: 1_000 } : { prompt: "next" } }, "chatgpt", false);
    assert.equal(modes.at(-1), "fresh", retirement);
    failPark = false; await target.settle(null); if (target !== lifecycle) await lifecycle.settle(null);
  }
  for (const failure of [null, "BROWSER_TARGET_INVALID", "BROWSER_WAIT_ABORTED"] as const) {
    let selected = 0, reached = 0, parked = 0;
    const selectionError = failure ? executionFailure("failed", failure) : null;
    const lifecycle = new ProductionGptBrowserLifecycle({ acquireJobBoundTargetLease: async () => ({ ...browser,
      executeDomIntent: async () => { selected += 1; if (selectionError) throw selectionError; },
      park: async () => { parked += 1; },
    }) } as never, logger(`selection-${failure ?? "ack"}`), A, input);
    lifecycle.recordSettledResult(A, B, { sessionKey, canonicalConversationUrl: url });
    const active = await lifecycle.browserFor(sessionKey, "next", "probe");
    const marker = executionFailure("failed", "URL_ATOMIC_PROBE_REACHED");
    const atomic = (child: "write_exact_gpt_prompt" | "acknowledge_known_gpt_rate_limit") => executeProductionGptAtomicCall({
      dataDir: root, gpt: { execute: async () => { reached += 1; throw marker; } }, browsers: lifecycle, browserCall: active,
      signal: input.abortSignal, resultRevision: 0, intent: { executionId: "probe", jobId, attemptId, resultRevision: 0,
        productStepId: "next", callId: "probe", childCapabilityId: child, inputHash: B, actionOrdinal: 3, input: {} } as never });
    if (!failure) {
      await assert.rejects(atomic("acknowledge_known_gpt_rate_limit"), error => error === marker);
      assert.deepEqual([selected, reached, active.recoverySelectionRequired], [0, 1, true]);
    }
    await assert.rejects(atomic("write_exact_gpt_prompt"), error => error === (selectionError ?? marker));
    assert.deepEqual([selected, reached, active.recoverySelectionRequired], [1, failure ? 0 : 2, failure !== null]);
    await lifecycle.settle(selectionError); await lifecycle.settle(null); assert.equal(parked, 1);
  }
} finally { await rm(root, { recursive: true, force: true }); }
