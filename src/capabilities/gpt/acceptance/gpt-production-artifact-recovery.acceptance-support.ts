import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { createForensicsPersistenceAbilityGroupFromStorage } from
  "../../forensics-persistence/index.js";
import { createGrassEyeFileStorage } from "../../../lib/storage/index.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { failureCode } from "../../../lib/execution-failure.js";
import { createGptAbilityGroup } from "../index.js";
import { gptCanonicalHash, gptExactCallIdentityHash } from "../contract.js";
import { ProductionGptChildTools } from "../production-child-tools.js";
import { exactAssistantTurnReply } from "./gpt-exact-target-browser-fixture.js";
import type { BrowserDomIntent } from "../../../lib/browser/browser-authority-api.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const HASH_A = `sha256:${"a".repeat(64)}` as const;
const HASH_B = `sha256:${"b".repeat(64)}` as const;
const jobId = "job:artifact-recovery";
const attemptId = "attempt:artifact-recovery";
const sessionKey = "session:artifact-recovery";
const conversationUrl = "https://chatgpt.com/c/artifact-recovery";
const checkpointInput = { canonicalConversationUrl: conversationUrl, probeBudgetMs: 5_000,
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

const temporary = await mkdtemp(join(tmpdir(), "gpt-artifact-recovery-"));
try {
  const evidenceStore = createForensicsPersistenceAbilityGroupFromStorage(
    createGrassEyeFileStorage(temporary),
  );
  const appended = await evidenceStore.appendArtifact({ missionId: jobId, runId: attemptId,
    artifactType: "ai_raw_output", mimeType: "application/json", content: persistedContent,
    idempotencyKey: `gpt-call-artifact:v1:${checkpointExactCallIdentityHash}:observed-response` });
  if (appended.status !== "success") throw new Error(appended.failureReason);

  let checkpointBrowserReads = 0;
  let checkpointPageObservations = 0;
  let exactConversationSelections = 0;
  const submitOutcome = { state: "confirmed", mutationOutcome: "confirmed",
    providerEffectIdentityHash: HASH_A, terminalAt: "2026-09-13T00:00:00.000Z",
    failureCode: null, nativeFailureCode: null, authorityRef: "browser-mutation:submit",
    authorityHash: HASH_B, targetRef: "target:recovery", documentRef: "document:recovery",
    physicalInputCount: 0, downloadGuidHash: null, downloadCompleted: false,
    identityRevalidated: true, terminalPayload: { canonicalConversationUrl: conversationUrl,
      promptHash: HASH_A, userTurnId: "conversation-turn-1", exactCallIdentityHash: HASH_A,
      observationRevisionHash: HASH_A, targetRefHash: HASH_A, documentRefHash: HASH_A,
      rawCount: 1, eligibleCount: 1 } } as const;
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
    pendingMutationCount: () => 0,
    park: async () => undefined,
  };
  const authority = { readExactCallMutationFact: (input: Readonly<{ exactCallIdentityHash: `sha256:${string}` }>) => ({
    effectScope: "provider_effect", providerEffectIdentityHash: HASH_A, outcome: "CONFIRMED",
    mutationOutcome: "confirmed", terminalAt: submitOutcome.terminalAt, failureCode: null,
    nativeFailureCode: null, authorityRef: submitOutcome.authorityRef, authorityHash: HASH_B,
    targetRef: submitOutcome.targetRef, documentRef: submitOutcome.documentRef,
    productStepId: "research", callId: "turn-submit", childCapabilityId: "submit_exact_gpt_turn_once",
    actionOrdinal: 1, physicalInputCount: 0, downloadGuidHash: null, downloadCompleted: false,
    identityRevalidated: true, exactCallIdentityHash: input.exactCallIdentityHash }),
    countProviderTurnDispatches: () => 0,
    acquireJobBoundTargetLease: async () => browser };
  const execution = new ProductionGptChildTools(temporary, HASH_A, createGptAbilityGroup(),
    evidenceStore, authority as never, createRuntimeLogger({ producer: "gpt-artifact-recovery",
      owner: "production-runtime", component: "gpt-child", terminalEnabled: false,
      fileSink: { directoryPath: join(temporary, "runtime-logs") } })).createExecution({ jobId,
    attemptId, resultRevision: 0, ownerRef: "owner:1", subjectRef: "subject:1",
    authorizationRef: "authorization:1", deviceId: "device:1", leaseVersion: 1,
    executionFenceHash: HASH_A, capabilityManifestHash: HASH_B,
    expiresAtMonotonic: performance.now() + 10_000, commandTtlMs: 1_000,
    abortSignal: new AbortController().signal, parentSpanId: "parent", maxProviderTurns: 1 });
  const recoveredSubmit = await execution.tools.readConfirmedSubmit({ sessionKey,
    productStepId: "research", callId: "turn-submit", child: "submit_exact_gpt_turn_once",
    actionOrdinal: 1, input: { files: [], promptHash: HASH_A } });
  assert.equal(recoveredSubmit?.value.userTurnId, "conversation-turn-1");
  const recovered = await execution.tools.execute(checkpointCall);
  assert.equal(recovered.value.semanticText, semanticText);
  assert.equal(recovered.artifactRefs[0], appended.artifactRef);
  assert.deepEqual([exactConversationSelections, checkpointBrowserReads, checkpointPageObservations], [1, 0, 0],
    "valid persisted checkpoint must add zero Browser page observations");

  const missing = await execution.tools.execute({ ...checkpointCall,
    callId: "text-checkpoint-missing", actionOrdinal: 3 });
  assert.equal(missing.value.semanticText, "first observed response");
  assert.notEqual(missing.artifactRefs[0], appended.artifactRef);
  assert.deepEqual([checkpointBrowserReads, checkpointPageObservations], [1, 1],
    "missing checkpoint artifact must perform one first Browser observation and append it");
  const indexPath = join(temporary, "forensics", "artifacts.ndjson");
  const artifactCountBeforeCorruption = (await readFile(indexPath, "utf8")).trim().split("\n").length;
  const artifactPath = join(temporary, "forensics", "artifacts", `${appended.artifactRef}.bin`);
  await writeFile(artifactPath, Buffer.from("corrupt", "utf8"));
  await assert.rejects(execution.tools.execute(checkpointCall), (error: unknown) =>
    failureCode(error) === "EVIDENCE_ARTIFACT_READBACK_FAILED");
  assert.equal(checkpointPageObservations, 1, "corrupt persisted checkpoint must fail before Browser observation");
  assert.equal((await readFile(indexPath, "utf8")).trim().split("\n").length,
    artifactCountBeforeCorruption, "recovery must not append an overwrite artifact");
  await execution.settle(null);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
