import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { failureCode } from "../../../lib/execution-failure.js";
import { createGptAbilityGroup } from "../index.js";
import { gptCanonicalHash, gptExactCallIdentityHash } from "../contract.js";
import { ProductionGptChildTools } from "../production-child-tools.js";
import { exactAssistantTurnReply } from "./gpt-exact-target-browser-fixture.js";
import { browserExactCallIdentityHash,
  type BrowserDomIntent } from "../../../lib/browser/browser-authority-api.js";

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
    }).createExecution({ jobId,
    productId: "public_knowledge_article_pipeline",
    attemptId, resultRevision: 0, ownerRef: "owner:1", subjectRef: "subject:1",
    authorizationRef: "authorization:1", deviceId: "device:1", leaseVersion: 1,
    executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
    expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
    abortSignal: new AbortController().signal, parentSpanId: "parent", maxProviderTurns: 1 });
  const recoveredSubmit = await execution.tools.readConfirmedSubmit({ sessionKey,
    productStepId: "research", callId: "turn-submit", child: "submit_exact_gpt_turn_once",
    actionOrdinal: 1, input: submitInput });
  assert.equal(recoveredSubmit?.value.userTurnId, "conversation-turn-1");
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
  const realExecution = new ProductionGptChildTools(join(temporary, "real-execution"), HASH_A,
    createGptAbilityGroup(), evidenceStore, authority as never,
    createRuntimeLogger({ producer: "gpt-artifact-recovery-real-store",
      owner: "production-runtime", component: "gpt-child", terminalEnabled: false,
      fileSink: { directoryPath: join(temporary, "real-runtime-logs") } }), {
      assertProviderSubmitAllowed: () => undefined,
      pendingIncidents: () => Object.freeze([]),
      beginIncident: async () => { throw new Error("UNEXPECTED_PROVIDER_RATE_LIMIT"); },
    }).createExecution({ jobId,
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
  assert.equal(artifactAppends, 2,
    "the image checkpoint must append exactly its one original artifact through the evidence port");
  await realExecution.settle(null);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
