import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Project } from "ts-morph";

import {
  inspectAgentProductionRuntime,
} from "../audit/domains/agent-production-runtime/inspector.js";
import { runtimeManifestOwnershipDrift } from
  "../audit/domains/agent-production-runtime/contract-inspection.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { purgeDeletedJob, reconcileBusinessAdmission }
  from "../../src/lib/local-runtime/production/runtime-business-admission.js";
import { businessInFlightCount, claimReusesExistingBusinessSlot } from
  "../../src/lib/local-runtime/production/runtime-loops.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { readProductionOperationsSnapshot }
  from "../../src/lib/local-runtime/production/operations-snapshot.js";
import {
  HASH_A, HASH_B, admissionReceiptFor, attemptFailureFirstFact, claimTask, deviceStatusWithAdmission,
  deviceStatusWithoutAdmission, resultFor, task,
} from "./agent-production-runtime-fixtures.js";

const readRuntimeSource = (relativePath: string) => readFile(
  new URL(`../../src/lib/local-runtime/production/${relativePath}`, import.meta.url), "utf8",
);

const exerciseLifecycleMutant = (): void => {
  const project = new Project({ tsConfigFilePath: path.resolve("tsconfig.json") });
  const outbox = project.getSourceFileOrThrow(path.resolve(
    "src/lib/local-runtime/production/store-outbox.ts",
  ));
  outbox.replaceWithText(outbox.getFullText().replace(
    'executionFailure("failed", authority.lastError)',
    'executionFailure("failed", "PRODUCTION_OUTBOX_ATTEMPT_ENDED")',
  ));
  const findings: Parameters<typeof inspectAgentProductionRuntime>[1] = [];
  inspectAgentProductionRuntime({
    project,
    sealedRoot: path.resolve("."),
    selectedLawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V67",
    targetSet: { queryRef: "acceptance:runtime-lifecycle-mutant", count: 1 },
    targetPaths: [],
    lawRequirements: [],
    planEntry: {
      capabilityDomain: "agent-production-runtime",
      manifestPath: "scripts/audit/domains/agent-production-runtime/manifest.json",
      ownerInspectorPath: "scripts/audit/domains/agent-production-runtime/inspector.ts",
      executionGroup: "domain",
      lawIds: ["LAW-AGENT-PRODUCTION-RUNTIME-001-V67"],
    },
    generatedPlan: [],
  }, findings);
  assert.ok(findings.some((finding) =>
    finding.checkId === "agent-production-runtime/no-local-business-lifecycle-adjudication"),
  "an Outbox mutant that converts a delivery fact into attempt-ended must fail closed");
};

const exerciseManifestAndLawOwnership = async (): Promise<void> => {
  const runtimeManifest = JSON.parse(await readFile(
    new URL("../audit/domains/agent-production-runtime/manifest.json", import.meta.url), "utf8",
  )) as { ownedPaths: string[] };
  assert.deepEqual(runtimeManifestOwnershipDrift(runtimeManifest.ownedPaths), []);
  assert.deepEqual(runtimeManifestOwnershipDrift([
    ...runtimeManifest.ownedPaths,
    "src/mediator/agent-production-route.ts",
    "src/plugins/**",
  ]), ["src/mediator/agent-production-route.ts", "src/plugins/**"]);
  assert.deepEqual(runtimeManifestOwnershipDrift([
    "docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md",
    "docs/specs/agent-production-runtime/**",
    "scripts/acceptance/agent-production-runtime.acceptance.ts",
    "scripts/audit/domains/agent-production-runtime/**",
    "src/lib/local-runtime/production/**",
  ]), []);

  const runtimeLawSource = await readFile(
    new URL("../../.github/instructions/agent-rules/功能法案.md", import.meta.url), "utf8",
  );
  const runtimeLawRecords = [...runtimeLawSource.matchAll(/```law-record\n([\s\S]*?)\n```/gu)]
    .map((match) => JSON.parse(match[1]!) as { lawId: string; forbidden: string[] });
  const runtimeCoreLaw = runtimeLawRecords.find(
    (record) => record.lawId === "LAW-AGENT-PRODUCTION-RUNTIME-001-V67",
  );
  assert.ok(runtimeCoreLaw);
  for (const token of [
    "只有 Website.ai-acceptance",
    "新 attempt 任意读取旧 attempt",
    "第二 Outbox",
    "第二 state machine",
  ]) assert.ok(runtimeCoreLaw.forbidden.some((entry) => entry.includes(token)), token);
};

export const exerciseProductionRuntimeSourceBoundaries = async (): Promise<void> => {
  const [runtimeSource, runtimeStartupSource, businessAdmissionSource, runtimeLoopsSource,
    outboxSource, storeFoundationSource, reconciliationSource, executorSource, storeSource,
    workerSessionSource, cloudClientSource] =
    await Promise.all([
      readRuntimeSource("runtime-claim.ts"),
      readRuntimeSource("runtime-startup.ts"),
      readRuntimeSource("runtime-business-admission.ts"),
      readRuntimeSource("runtime-loops.ts"),
      readRuntimeSource("store-outbox.ts"),
      readRuntimeSource("store-foundation.ts"),
      readRuntimeSource("cloud-reconciliation-client.ts"),
      readRuntimeSource("executor.ts"),
      readRuntimeSource("store-task-state.ts"),
      readRuntimeSource("worker-session.ts"),
      readRuntimeSource("cloud-client.ts"),
    ]);
  assert.doesNotMatch(runtimeSource, /outcome: "failed"[\s\S]{0,300}BUSINESS_ADMISSION_PENDING/u);
  assert.doesNotMatch(runtimeLoopsSource, /outcome: "failed"[\s\S]{0,300}BUSINESS_ADMISSION_PENDING/u);
  assert.match(runtimeLoopsSource,
    /component: "production-admission-readback"[\s\S]{0,120}operation: "website\.v6-request"/u);
  assert.match(runtimeLoopsSource,
    /recoveryOnlyClaim = availableNewSlots <= 0 && hasExistingAttemptRecovery/u);
  assert.match(runtimeLoopsSource,
    /Math\.max\(1, availableNewSlots\), recoveryOnlyClaim/u);
  assert.match(workerSessionSource,
    /forceCurrentAttestation[\s\S]{0,180}\? await this\.performHeartbeat\(\)/u);
  assert.match(cloudClientSource,
    /requestClaim\(requestId, limit, forceCurrentAttestation\)/u);
  assert.doesNotMatch(runtimeLoopsSource,
    /operation: "website\.result-consume"[\s\S]{0,900}reconcileBusinessAdmission/u);
  assert.match(runtimeLoopsSource,
    /span\.terminal\(outcome === "completed"[\s\S]{0,260}: \{ outcome: "succeeded" \}\)/u);
  assert.doesNotMatch(runtimeSource, /emitState|stateKey:|currentStates|reconciledFromAuthority/u);
  assert.doesNotMatch(executorSource, /runTurn|ProductionGptExecutor|GPT_TURN_FLOW/u);
  assert.match(executorSource, /gpt: gptExecution\.tools/u);
  const executeClaimSource = runtimeSource.slice(runtimeSource.indexOf("export const executeClaim"));
  const executionFailureSource = runtimeSource.slice(
    runtimeSource.indexOf("const handleProductExecutionFailure"),
    runtimeSource.indexOf("export const executeClaim"),
  );
  assert.doesNotMatch(storeSource, /attempt_failure_json=null,current_reason='LEASE_REGRANTED'/u);
  assert.match(storeSource,
    /stageResultAfterProviderEffectReadback[\s\S]*?set attempt_failure_json=null,staged_result_json=\?/u);
  assert.doesNotMatch(executeClaimSource, /recoverAcceptedClaim|reconcileStaleFenceCheckpoint/u);
  const mismatchBranch = executionFailureSource.indexOf(
    'code === "BROWSER_GPT_DIALOG_UNRECOGNIZED"',
  );
  const persistFailure = executionFailureSource.indexOf("await persistAttemptFailure", mismatchBranch);
  assert.ok(mismatchBranch >= 0 && persistFailure > mismatchBranch);
  assert.match(executionFailureSource.slice(mismatchBranch, persistFailure),
    /setCurrentReason\(job\.job_id, "BROWSER_GPT_DIALOG_UNRECOGNIZED"\)[\s\S]*return;/u);
  assert.doesNotMatch(outboxSource, /recoverCheckpointPrefix|deliverReauthorizedStaleCheckpoint/u);
  assert.doesNotMatch(runtimeStartupSource, /PROCESS_RESTART_ATTEMPT_ENDED|endUnsentAttemptWrites/u);
  assert.doesNotMatch(runtimeSource, /ATTEMPT_ENDED:/u);
  assert.doesNotMatch(businessAdmissionSource, /discardStagedResult|ATTEMPT_ENDED/u);
  assert.doesNotMatch(storeSource, /discardStagedResult/u);
  assert.match(executorSource, /abort_signal\.aborted[\s\S]{0,220}PRODUCTION_EXECUTION_ABORTED/u);
  assert.doesNotMatch(executorSource, /reconcilePermanentCancellation/u);
  assert.doesNotMatch(storeSource, /Continuation|Checkpoint/u);
  assert.match(reconciliationSource, /V6_DEVICE_JOB_CONTROL_AUTHORITY_INVALID/u);
  assert.match(businessAdmissionSource, /websiteJobAbsent/u);
  assert.match(businessAdmissionSource, /purgeDeletedJob/u);
  assert.match(runtimeSource, /purgeDeletedJob/u);
  assert.doesNotMatch(runtimeLoopsSource, /BrowserQuarantine|reconcilePermanentlyRevokedTargetLocal/u);
  assert.doesNotMatch(runtimeLoopsSource, /flushOutbox|pendingOutbox\(\)|sendProductionOutboxWrite/u);
  assert.match(storeSource, /supersedeUnsentWritesForWebsiteAttempt/u);
  assert.match(storeSource, /WEBSITE_ATTEMPT_REPLACED/u);
  assert.doesNotMatch(`${storeSource}\n${outboxSource}`, /ATTEMPT_ENDED|PRODUCTION_OUTBOX_ATTEMPT_ENDED/u);
  assert.match(outboxSource, /executionFailure\("failed", authority\.lastError\)/u);
  exerciseLifecycleMutant();
  assert.match(storeSource, /purgeJob\(jobId: string\)/u);
  assert.match(storeSource, /delete from production_outbox/u);
  assert.match(outboxSource,
    /sent_at is null[\s\S]{0,120}last_error is null or kind='provider_cooldown'/u);
  assert.doesNotMatch(`${storeFoundationSource}\n${outboxSource}`,
    /next_delivery_at|nextDeliveryAt|pendingOutbox\(/u);
  await exerciseManifestAndLawOwnership();
};

const exerciseOperationsSnapshot = async (): Promise<void> => {
  const operationsTemporary = await mkdtemp(path.join(tmpdir(), "agent-operations-snapshot-"));
  try {
    const snapshot = await readProductionOperationsSnapshot({
      dataDir: operationsTemporary,
      session: {
        workerSessionId: "session:observation",
        async request() {
          return {
            schema_version: "xuanxue-ai-worker-observation.v6",
            observed_at: "2026-09-03T00:00:00.000Z",
            claim_exclusion_counts: [{ reason_code: "NO_UNFINISHED_V6_DEMAND", count: 1 }],
            nearest_retry_not_before: null,
            scope_total: 0,
            scope_truncated: false,
            jobs: [],
          };
        },
      } as never,
      store: {
        outboxAuthorities: () => [],
      } as never,
      browser: {
        hasBrowserMutationForJob: () => false,
        hasUnresolvedBrowserMutation: () => false,
      } as never,
      health: () => ({
        shellState: "ready", cloudState: "ready", browserState: "ready", executionState: "ready",
        claimAdmissionState: "eligible", logSinkState: "ready", browserAuthorityState: "present",
        browserTargetState: "absent", browserLaneState: "idle", controlContractVersion: 21,
        catalogHash: HASH_A, activeCount: 0, pendingOutboxCount: 0, lastSuccessfulHeartbeatAt: null,
        lastErrorCode: null, lastErrorReason: null, checkedAt: "2026-09-03T00:00:00.000Z",
      }),
      jobId: undefined,
    });
    assert.equal(snapshot.rows.find((entry) => entry.axis === "runtime_log_sink")?.current_value, "ready");
    assert.equal(snapshot.rows.some((entry) => ["agent_task", "lease_fence", "checkpoint"].includes(entry.axis)), false);
    assert.equal(snapshot.rows.find((entry) => entry.axis === "runtime_log_evidence")?.completeness,
      "SOURCE_UNAVAILABLE");
    assert.equal(snapshot.rows.find((entry) => entry.axis === "outbox")?.freshness.kind, "snapshot");
  } finally {
    await rm(operationsTemporary, { recursive: true, force: true });
  }
};

const exerciseWaitNewAndPrivacy = async (
  store: ProductionRuntimeStore, productionTask: ReturnType<typeof task>,
): Promise<void> => {
  const waitNew = task({ jobId: "job:admission:wait-new",
    productId: productionTask.product_id, actionId: productionTask.action_id,
    materialRefs: productionTask.material_refs,
    extra: { parameters: productionTask.parameters } });
  store.acceptTask(waitNew, "attempt:wait-new");
  store.stageResult(waitNew.job_id, resultFor(waitNew));
  let releasedWaitNewTarget = 0;
  let waitNewReleaseAuthority = "";
  assert.equal(await reconcileBusinessAdmission({
    store,
    session: deviceStatusWithoutAdmission(waitNew.job_id, false, "WAIT_NEW_ATTEMPT"),
    browserAuthority: { releaseJobBoundTarget: async (_jobId: string, authority: string) => {
      releasedWaitNewTarget += 1;
      waitNewReleaseAuthority = authority;
    } },
    abort: new AbortController(),
  } as never, store.readTask(waitNew.job_id)!), "pending");
  assert.equal(releasedWaitNewTarget, 1);
  assert.equal(waitNewReleaseAuthority, "wait-new-attempt",
    "ordinary WAIT_NEW_ATTEMPT must not acquire the permanent cleanup exception");
  assert.equal(store.readTask(waitNew.job_id)?.staged_result, null,
    "Website WAIT_NEW_ATTEMPT must release only the old local admission-pending attempt");
  assert.equal(store.readTask(waitNew.job_id)?.current_reason, "WAIT_NEW_ATTEMPT");
  assert.equal(store.unfinishedExecutionsWithoutReceipt()
    .some((candidate) => candidate.task.job_id === waitNew.job_id), true,
  "WAIT_NEW_ATTEMPT must retain status readback so a later Website deletion can trigger exact purge");
  const privacyClosed = task({ jobId: "job:admission:privacy-closed",
    productId: productionTask.product_id, actionId: productionTask.action_id,
    materialRefs: productionTask.material_refs,
    extra: { parameters: productionTask.parameters } });
  store.acceptTask(privacyClosed, "attempt:privacy-closed");
  store.stageResult(privacyClosed.job_id, resultFor(privacyClosed));
  let privacyReleaseAuthority = "";
  assert.equal(await reconcileBusinessAdmission({
    store,
    session: deviceStatusWithoutAdmission(
      privacyClosed.job_id, false, "WAIT_NEW_ATTEMPT", "PRIVACY_SUBJECT_CLOSED",
    ),
    browserAuthority: { releaseJobBoundTarget: async (_jobId: string, authority: string) => {
      privacyReleaseAuthority = authority;
    } },
    abort: new AbortController(),
  } as never, store.readTask(privacyClosed.job_id)!), "pending");
  assert.equal(privacyReleaseAuthority, "website-permanent-revocation",
    "only Website's persisted permanent privacy decision may acquire the revocation exception");
};

const exerciseAdmissionDeletion = async (
  store: ProductionRuntimeStore, admissionTemporary: string,
  productionTask: ReturnType<typeof task>, pending: ReturnType<typeof task>,
): Promise<void> => {
  assert.equal(await reconcileBusinessAdmission({
    store, session: deviceStatusWithoutAdmission(pending.job_id, true), activeAbort: new Map(),
  } as never, store.readTask(pending.job_id)!), "pending");
  assert.equal(store.readTask(pending.job_id)?.current_reason, "BUSINESS_ADMISSION_PENDING",
    "cancel_requested is not physical Website absence and cannot authorize local deletion");
  let browserPurges = 0, evidencePurges = 0, deletionReleaseAuthority = "";
  await purgeDeletedJob({ store, dataDir: admissionTemporary,
    abort: new AbortController(),
    browserAuthority: { releaseJobBoundTarget: async (_jobId: string, authority: string) => {
      deletionReleaseAuthority = authority;
    },
      purgeBrowserJob: () => { browserPurges += 1; } },
    evidenceStore: { deleteArtifactsForMission: async () => { evidencePurges += 1; } },
  } as never, pending.job_id);
  assert.equal(store.readTask(pending.job_id), null);
  assert.equal(browserPurges, 1);
  assert.equal(evidencePurges, 1);
  assert.equal(deletionReleaseAuthority, "website-admin-deletion",
    "Website 404 deletion must use the only exact admin-deletion release authority");
  assert.equal(store.pendingBusinessAdmissions().some((row) => row.task.job_id === pending.job_id), false,
    "physical Website absence must remove the existing task and stop admission polling");
  const retryable = task({ jobId: "job:admission:purge-retry",
    productId: productionTask.product_id, actionId: productionTask.action_id,
    materialRefs: productionTask.material_refs,
    extra: { parameters: productionTask.parameters } });
  store.acceptTask(retryable, "attempt:purge-retry");
  store.stageResult(retryable.job_id, resultFor(retryable));
  await assert.rejects(purgeDeletedJob({ store, dataDir: admissionTemporary,
    abort: new AbortController(),
    browserAuthority: { releaseJobBoundTarget: async () => undefined,
      purgeBrowserJob: () => undefined },
    evidenceStore: { deleteArtifactsForMission: async () => { throw new Error("FORENSICS_PURGE_FAILED"); } },
  } as never, retryable.job_id), /PRODUCTION_JOB_PURGE_FAILED/u);
  assert.notEqual(store.readTask(retryable.job_id), null,
    "a partial purge must retain the task authority so the same deletion can retry");
  await purgeDeletedJob({ store, dataDir: admissionTemporary,
    abort: new AbortController(),
    browserAuthority: { releaseJobBoundTarget: async () => undefined,
      purgeBrowserJob: () => undefined },
    evidenceStore: { deleteArtifactsForMission: async () => undefined },
  } as never, retryable.job_id);
  assert.equal(store.readTask(retryable.job_id), null);
};

export const exerciseOperationsAndBusinessAdmission = async (
  productionTask: ReturnType<typeof task>,
): Promise<void> => {
  await exerciseOperationsSnapshot();

  const admissionTemporary = await mkdtemp(path.join(tmpdir(), "agent-business-admission-"));
  try {
    const store = new ProductionRuntimeStore(admissionTemporary);
    for (const kind of ["base", "bazi", "review"] as const) {
      const accepted = task({ jobId: `job:admission:${kind}`,
        productId: productionTask.product_id, actionId: productionTask.action_id,
        materialRefs: productionTask.material_refs,
        extra: { parameters: productionTask.parameters } });
      const staged = resultFor(accepted);
      store.acceptTask(accepted, `attempt:${kind}`);
      store.stageResult(accepted.job_id, staged);
      const typedReceipt = admissionReceiptFor(accepted.job_id, staged.result_payload_hash,
        kind === "bazi" ? {
          bazi_domain_admission_receipt_hash: HASH_A,
          delivery_manifest_id: "delivery-manifest:1",
          delivery_manifest_hash: HASH_B,
        } : kind === "review" ? { review_receipt_hash: HASH_A } : {});
      assert.equal(await reconcileBusinessAdmission({
        store,
        session: deviceStatusWithAdmission(typedReceipt, accepted.job_id, hashCanonical(staged)),
        browserAuthority: { releaseJobBoundTarget: async () => undefined },
        abort: new AbortController(),
      } as never, store.readTask(accepted.job_id)!), "completed");
      assert.equal(store.readTask(accepted.job_id)?.status, "completed");
    }
    const pending = task({ jobId: "job:admission:pending",
      productId: productionTask.product_id, actionId: productionTask.action_id,
      materialRefs: productionTask.material_refs,
      extra: { parameters: productionTask.parameters } });
    const pendingResult = resultFor(pending);
    store.acceptTask(pending, "attempt:pending");
    store.stageResult(pending.job_id, pendingResult);
    assert.equal(await reconcileBusinessAdmission({
      store, session: deviceStatusWithoutAdmission(pending.job_id),
    } as never, store.readTask(pending.job_id)!), "pending");
    assert.deepEqual(store.readTask(pending.job_id)?.staged_result, pendingResult,
      "absence of Website admission must preserve the staged result and await Website authority");
    assert.equal(store.readTask(pending.job_id)?.current_reason, "BUSINESS_ADMISSION_PENDING");
    assert.equal(businessInFlightCount({ active: new Map(), store } as never), 1,
      "an admission-pending job must retain the only business slot after execution settles");
    assert.equal(businessInFlightCount({ active: new Map([[pending.job_id, Promise.resolve()]]), store } as never), 1,
      "active and admission-pending views of the same job must count once");
    const failureFact = (jobId: string, attemptId: string, overrides: Record<string, unknown>) =>
      attemptFailureFirstFact(attemptId, {
        code: "BROWSER_ATTEMPT_FAILED", mutation_outcome: "confirmed",
        evidence_ref: `browser-fact:${jobId}`, effect_scope: "provider_effect",
        child_capability_id: "submit_exact_gpt_turn_once", browser_outcome: "CONFIRMED",
        provider_effect_identity_hash: HASH_A, settled_result_payload_hash: null,
        stopped_empty_proof: null, child_proof_ref: null, child_proof_hash: null,
        evidence_hash: HASH_B, cause: null, ...overrides,
      } as never);
    const readback = task({ jobId: "job:capacity:provider-readback",
      productId: productionTask.product_id, actionId: productionTask.action_id,
      materialRefs: productionTask.material_refs, extra: { parameters: productionTask.parameters } });
    store.acceptTask(readback, "attempt:provider-readback");
    store.recordAttemptFailure(readback.job_id, "attempt:provider-readback",
      failureFact(readback.job_id, "attempt:provider-readback", {}));
    assert.equal(businessInFlightCount({ active: new Map(), store } as never), 2,
      "a durable same-attempt provider readback must retain its existing business slot");
    assert.equal(businessInFlightCount({ active: new Map([[readback.job_id, Promise.resolve()]]), store } as never), 2,
      "a regranted readback execution must reuse the existing slot instead of adding another");
    const readbackClaim = claimTask(readback);
    assert.equal(claimReusesExistingBusinessSlot({ active: new Map(), store } as never, {
      ...readbackClaim, grant: { ...readbackClaim.grant, attempt_id: "attempt:different" },
    }), false, "a provider readback slot must reject a grant for a different attempt");
    const unclassified = task({ jobId: "job:capacity:unclassified-failure",
      productId: productionTask.product_id, actionId: productionTask.action_id,
      materialRefs: productionTask.material_refs, extra: { parameters: productionTask.parameters } });
    store.acceptTask(unclassified, "attempt:unclassified");
    store.recordAttemptFailure(unclassified.job_id, "attempt:unclassified",
      failureFact(unclassified.job_id, "attempt:unclassified", {
        effect_scope: "target_local", browser_outcome: "DISPATCHED",
        provider_effect_identity_hash: null, mutation_outcome: "dispatched",
      }));
    assert.equal(businessInFlightCount({ active: new Map(), store } as never), 3,
      "a fail-closed accepted attempt must remain in the attested business denominator");
    const runtimeLoopsSource = await readRuntimeSource("runtime-loops.ts");
    assert.match(runtimeLoopsSource,
      /availableNewSlots > 0 \|\| hasExistingAttemptRecovery/u,
      "a full business denominator must still permit an existing readback or cooldown attempt to request regrant");
    assert.match(runtimeLoopsSource,
      /requestClaimBatch\([\s\S]{0,80}Math\.max\(1, availableNewSlots\), recoveryOnlyClaim/u,
      "the existing V6 wire minimum must be preserved while attestation keeps new grant capacity at zero");
    assert.match(runtimeLoopsSource,
      /businessInFlightJobIds\(state\)\.has\(job\.job_id\)[\s\S]*!claimReusesExistingBusinessSlot\(state, job\)/u,
      "only an exact readback or paused cooldown regrant may reuse an occupied slot");
    await exerciseWaitNewAndPrivacy(store, productionTask);
    await exerciseAdmissionDeletion(store, admissionTemporary, productionTask, pending);
    store.close();
  } finally {
    await rm(admissionTemporary, { recursive: true, force: true });
  }

};
