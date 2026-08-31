import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import { createGptAbilityGroup, gptExactCallIdentityHash } from "../../src/capabilities/gpt/index.js";
import {
  createForensicsPersistenceAbilityGroupFromStorage,
  type ForensicsPersistenceAbilityGroup,
} from "../../src/capabilities/forensics-persistence/index.js";
import { hashCanonical, type WebsiteAgentTask } from "../../src/lib/local-runtime/production/contracts.js";
import {
  ProductionGptChildTools,
  type ProductGptExecution,
} from "../../src/lib/local-runtime/production/production-gpt-child-tools.js";
import { persistGptChildEvidence } from "../../src/lib/local-runtime/production/gpt-evidence-writer.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import type { WorkbenchBrowserAuthority } from "../../src/lib/local-runtime/workbench-browser-authority-support.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { createGrassEyeFileStorage } from "../../src/lib/storage/index.js";
import { HASH_A, HASH_B, identityFor, task } from "./agent-production-runtime-fixtures.js";

const continuationAuthority = (): WorkbenchBrowserAuthority => Object.assign(
  Object.create(null) as WorkbenchBrowserAuthority,
  {
    readExactCallMutationFact: () => null,
    countProviderTurnDispatches: () => 0,
    acquireJobBoundTargetLease: async () => { throw new Error("UNEXPECTED_CONTINUATION_BROWSER"); },
  },
);

const continuationExecution = (input: Readonly<{
  root: string;
  evidence: ForensicsPersistenceAbilityGroup;
  authority: WorkbenchBrowserAuthority;
  store: ProductionRuntimeStore;
  providerTask: WebsiteAgentTask;
  attemptId: string;
  leaseVersion: number;
}>): ProductGptExecution => new ProductionGptChildTools(
  input.root,
  HASH_A,
  createGptAbilityGroup(),
  input.evidence,
  input.authority,
  input.store,
  createRuntimeLogger({
    producer: "agent-continuation-rebuild",
    owner: "production-runtime",
    component: "gpt-child",
    terminalEnabled: false,
    fileSink: { directoryPath: path.join(input.root, "runtime-logs") },
  }),
).createExecution({
  task: input.providerTask,
  pluginId: "public-knowledge-article-pipeline",
  pluginVersion: 14,
  lease: {
    attempt_id: input.attemptId,
    device_id: "device:continuation-rebuild",
    lease_version: input.leaseVersion,
    execution_fence_hash: input.leaseVersion === 1 ? HASH_A : HASH_B,
    control_manifest_hash: HASH_A,
    max_provider_turns: 2,
    provider_turns_used: 0,
    expires_at_monotonic: performance.now() + 10_000,
    command_ttl_ms: 1_000,
    abort_signal: new AbortController().signal,
  },
  parentSpanId: `span:continuation-rebuild:${input.leaseVersion}`,
});

const submissionLocatorScenario = () => {
  const providerTask = task({
    jobId: "job:submission-locator-restart",
    productId: "public_knowledge_article_pipeline",
    actionId: "produce_article",
  });
  const attemptId = "attempt:submission-locator-restart";
  const promptHash = HASH_A;
  const turnMarker = "[GRASSEYE:submission-locator-restart]";
  const locatorCall = Object.freeze({
    sessionKey: "",
    productStepId: "corpus_research",
    callId: "submission-reconcile",
    child: "reconcile_gpt_turn_submission" as const,
    actionOrdinal: 13,
    input: Object.freeze({ expectedPromptHash: promptHash, timeoutMs: 60_000, turnMarker }),
  });
  const identity = Object.freeze({
    jobId: providerTask.job_id,
    attemptId,
    pluginId: "public-knowledge-article-pipeline",
    pluginVersion: 14,
    productStepId: locatorCall.productStepId,
    callId: locatorCall.callId,
    childCapabilityId: locatorCall.child,
    inputHash: hashCanonical(locatorCall.input),
  });
  const exactCallIdentityHash = gptExactCallIdentityHash(identity);
  const locatorUrl = "https://chatgpt.com/c/submission-locator-restart";
  const userTurnId = "conversation-turn-3";
  const conversationIdentityHash = `sha256:${createHash("sha256")
    .update(`${locatorUrl}\n${turnMarker}\n${userTurnId}\n${promptHash}`).digest("hex")}` as const;
  return { providerTask, attemptId, promptHash, turnMarker, locatorCall, identity,
    exactCallIdentityHash, locatorUrl, userTurnId, conversationIdentityHash };
};

type SubmissionScenario = ReturnType<typeof submissionLocatorScenario>;

const persistSubmissionLocator = async (
  evidence: ForensicsPersistenceAbilityGroup,
  scenario: SubmissionScenario,
): Promise<void> => {
  const timestamp = new Date().toISOString();
  const executionId = `gpt-call:${scenario.exactCallIdentityHash.slice(7)}`;
  await persistGptChildEvidence({
    intent: { ...scenario.identity, executionId, actionOrdinal: scenario.locatorCall.actionOrdinal,
      input: scenario.locatorCall.input },
    evidenceStore: evidence,
    jobId: scenario.providerTask.job_id,
    attemptId: scenario.attemptId,
    stepId: scenario.locatorCall.productStepId,
    exactCallIdentityHash: scenario.exactCallIdentityHash,
    result: {
      status: "success",
      failureCode: null,
      value: {
        canonicalConversationUrl: scenario.locatorUrl,
        turnMarker: scenario.turnMarker,
        userTurnId: scenario.userTurnId,
        promptHash: scenario.promptHash,
        conversationIdentityHash: scenario.conversationIdentityHash,
      },
      proof: {
        schemaVersion: "gpt-child-capability-proof.v2",
        ...scenario.identity,
        executionId,
        actionOrdinal: scenario.locatorCall.actionOrdinal,
        targetRefHash: HASH_A,
        beforeDocumentRefHash: HASH_A,
        afterDocumentRefHash: HASH_B,
        candidateCount: 1,
        observedSemantics: ["submission locator"],
        committedMutation: "no",
        postconditionResult: "passed",
        startedAt: timestamp,
        endedAt: timestamp,
        evidenceRef: "browser:submission-locator-restart",
        evidenceHash: HASH_B,
      },
    },
  });
};

const replaySubmissionLocator = async (input: Readonly<{
  root: string;
  evidence: ForensicsPersistenceAbilityGroup;
  store: ProductionRuntimeStore;
  scenario: SubmissionScenario;
}>): Promise<void> => {
  let browserAcquisitions = 0;
  let providerDispatchReads = 0;
  const authority = Object.assign(Object.create(null) as WorkbenchBrowserAuthority, {
    readExactCallMutationFact: () => null,
    countProviderTurnDispatches: () => { providerDispatchReads += 1; return 0; },
    acquireJobBoundTargetLease: async () => {
      browserAcquisitions += 1;
      throw new Error("UNEXPECTED_SUBMISSION_LOCATOR_BROWSER");
    },
  });
  const execution = continuationExecution({
    root: input.root, evidence: input.evidence, authority, store: input.store,
    providerTask: input.scenario.providerTask, attemptId: input.scenario.attemptId, leaseVersion: 2,
  });
  const replayed = await execution.tools.execute(input.scenario.locatorCall);
  assert.deepEqual(replayed.value, {
    canonicalConversationUrl: input.scenario.locatorUrl,
    turnMarker: input.scenario.turnMarker,
    userTurnId: input.scenario.userTurnId,
    promptHash: input.scenario.promptHash,
    conversationIdentityHash: input.scenario.conversationIdentityHash,
  });
  assert.equal(browserAcquisitions, 0, "restart replay must read the locator before Browser acquisition");
  assert.equal(providerDispatchReads, 0, "restart replay must not enter submit budget or mutation logic");
  await execution.settle(null);
};

const exerciseSubmissionLocatorRestart = async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "agent-submission-locator-restart-"));
  const scenario = submissionLocatorScenario();
  let store = new ProductionRuntimeStore(root);
  try {
    store.acceptTask(scenario.providerTask, identityFor(scenario.providerTask), scenario.attemptId);
    await persistSubmissionLocator(
      createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root)), scenario,
    );
    store.close();
    store = new ProductionRuntimeStore(root);
    await replaySubmissionLocator({
      root, store, scenario,
      evidence: createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root)),
    });
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
};

const continuationPersistCall = (providerTask: WebsiteAgentTask) => Object.freeze({
  sessionKey: "session:continuation-rebuild",
  productStepId: "corpus_research",
  callId: "continuation-persist",
  child: "persist_gpt_continuation" as const,
  actionOrdinal: 16,
  input: Object.freeze({
    jobId: providerTask.job_id,
    pluginId: "public-knowledge-article-pipeline",
    ownerRef: providerTask.business_identity.owner_ref,
    subjectRef: providerTask.business_identity.subject_ref,
    authorizationRef: providerTask.business_identity.authorization_ref,
    provider: Object.freeze({
      provider_page_url: "https://chatgpt.com/c/continuation-rebuild",
      prior_task_id: providerTask.job_id,
      prior_prompt_hash: HASH_A,
      prior_raw_output_hash: HASH_B,
      prior_turn_marker: "[GRASSEYE:continuation-rebuild]",
    }),
  }),
});

const exerciseContinuationRebuild = async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "agent-continuation-rebuild-"));
  const providerTask = task({
    jobId: "job:continuation-rebuild",
    productId: "public_knowledge_article_pipeline",
    actionId: "produce_article",
  });
  const attemptId = "attempt:continuation-rebuild";
  let store = new ProductionRuntimeStore(root);
  try {
    store.acceptTask(providerTask, identityFor(providerTask), attemptId);
    const evidence = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root));
    const authority = continuationAuthority();
    const execution = (leaseVersion: number) => continuationExecution({
      root, evidence, authority, store, providerTask, attemptId, leaseVersion,
    });
    const call = continuationPersistCall(providerTask);
    const first = execution(1);
    const persisted = await first.tools.execute(call);
    await first.settle(null);
    const continuationRef = Reflect.get(persisted.value ?? {}, "continuationRef");
    assert.equal(typeof continuationRef, "string");
    store.close();
    const database = new Database(path.join(root, "production-runtime.sqlite"));
    const deleted = database.prepare("delete from production_continuations where continuation_ref=?")
      .run(continuationRef);
    database.close();
    assert.equal(deleted.changes, 1);
    store = new ProductionRuntimeStore(root);
    const recovered = execution(2);
    const rebuilt = await recovered.tools.execute(call);
    await recovered.settle(null);
    assert.equal(Reflect.get(rebuilt.value ?? {}, "continuationRef"), continuationRef);
    assert.equal(store.readGptContinuation(continuationRef as string)?.provider.prior_prompt_hash, HASH_A,
      "exact persisted evidence must rebuild only the missing local continuation row");
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
};

await exerciseSubmissionLocatorRestart();
await exerciseContinuationRebuild();
