import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createGptAbilityGroup, gptExactCallIdentityHash } from "../../src/capabilities/gpt/index.js";
import {
  createForensicsPersistenceAbilityGroupFromStorage,
  type ForensicsPersistenceAbilityGroup,
} from "../../src/capabilities/forensics-persistence/index.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import {
  ProductionGptChildTools,
  type ProductGptExecution,
} from "../../src/lib/local-runtime/production/production-gpt-child-tools.js";
import { persistGptChildEvidence } from "../../src/lib/local-runtime/production/gpt-evidence-writer.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import type { WorkbenchBrowserAuthority } from "../../src/lib/local-runtime/workbench-browser-authority-support.js";
import { createRuntimeLogger, type RuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { createGrassEyeFileStorage } from "../../src/lib/storage/index.js";
import { typedExecutionFailure } from "../../src/lib/typed-failure.js";
import { HASH_A, HASH_B, identityFor, task } from "./agent-production-runtime-fixtures.js";

const digest = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const semanticText = '{"schema_version":"public-knowledge-research-output.v3"}';
const rawDomHtml = `<div>${semanticText}</div>`;
const providerTask = task({
  jobId: "job:artifact-readback-terminal",
  productId: "public_knowledge_article_pipeline",
  actionId: "produce_article",
});
const attemptId = "attempt:artifact-readback-terminal";
const checkpointCall = Object.freeze({
  sessionKey: "session:artifact-readback-terminal",
  productStepId: "corpus_research",
  callId: "response-checkpoint",
  child: "checkpoint_gpt_text_response" as const,
  actionOrdinal: 15,
  input: Object.freeze({
    assistantTurnId: "conversation-turn-2",
    canonicalConversationUrl: "https://chatgpt.com/c/artifact-readback-terminal",
    expectedPromptHash: HASH_A,
    expectedResponseHash: digest(semanticText),
    turnMarker: "[GRASSEYE:artifact-readback-terminal]",
  }),
});
const identity = Object.freeze({
  jobId: providerTask.job_id,
  attemptId,
  pluginId: "public-knowledge-article-pipeline",
  pluginVersion: 15,
  productStepId: checkpointCall.productStepId,
  callId: checkpointCall.callId,
  childCapabilityId: checkpointCall.child,
  inputHash: hashCanonical(checkpointCall.input),
});

const persistCheckpointArtifact = async (
  evidenceStore: ForensicsPersistenceAbilityGroup,
): Promise<void> => {
  const exactCallIdentityHash = gptExactCallIdentityHash(identity);
  const executionId = `gpt-call:${exactCallIdentityHash.slice(7)}`;
  const timestamp = new Date().toISOString();
  await persistGptChildEvidence({
    intent: { ...identity, executionId, actionOrdinal: checkpointCall.actionOrdinal, input: checkpointCall.input },
    evidenceStore,
    jobId: providerTask.job_id,
    attemptId,
    stepId: checkpointCall.productStepId,
    exactCallIdentityHash,
    result: {
      status: "success",
      failureCode: null,
      value: {
        assistantTurnId: "conversation-turn-2",
        rawDomHtml,
        rawDomHash: digest(rawDomHtml),
        semanticText,
        semanticTextHash: digest(semanticText),
      },
      proof: {
        schemaVersion: "gpt-child-capability-proof.v2",
        ...identity,
        executionId,
        actionOrdinal: checkpointCall.actionOrdinal,
        targetRefHash: HASH_A,
        beforeDocumentRefHash: HASH_A,
        afterDocumentRefHash: HASH_B,
        candidateCount: 1,
        observedSemantics: ["artifact readback terminal"],
        committedMutation: "no",
        postconditionResult: "passed",
        startedAt: timestamp,
        endedAt: timestamp,
        evidenceRef: "browser:artifact-readback-terminal",
        evidenceHash: HASH_B,
      },
    },
  });
};

const artifactReadbackExecution = (input: Readonly<{
  root: string;
  evidenceStore: ForensicsPersistenceAbilityGroup;
  store: ProductionRuntimeStore;
  runtimeLogger: RuntimeLogger;
}>): ProductGptExecution => {
  const failingEvidence: ForensicsPersistenceAbilityGroup = {
    ...input.evidenceStore,
    readArtifactRef: async () => ({ status: "failed", failureReason: "forced-readback-failure" }),
  };
  const authority = Object.assign(Object.create(null) as WorkbenchBrowserAuthority, {
    readExactCallMutationFact: () => null,
    countProviderTurnDispatches: () => 0,
    acquireJobBoundTargetLease: async () => { throw new Error("UNEXPECTED_ARTIFACT_BROWSER"); },
  });
  return new ProductionGptChildTools(
    input.root, HASH_A, createGptAbilityGroup(), failingEvidence, authority, input.store, input.runtimeLogger,
  ).createExecution({
    task: providerTask,
    pluginId: "public-knowledge-article-pipeline",
    pluginVersion: 15,
    lease: {
      attempt_id: attemptId,
      device_id: "device:artifact-readback-terminal",
      lease_version: 1,
      execution_fence_hash: HASH_A,
      control_manifest_hash: HASH_A,
      max_provider_turns: 2,
      provider_turns_used: 0,
      expires_at_monotonic: performance.now() + 10_000,
      command_ttl_ms: 1_000,
      abort_signal: new AbortController().signal,
    },
    parentSpanId: "span:artifact-readback-terminal",
  });
};

const assertOneTerminal = async (runtimeLogger: RuntimeLogger): Promise<void> => {
  const events = (await readFile(runtimeLogger.currentSegmentPath()!, "utf8")).trim().split("\n")
    .map((line) => JSON.parse(line) as Readonly<Record<string, unknown>>)
    .filter((event) => event.operation === "gpt.child" && event.traceId === providerTask.job_id);
  const started = events.filter((event) => event.kind === "span.started");
  const terminals = events.filter((event) => event.kind === "span.terminal");
  assert.equal(started.length, 1);
  assert.equal(terminals.length, 1, "Artifact readback failure must terminalize the started GPT Child span");
  assert.equal(terminals[0]?.spanId, started[0]?.spanId);
};

const root = await mkdtemp(path.join(tmpdir(), "agent-artifact-readback-terminal-"));
const store = new ProductionRuntimeStore(root);
try {
  store.acceptTask(providerTask, identityFor(providerTask), attemptId);
  const evidenceStore = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root));
  await persistCheckpointArtifact(evidenceStore);
  const runtimeLogger = createRuntimeLogger({
    producer: "agent-artifact-readback-terminal",
    owner: "production-runtime",
    component: "gpt-child",
    terminalEnabled: false,
    fileSink: { directoryPath: path.join(root, "runtime-logs") },
  });
  const execution = artifactReadbackExecution({ root, evidenceStore, store, runtimeLogger });
  let observed: unknown = null;
  try { await execution.tools.execute(checkpointCall); } catch (error) { observed = error; }
  assert.equal(typedExecutionFailure(observed)?.code, "GPT_TEXT_TASK_ARTIFACT_READBACK_FAILED");
  await assertOneTerminal(runtimeLogger);
  await execution.settle(observed);
} finally {
  store.close();
  await rm(root, { recursive: true, force: true });
}
