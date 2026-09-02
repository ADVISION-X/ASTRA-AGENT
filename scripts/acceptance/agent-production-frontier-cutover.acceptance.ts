import assert from "../audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createGptAbilityGroup,
  gptContinuationIdentityHash,
  gptExactCallIdentityHash,
  type GptProviderContinuation,
} from "../../src/capabilities/gpt/index.js";
import { createForensicsPersistenceAbilityGroupFromStorage } from "../../src/capabilities/forensics-persistence/index.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { persistGptChildEvidence } from "../../src/lib/local-runtime/production/gpt-evidence-writer.js";
import { startProductionRuntime } from "../../src/lib/local-runtime/production/runtime.js";
import { reconcileTaskRecord } from "../../src/lib/local-runtime/production/runtime-startup.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { createGrassEyeFileStorage } from "../../src/lib/storage/index.js";
import { turnMarker } from "../../src/plugins/public-knowledge-article-pipeline/seo-turn-contract.js";
import { HASH_A, HASH_B, identityFor, task } from "./agent-production-runtime-fixtures.js";

const digest = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const root = await mkdtemp(path.join(tmpdir(), "agent-frontier-cutover-"));
const previousCredentialPath = process.env.AGENT_PRODUCTION_CREDENTIAL_FILE;
process.env.AGENT_PRODUCTION_CREDENTIAL_FILE = path.join(root, "missing-credential.json");
try {
  const evidenceStore = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root));
  const store = new ProductionRuntimeStore(root);
  const articleTask = task({
    jobId: "job:frontier-cutover-article",
    productId: "public_knowledge_article_pipeline",
    actionId: "produce_article",
  });
  const unresolvedTask = task({
    jobId: "job:frontier-cutover-unresolved",
    productId: "public_knowledge_article_pipeline",
    actionId: "produce_article",
  });
  const legacyImageTask = task({
    jobId: "job:frontier-cutover-image",
    productId: "public_knowledge_article_pipeline",
    actionId: "produce_article",
  });
  const originCopyTask = task({
    jobId: "job:frontier-cutover-origin-copy",
    productId: "public_knowledge_article_pipeline",
    actionId: "produce_article",
  });
  const articleAttemptId = "attempt:frontier-cutover-article";
  const unresolvedAttemptId = "attempt:frontier-cutover-unresolved";
  const legacyImageAttemptId = "attempt:frontier-cutover-image";
  const originCopyAttemptId = "attempt:frontier-cutover-origin-copy";
  store.acceptTask(articleTask, identityFor(articleTask), articleAttemptId);
  store.acceptTask(unresolvedTask, identityFor(unresolvedTask), unresolvedAttemptId);
  store.acceptTask(legacyImageTask, identityFor(legacyImageTask), legacyImageAttemptId);
  store.acceptTask(originCopyTask, identityFor(originCopyTask), originCopyAttemptId);

  const articleText = '{"schema_version":"public-knowledge-article-output.v3","title":"cutover"}';
  const articleRawDom = `<div data-message-author-role="assistant">${articleText}</div>`;
  const articlePromptHash = digest("article prompt");
  const articleOutputHash = digest(articleText);
  const articleProvider = (currentTask: typeof articleTask, attemptId: string): GptProviderContinuation => ({
    provider_page_url: `https://chatgpt.com/c/${currentTask.job_id.replaceAll(":", "-")}`,
    prior_task_id: currentTask.job_id,
    prior_prompt_hash: articlePromptHash,
    prior_raw_output_hash: articleOutputHash,
    prior_turn_marker: turnMarker(currentTask, attemptId, "article_synthesis"),
  });
  const originProvider = (currentTask: typeof articleTask): GptProviderContinuation => ({
    provider_page_url: `https://chatgpt.com/c/${currentTask.job_id.replaceAll(":", "-")}`,
    prior_task_id: currentTask.job_id,
    prior_prompt_hash: HASH_A,
    prior_raw_output_hash: HASH_B,
    prior_turn_marker: "[GRASSEYE:origin-research]",
  });
  const installLegacyFrontier = (currentTask: typeof articleTask, attemptId: string): string => {
    const currentProvider = articleProvider(currentTask, attemptId);
    const ref = `gpt-continuation:${digest(currentTask.job_id).slice(7, 39)}`;
    store.createGptContinuation({
      continuation_ref: ref,
      origin_job_id: currentTask.job_id,
      plugin_id: "public-knowledge-article-pipeline",
      owner_ref: currentTask.business_identity.owner_ref,
      subject_ref: currentTask.business_identity.subject_ref,
      authorization_ref: currentTask.business_identity.authorization_ref,
      conversation_identity_hash: gptContinuationIdentityHash(currentProvider),
      frontier_ref: digest(`frontier:${currentTask.job_id}`),
      origin_provider: originProvider(currentTask),
      origin_checkpoint: {
        source_attempt_id: "attempt:origin-research",
        assistant_turn_id: "conversation-turn-2",
        artifact_ref: `artifact:origin:${currentTask.job_id}`,
        raw_dom_hash: HASH_A,
        semantic_text_hash: HASH_B,
        canonical_conversation_url: currentProvider.provider_page_url,
        prompt_hash: HASH_A,
        turn_marker: "[GRASSEYE:origin-research]",
        evidence_ref: `evidence:origin:${currentTask.job_id}`,
        evidence_hash: HASH_B,
      },
      provider: currentProvider,
      current_checkpoint: null,
      lane_version: 2,
      lane_owner_job_id: null,
    });
    return ref;
  };
  const articleContinuationRef = installLegacyFrontier(articleTask, articleAttemptId);
  const unresolvedContinuationRef = installLegacyFrontier(unresolvedTask, unresolvedAttemptId);
  const legacyImageProvider: GptProviderContinuation = {
    provider_page_url: `https://chatgpt.com/c/${legacyImageTask.job_id.replaceAll(":", "-")}`,
    prior_task_id: legacyImageTask.job_id,
    prior_prompt_hash: digest("image prompt"),
    prior_raw_output_hash: digest("image bytes"),
    prior_turn_marker: turnMarker(legacyImageTask, legacyImageAttemptId, "article_image_generation"),
  };
  const legacyImageContinuationRef = `gpt-continuation:${digest(legacyImageTask.job_id).slice(7, 39)}`;
  store.createGptContinuation({
    continuation_ref: legacyImageContinuationRef,
    origin_job_id: legacyImageTask.job_id,
    plugin_id: "public-knowledge-article-pipeline",
    owner_ref: legacyImageTask.business_identity.owner_ref,
    subject_ref: legacyImageTask.business_identity.subject_ref,
    authorization_ref: legacyImageTask.business_identity.authorization_ref,
    conversation_identity_hash: gptContinuationIdentityHash(legacyImageProvider),
    frontier_ref: digest(`frontier:${legacyImageTask.job_id}`),
    origin_provider: originProvider(legacyImageTask),
    origin_checkpoint: {
      source_attempt_id: "attempt:origin-research", assistant_turn_id: "conversation-turn-2",
      artifact_ref: `artifact:origin:${legacyImageTask.job_id}`, raw_dom_hash: HASH_A,
      semantic_text_hash: HASH_B, canonical_conversation_url: legacyImageProvider.provider_page_url,
      prompt_hash: HASH_A, turn_marker: "[GRASSEYE:origin-research]",
      evidence_ref: `evidence:origin:${legacyImageTask.job_id}`, evidence_hash: HASH_B,
    },
    provider: legacyImageProvider, current_checkpoint: null,
    lane_version: 2, lane_owner_job_id: null,
  });

  const checkpointInput = {
    assistantTurnId: "conversation-turn-4",
    canonicalConversationUrl: articleProvider(articleTask, articleAttemptId).provider_page_url,
    expectedPromptHash: articlePromptHash,
    expectedResponseHash: articleOutputHash,
    turnMarker: turnMarker(articleTask, articleAttemptId, "article_synthesis"),
  } as const;
  const exactIdentity = {
    jobId: articleTask.job_id,
    attemptId: articleAttemptId,
    pluginId: "public-knowledge-article-pipeline",
    pluginVersion: 16,
    productStepId: "article_synthesis",
    callId: "text-checkpoint",
    childCapabilityId: "checkpoint_gpt_text_response" as const,
    inputHash: hashCanonical(checkpointInput),
  };
  const exactCallIdentityHash = gptExactCallIdentityHash(exactIdentity);
  const timestamp = new Date().toISOString();
  await persistGptChildEvidence({
    intent: {
      ...exactIdentity,
      executionId: `gpt-call:${exactCallIdentityHash.slice(7)}`,
      actionOrdinal: 30,
      input: checkpointInput,
    },
    evidenceStore,
    jobId: articleTask.job_id,
    attemptId: articleAttemptId,
    stepId: "article_synthesis",
    exactCallIdentityHash,
    result: {
      status: "success",
      failureCode: null,
      failureCause: null,
      failureBrowserEffect: null,
      value: {
        assistantTurnId: checkpointInput.assistantTurnId,
        rawDomHtml: articleRawDom,
        rawDomHash: digest(articleRawDom),
        semanticText: articleText,
        semanticTextHash: articleOutputHash,
      },
      proof: {
        schemaVersion: "gpt-child-capability-proof.v2",
        ...exactIdentity,
        executionId: `gpt-call:${exactCallIdentityHash.slice(7)}`,
        actionOrdinal: 30,
        targetRefHash: HASH_A,
        beforeDocumentRefHash: HASH_A,
        afterDocumentRefHash: HASH_B,
        candidateCount: 1,
        observedSemantics: ["legacy article checkpoint"],
        committedMutation: "no",
        postconditionResult: "passed",
        startedAt: timestamp,
        endedAt: timestamp,
        evidenceRef: "browser:legacy-article-checkpoint",
        evidenceHash: HASH_B,
      },
    },
  });
  const originCopyProvider: GptProviderContinuation = {
    provider_page_url: `https://chatgpt.com/c/${originCopyTask.job_id.replaceAll(":", "-")}`,
    prior_task_id: originCopyTask.job_id,
    prior_prompt_hash: digest("origin research prompt"),
    prior_raw_output_hash: articleOutputHash,
    prior_turn_marker: turnMarker(originCopyTask, originCopyAttemptId, "corpus_research"),
  };
  const originCopyInput = {
    assistantTurnId: "conversation-turn-2",
    canonicalConversationUrl: originCopyProvider.provider_page_url,
    expectedPromptHash: originCopyProvider.prior_prompt_hash,
    expectedResponseHash: originCopyProvider.prior_raw_output_hash,
    turnMarker: originCopyProvider.prior_turn_marker,
  } as const;
  const originCopyIdentity = {
    jobId: originCopyTask.job_id, attemptId: originCopyAttemptId,
    pluginId: "public-knowledge-article-pipeline", pluginVersion: 16,
    productStepId: "corpus_research", callId: "text-checkpoint",
    childCapabilityId: "checkpoint_gpt_text_response" as const,
    inputHash: hashCanonical(originCopyInput),
  };
  const originCopyExactHash = gptExactCallIdentityHash(originCopyIdentity);
  await persistGptChildEvidence({
    intent: {
      ...originCopyIdentity, executionId: `gpt-call:${originCopyExactHash.slice(7)}`,
      actionOrdinal: 15, input: originCopyInput,
    },
    evidenceStore, jobId: originCopyTask.job_id, attemptId: originCopyAttemptId,
    stepId: "corpus_research", exactCallIdentityHash: originCopyExactHash,
    result: {
      status: "success", failureCode: null, failureCause: null, failureBrowserEffect: null,
      value: {
        assistantTurnId: originCopyInput.assistantTurnId, rawDomHtml: articleRawDom,
        rawDomHash: digest(articleRawDom), semanticText: articleText,
        semanticTextHash: articleOutputHash,
      },
      proof: {
        schemaVersion: "gpt-child-capability-proof.v2", ...originCopyIdentity,
        executionId: `gpt-call:${originCopyExactHash.slice(7)}`, actionOrdinal: 15,
        targetRefHash: HASH_A, beforeDocumentRefHash: HASH_A, afterDocumentRefHash: HASH_B,
        candidateCount: 1, observedSemantics: ["verified origin checkpoint"],
        committedMutation: "no", postconditionResult: "passed",
        startedAt: timestamp, endedAt: timestamp,
        evidenceRef: "browser:verified-origin-checkpoint", evidenceHash: HASH_B,
      },
    },
  });
  const originCopyEvidence = await evidenceStore.readExactCallEvidence({
    missionId: originCopyTask.job_id, runId: originCopyAttemptId,
    exactCallIdentityHash: originCopyExactHash,
  });
  assert(originCopyEvidence);
  const originCopyArtifactRef = (originCopyEvidence.record.artifactRefs as readonly string[] | undefined)?.[0];
  const originCopyPayload = originCopyEvidence.record.payload as Readonly<Record<string, unknown>>;
  assert.equal(typeof originCopyArtifactRef, "string");
  const originCopyContinuationRef = `gpt-continuation:${digest(originCopyTask.job_id).slice(7, 39)}`;
  store.createGptContinuation({
    continuation_ref: originCopyContinuationRef, origin_job_id: originCopyTask.job_id,
    plugin_id: "public-knowledge-article-pipeline",
    owner_ref: originCopyTask.business_identity.owner_ref,
    subject_ref: originCopyTask.business_identity.subject_ref,
    authorization_ref: originCopyTask.business_identity.authorization_ref,
    conversation_identity_hash: gptContinuationIdentityHash(originCopyProvider),
    frontier_ref: digest(`frontier:${originCopyTask.job_id}`),
    origin_provider: originCopyProvider,
    origin_checkpoint: {
      source_attempt_id: originCopyAttemptId, assistant_turn_id: originCopyInput.assistantTurnId,
      artifact_ref: originCopyArtifactRef!, raw_dom_hash: digest(articleRawDom),
      semantic_text_hash: articleOutputHash, canonical_conversation_url: originCopyProvider.provider_page_url,
      prompt_hash: originCopyProvider.prior_prompt_hash, turn_marker: originCopyProvider.prior_turn_marker,
      evidence_ref: originCopyEvidence.recordRef,
      evidence_hash: originCopyPayload.source_evidence_hash as `sha256:${string}`,
    },
    provider: originCopyProvider, current_checkpoint: null,
    lane_version: 0, lane_owner_job_id: null,
  });
  store.setCurrentReason(unresolvedTask.job_id, "POST_SUBMIT_READBACK_FAULT");
  store.recordLease({
    jobId: unresolvedTask.job_id, attemptId: unresolvedAttemptId, leaseVersion: 1,
    fenceHash: HASH_A, state: "active", expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  store.recordCheckpoint({
    jobId: unresolvedTask.job_id, attemptId: unresolvedAttemptId,
    checkpointId: "checkpoint:stale-cutover", checkpointHash: HASH_B, state: "persisted",
  });
  assert.equal(reconcileTaskRecord({ store } as never, store.readTask(unresolvedTask.job_id)!), true);
  assert.equal(
    store.readTask(unresolvedTask.job_id)?.current_reason,
    "POST_SUBMIT_READBACK_FAULT",
    "startup must preserve the exact post-submit readback reason instead of replacing it with a restart label",
  );
  store.setCurrentReason(unresolvedTask.job_id, "GPT_CONTINUATION_CUTOVER_ARTIFACT_UNRESOLVED");
  store.recordLease({
    jobId: unresolvedTask.job_id, attemptId: unresolvedAttemptId, leaseVersion: 1,
    fenceHash: HASH_A, state: "active", expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.equal(reconcileTaskRecord({ store } as never, store.readTask(unresolvedTask.job_id)!), true,
    "a task-local cutover failure must not invalidate the global reconciliation baseline");
  assert.equal(
    store.readTask(unresolvedTask.job_id)?.current_reason,
    "GPT_CONTINUATION_CUTOVER_ARTIFACT_UNRESOLVED",
    "post-credential stale-lease reconciliation must preserve the more exact cutover failure",
  );
  store.close();

  const runtime = await startProductionRuntime({
    dataDir: root,
    sourceHash: HASH_A,
    gpt: createGptAbilityGroup(),
    evidenceStore,
    browserAuthority: {
      readProductionRuntimeState: () => ({
        browserAuthorityState: "absent" as const,
        browserTargetState: "absent" as const,
      }),
    } as never,
    runtimeLogger: createRuntimeLogger({
      producer: "agent-frontier-cutover",
      owner: "production-runtime",
      component: "frontier-cutover",
      terminalEnabled: false,
      fileSink: { directoryPath: path.join(root, "runtime-logs") },
    }),
  });
  await runtime.close();

  const verified = new ProductionRuntimeStore(root);
  const articleCheckpoint = verified.readGptContinuation(articleContinuationRef)?.current_checkpoint;
  assert.equal(articleCheckpoint?.checkpoint_kind, "text",
    verified.readTask(articleTask.job_id)?.current_reason ?? "missing task reason");
  if (articleCheckpoint?.checkpoint_kind !== "text") throw new Error("ARTICLE_CUTOVER_MISSING");
  assert.equal(articleCheckpoint.source_attempt_id, articleAttemptId);
  assert.equal(articleCheckpoint.assistant_turn_id, "conversation-turn-4");
  assert.equal(articleCheckpoint.semantic_text_hash, articleOutputHash);
  const originCopyCheckpoint = verified.readGptContinuation(originCopyContinuationRef)?.current_checkpoint;
  assert.equal(originCopyCheckpoint?.checkpoint_kind, "text",
    "provider==origin cutover must still verify and then copy the origin checkpoint");
  assert.equal(originCopyCheckpoint?.source_attempt_id, originCopyAttemptId);
  assert.equal(verified.readGptContinuation(unresolvedContinuationRef)?.current_checkpoint, null,
    "an unresolved legacy frontier must remain task-locally fail-closed");
  assert.equal(
    verified.readTask(unresolvedTask.job_id)?.current_reason,
    "GPT_CONTINUATION_CUTOVER_ARTIFACT_UNRESOLVED",
  );
  assert.equal(verified.readGptContinuation(legacyImageContinuationRef)?.current_checkpoint, null);
  assert.equal(
    verified.readTask(legacyImageTask.job_id)?.current_reason,
    "GPT_CONTINUATION_CUTOVER_PREDECESSOR_UNAVAILABLE",
    "a legacy generated-image provider without its direct article predecessor must fail task-locally",
  );
  assert.notEqual(verified.readTask(articleTask.job_id)?.current_reason,
    "GPT_CONTINUATION_CUTOVER_ARTIFACT_UNRESOLVED",
    "one unresolved task must not block another task's exact cutover",
  );
  verified.close();
} finally {
  if (previousCredentialPath === undefined) delete process.env.AGENT_PRODUCTION_CREDENTIAL_FILE;
  else process.env.AGENT_PRODUCTION_CREDENTIAL_FILE = previousCredentialPath;
  await rm(root, { recursive: true, force: true });
}
