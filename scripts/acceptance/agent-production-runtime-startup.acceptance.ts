import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import { createGptAbilityGroup } from "../../src/capabilities/gpt/index.js";
import { createForensicsPersistenceAbilityGroupFromStorage } from "../../src/capabilities/forensics-persistence/index.js";
import { ProductionExecutor } from "../../src/lib/local-runtime/production/executor.js";
import {
  productionCredentialPath,
  readProductionCredential,
} from "../../src/lib/local-runtime/production/credential.js";
import { terminalSpanFailure } from "../../src/lib/local-runtime/production/runtime-logging.js";
import { startProductionRuntime } from "../../src/lib/local-runtime/production/runtime.js";
import { reconcileTaskRecord } from "../../src/lib/local-runtime/production/runtime-startup.js";
import {
  productionRuntimeTaskRoot,
  productionRuntimeTaskPath,
  readProductionRuntimeStorageInventory,
} from "../../src/lib/local-runtime/production/runtime-storage-inventory.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { DeviceCredentialSchema } from "../../src/lib/local-runtime/production/transport-protocol.js";
import {
  RuntimeFailureImpact,
  createRuntimeLogger,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  withRuntimeLogCause,
  type RuntimeSpanHandle,
} from "../../src/lib/runtime-logs/index.js";
import { createGrassEyeFileStorage } from "../../src/lib/storage/index.js";
import { executionFailure, typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { runtimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
import { verifyProductionDependency } from "../startup/lib/production-contract-preflight.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { HASH_A, HASH_B, task } from "./agent-production-runtime-fixtures.js";
import "./agent-production-runtime-recovery-contract.acceptance.js";
import "./agent-production-runtime-recovery-resume.acceptance.js";

const validDeviceCredential = {
  protocol_version: "xuanxue-ai-production-v6",
  server_base_url: "http://127.0.0.1:4322",
  environment_id: "production",
  origin: "http://127.0.0.1:4173",
  device_id: "device:projection-owner-test",
  device_epoch: 7,
  control_manifest_hash: HASH_A,
  credential: `aidc_v6_${"a".repeat(32)}`,
  enrolled_at: new Date().toISOString(),
} as const;

const projectionTemporary = await mkdtemp(path.join(tmpdir(), "agent-production-dependency-"));
try {
  const dependency = JSON.parse(await readFile(new URL(
    "../../docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json",
    import.meta.url,
  ), "utf8")) as Record<string, unknown>;
  const dependencyPath = path.join(projectionTemporary, "dependency.json");
  await writeFile(dependencyPath, JSON.stringify(dependency), { mode: 0o600 });
  assert.deepEqual(await verifyProductionDependency({
    agentDependencyPath: dependencyPath,
  }), { status: "READY", version: 15 });

  const contract = dependency.contract as Record<string, unknown>;
  await writeFile(dependencyPath, JSON.stringify({
    ...dependency,
    contract: { ...contract, manifestHash: HASH_A },
  }), { mode: 0o600 });
  await assert.rejects(
    verifyProductionDependency({ agentDependencyPath: dependencyPath }),
    /AI_PRODUCTION_DEPENDENCY_INVALID/u,
  );

  assert.equal(DeviceCredentialSchema.parse(validDeviceCredential).device_epoch, 7);
  const { control_manifest_hash: _manifestHash, ...missingManifest } = validDeviceCredential;
  assert.throws(() => DeviceCredentialSchema.parse({
    ...missingManifest,
  }));
} finally {
  await rm(projectionTemporary, { recursive: true, force: true });
}

const credentialTemporary = await mkdtemp(path.join(tmpdir(), "agent-production-credential-"));
const expectCredentialCode = async (dataDir: string, code: string): Promise<void> => {
  await assert.rejects(readProductionCredential(dataDir),
    (error: unknown) => typedExecutionFailure(error)?.code === code);
};
const writeCredential = async (
  dataDir: string,
  value: unknown,
  mode = 0o600,
): Promise<string> => {
  const destination = productionCredentialPath(dataDir);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(destination), 0o700);
  await writeFile(destination, typeof value === "string" ? value : JSON.stringify(value), { mode });
  await chmod(destination, mode);
  return destination;
};
try {
  await expectCredentialCode(path.join(credentialTemporary, "missing-parent"),
    "PRODUCTION_CREDENTIAL_PARENT_MISSING");
  const missingFile = path.join(credentialTemporary, "missing-file");
  await mkdir(path.dirname(productionCredentialPath(missingFile)), { recursive: true, mode: 0o700 });
  await expectCredentialCode(missingFile, "PRODUCTION_CREDENTIAL_MISSING");

  const malformed = path.join(credentialTemporary, "malformed");
  await writeCredential(malformed, "{");
  await expectCredentialCode(malformed, "PRODUCTION_CREDENTIAL_JSON_INVALID");

  const missingManifest = path.join(credentialTemporary, "missing-manifest");
  const { control_manifest_hash: _controlManifestHash, ...withoutManifest } = validDeviceCredential;
  await writeCredential(missingManifest, withoutManifest);
  await expectCredentialCode(missingManifest, "PRODUCTION_CREDENTIAL_CONTROL_MANIFEST_MISSING");

  const invalidOrigin = path.join(credentialTemporary, "invalid-origin");
  await writeCredential(invalidOrigin, { ...validDeviceCredential, origin: "ftp://example.com" });
  await expectCredentialCode(invalidOrigin, "PRODUCTION_CREDENTIAL_ORIGIN_INVALID");

  const permissiveFile = path.join(credentialTemporary, "permissive-file");
  await writeCredential(permissiveFile, validDeviceCredential, 0o644);
  await expectCredentialCode(permissiveFile, "PRODUCTION_CREDENTIAL_FILE_PERMISSIONS_INVALID");

  const permissiveParent = path.join(credentialTemporary, "permissive-parent");
  const permissiveParentFile = await writeCredential(permissiveParent, validDeviceCredential);
  await chmod(path.dirname(permissiveParentFile), 0o755);
  await expectCredentialCode(permissiveParent, "PRODUCTION_CREDENTIAL_PARENT_PERMISSIONS_INVALID");

  const linked = path.join(credentialTemporary, "linked");
  const linkedDestination = productionCredentialPath(linked);
  await mkdir(path.dirname(linkedDestination), { recursive: true, mode: 0o700 });
  const linkTarget = path.join(credentialTemporary, "credential-target.json");
  await writeFile(linkTarget, JSON.stringify(validDeviceCredential), { mode: 0o600 });
  await symlink(linkTarget, linkedDestination);
  await expectCredentialCode(linked, "PRODUCTION_CREDENTIAL_SYMLINK_INVALID");

  const valid = path.join(credentialTemporary, "valid");
  await writeCredential(valid, validDeviceCredential);
  assert.deepEqual(await readProductionCredential(valid), validDeviceCredential);
} finally {
  await rm(credentialTemporary, { recursive: true, force: true });
}

const inventoryTemporary = await mkdtemp(path.join(tmpdir(), "agent-production-storage-inventory-"));
const responsibilities = (taskIds: readonly string[]) => ({
  task_ids: taskIds, outbox_responsibility_count: 0, pending_outbox_count: 0,
  continuation_count: 0, active_lease_count: 0,
});
try {
  const empty = await readProductionRuntimeStorageInventory(
    path.join(inventoryTemporary, "empty"), responsibilities([]),
  );
  assert.deepEqual({
    directory_count: empty.directory_count,
    owned_directory_count: empty.owned_directory_count,
    orphan_directory_count: empty.orphan_directory_count,
    orphan_bytes: empty.orphan_bytes,
    orphan_job_ids: empty.orphan_job_ids,
  }, { directory_count: 0, owned_directory_count: 0, orphan_directory_count: 0,
    orphan_bytes: 0, orphan_job_ids: [] });
  for (const invalidJobId of ["..", "nested/job", "nested\\job", "\0"] as const) {
    assert.throws(() => productionRuntimeTaskPath(inventoryTemporary, invalidJobId),
      (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_STORAGE_JOB_ID_INVALID");
  }

  const dataDir = path.join(inventoryTemporary, "with-directories");
  const root = productionRuntimeTaskRoot(dataDir);
  await mkdir(path.join(root, "job:owned", "materials"), { recursive: true });
  await mkdir(path.join(root, "job:orphan", "materials"), { recursive: true });
  await writeFile(path.join(root, "job:owned", "materials", "owned.txt"), "owned");
  await writeFile(path.join(root, "job:orphan", "materials", "orphan.txt"), "orphan");
  const inventory = await readProductionRuntimeStorageInventory(dataDir, responsibilities(["job:owned"]));
  assert.equal(inventory.directory_count, 2);
  assert.equal(inventory.owned_directory_count, 1);
  assert.equal(inventory.orphan_directory_count, 1);
  assert.deepEqual(inventory.orphan_job_ids, ["job:orphan"]);
  assert.ok(inventory.orphan_bytes >= Buffer.byteLength("orphan"));

  const blockedByInventory = await startProductionRuntime({
    dataDir,
    sourceHash: HASH_A,
    gpt: createGptAbilityGroup(),
    evidenceStore: createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(dataDir)),
    browserAuthority: { readProductionRuntimeState: () => ({
      browserAuthorityState: "absent" as const, browserTargetState: "absent" as const,
    }) } as never,
    runtimeLogger: createRuntimeLogger({
      producer: "agent-storage-inventory", owner: "production-runtime", component: "storage-inventory",
      terminalEnabled: false, fileSink: { directoryPath: path.join(inventoryTemporary, "runtime-logs") },
    }),
  });
  assert.equal(blockedByInventory.readHealth().lastErrorCode,
    "PRODUCTION_ORPHAN_STORAGE_RECONCILIATION_REQUIRED");
  await blockedByInventory.close();

  const linkedFile = path.join(inventoryTemporary, "linked-material.txt");
  await writeFile(linkedFile, "linked");
  await symlink(linkedFile, path.join(root, "job:owned", "materials", "linked.txt"));
  await assert.rejects(readProductionRuntimeStorageInventory(
    dataDir, responsibilities(["job:owned", "job:orphan"]),
  ),
    (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_STORAGE_SYMLINK_INVALID");
} finally {
  await rm(inventoryTemporary, { recursive: true, force: true });
}

const firstCheckpointCrashTemporary = await mkdtemp(
  path.join(tmpdir(), "agent-production-first-checkpoint-crash-"),
);
try {
  const store = new ProductionRuntimeStore(firstCheckpointCrashTemporary);
  const acceptedTask = task({
    jobId: "job:first-checkpoint-crash", productId: "bazi_ai_full_analysis", actionId: "produce",
  });
  store.acceptTask(acceptedTask, {
    catalog_hash: HASH_A, plugin_id: "bazi-ai-full-analysis", plugin_version: 1,
    skill_hash: HASH_B, checkpoint_schema_version: 1, request_hash: acceptedTask.request_hash,
  }, "attempt:first-checkpoint-crash");
  assert.equal(reconcileTaskRecord({ store } as never, store.readTask(acceptedTask.job_id)!), true,
    "a durable accept before the first checkpoint must remain task-locally recoverable");
  store.markExecuting(acceptedTask.job_id);
  assert.equal(reconcileTaskRecord({ store } as never, store.readTask(acceptedTask.job_id)!), false,
    "a missing execution checkpoint outside the accept crash window must block reconciliation");
  store.close();
} finally {
  await rm(firstCheckpointCrashTemporary, { recursive: true, force: true });
}

const temporary = await mkdtemp(path.join(tmpdir(), "agent-production-startup-"));
const previousCredentialPath = process.env.AGENT_PRODUCTION_CREDENTIAL_FILE;
process.env.AGENT_PRODUCTION_CREDENTIAL_FILE = path.join(temporary, "missing-credential.json");
try {
  const browserAuthority = {
    readProductionRuntimeState: () => ({
      browserAuthorityState: "absent" as const,
      browserTargetState: "absent" as const,
    }),
  };
  const corruptDataDirectory = path.join(temporary, "corrupt-continuation");
  await mkdir(corruptDataDirectory, { recursive: true });
  const corruptStore = new ProductionRuntimeStore(corruptDataDirectory);
  const corruptTask = task({
    jobId: "job:corrupt-continuation", productId: "bazi_ai_full_analysis", actionId: "produce",
  });
  corruptStore.acceptTask(corruptTask, {
    catalog_hash: HASH_A, plugin_id: "bazi-ai-full-analysis", plugin_version: 1,
    skill_hash: HASH_B, checkpoint_schema_version: 1, request_hash: corruptTask.request_hash,
  }, "attempt:corrupt-continuation");
  corruptStore.close();
  const corruptDatabase = new Database(path.join(corruptDataDirectory, "production-runtime.sqlite"));
  corruptDatabase.prepare(`insert into production_continuations(
    continuation_ref,reservation_kind,reservation_identity_hash,origin_job_id,origin_plugin_version,
    plugin_id,owner_ref,subject_ref,authorization_ref,frontier_ref,lane_version,created_at
  ) values(?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    "continuation:corrupt", "persisted", HASH_B, corruptTask.job_id, 1,
    "bazi-ai-full-analysis", "owner:1", "subject:1", "authorization:1", HASH_B, 1,
    new Date().toISOString(),
  );
  corruptDatabase.close();
  const corruptBlocked = await startProductionRuntime({
    dataDir: corruptDataDirectory, sourceHash: HASH_A, gpt: createGptAbilityGroup(),
    evidenceStore: createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(corruptDataDirectory)),
    browserAuthority: browserAuthority as never,
    runtimeLogger: createRuntimeLogger({
      producer: "agent-corrupt-data", owner: "production-runtime", component: "startup-integrity",
      terminalEnabled: false, fileSink: { directoryPath: path.join(temporary, "runtime-logs") },
    }),
  });
  assert.equal(corruptBlocked.readHealth().lastErrorCode, "PRODUCTION_RUNTIME_DATA_CORRUPT");
  await corruptBlocked.close();

  const blockedShellDirectory = path.join(temporary, "blocked-shell");
  const crashOrphanDirectory = path.join(blockedShellDirectory, "generated-images", "crash-orphan-mutant");
  await mkdir(crashOrphanDirectory, { recursive: true });
  await writeFile(path.join(crashOrphanDirectory, "orphan.original"), "orphan", { mode: 0o600 });
  const blocked = await startProductionRuntime({
    dataDir: blockedShellDirectory,
    sourceHash: HASH_A,
    gpt: createGptAbilityGroup(),
    evidenceStore: createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(blockedShellDirectory)),
    browserAuthority: browserAuthority as never,
    runtimeLogger: createRuntimeLogger({
      producer: "agent-acceptance", owner: "app-shell", component: "production-runtime-acceptance",
      terminalEnabled: false, fileSink: { directoryPath: path.join(temporary, "runtime-logs") },
    }),
  });
  assert.equal(await readFile(path.join(crashOrphanDirectory, "orphan.original"), "utf8"), "orphan",
    "startup must not erase a potentially recoverable generated-image artifact");
  assert.equal(blocked.readHealth().shellState, "ready");
  assert.equal(blocked.readHealth().cloudState, "contract_blocked");
  assert.equal(blocked.readHealth().executionState, "blocked");
  await blocked.close();
} finally {
  if (previousCredentialPath === undefined) delete process.env.AGENT_PRODUCTION_CREDENTIAL_FILE;
  else process.env.AGENT_PRODUCTION_CREDENTIAL_FILE = previousCredentialPath;
  await rm(temporary, { recursive: true, force: true });
}

const remoteClaimLogTemporary = await mkdtemp(path.join(tmpdir(), "agent-remote-claim-log-"));
try {
  const logger = createRuntimeLogger({
    producer: "agent-remote-claim-log", owner: "production-runtime", component: "production-claim",
    terminalEnabled: false, fileSink: { directoryPath: path.join(remoteClaimLogTemporary, "runtime-logs") },
  });
  const span = requireRuntimeLogWrite(logger.startSpan({
    traceId: "producer:remote-claim", boundaryId: "claim:remote-column", owner: "production-runtime",
    component: "production-claim", operation: "cloud.claim",
    typedIdentity: { kind: "request", requestId: "claim:remote-column" },
  }));
  const terminal = terminalSpanFailure(
    span,
    runtimeTransportFailure("COLUMN", 500),
    null,
    "CLAIM_REQUEST_FAILED",
    undefined,
    "website",
  );
  assert.equal(terminal.failure?.code, "COLUMN");
  assert.equal(terminal.failure?.httpStatus, 500);
  assert.equal(terminal.failure?.responsibleOwner, "website");
} finally {
  await rm(remoteClaimLogTemporary, { recursive: true, force: true });
}

const pluginFailureTemporary = await mkdtemp(path.join(tmpdir(), "agent-plugin-failure-code-"));
try {
  const pluginFailureLogger = createRuntimeLogger({
    producer: "agent-plugin-failure-acceptance", owner: "production-runtime", component: "executor",
    terminalEnabled: false, fileSink: { directoryPath: path.join(pluginFailureTemporary, "runtime-logs") },
  });
  const pluginFailureStore = new ProductionRuntimeStore(pluginFailureTemporary);
  const executor = new ProductionExecutor(
    pluginFailureStore, pluginFailureLogger,
    {
      dataDir: pluginFailureTemporary, sourceHash: HASH_A,
      gpt: {} as never, evidenceStore: {} as never, browserAuthority: {} as never,
    },
  );
  const terminalizePluginFailure = Reflect.get(executor, "terminalizePluginFailure") as
    (span: RuntimeSpanHandle, error: unknown) => never;
  const startPluginSpan = (stepId: string) => requireRuntimeLogWrite(pluginFailureLogger.startSpan({
    traceId: "job:plugin-failure-code", owner: "product-plugin", component: "public-knowledge-article-pipeline",
    operation: "plugin.execute",
    typedIdentity: {
      kind: "plugin-step", jobId: "job:plugin-failure-code", attemptId: "attempt:plugin-failure-code",
      pluginId: "public-knowledge-article-pipeline", stepId,
    },
  }));

  assert.throws(
    () => terminalizePluginFailure.call(
      executor, startPluginSpan("direct-product-failure"),
      executionFailure("failed", "PUBLIC_KNOWLEDGE_TOPIC_MANIFEST_INVALID"),
    ),
    /PUBLIC_KNOWLEDGE_TOPIC_MANIFEST_INVALID/u,
  );

  const childSpan = requireRuntimeLogWrite(pluginFailureLogger.startSpan({
    traceId: "job:plugin-failure-code", owner: "gpt", component: "gpt-child",
    operation: "gpt.child",
    typedIdentity: {
      kind: "gpt-call", jobId: "job:plugin-failure-code", attemptId: "attempt:plugin-failure-code",
      pluginId: "public-knowledge-article-pipeline", pluginVersion: 1, stepId: "corpus_research",
      capabilityCallId: "call:corpus_research",
    },
  }));
  const childTerminal = requireRuntimeLogWrite(childSpan.terminal({
    outcome: "failed",
    failure: runtimeFailureFromError({
      error: executionFailure("failed", "GPT_CHILD_FAILED"), code: "GPT_CHILD_FAILED",
      responsibleOwner: "gpt", impact: RuntimeFailureImpact.BLOCKING,
    }),
  }));
  assert.throws(
    () => terminalizePluginFailure.call(
      executor, startPluginSpan("consequential-product-failure"),
      withRuntimeLogCause(executionFailure("failed", "GPT_CHILD_FAILED"), childTerminal.eventId),
    ),
    /GPT_CHILD_FAILED/u,
  );

  const dispatchFailureTask = task({
    jobId: "job:plugin-primary-with-cleanup-failure",
    productId: "payment_screenshot_observation",
    actionId: "observe",
    materialRefs: [{
      material_id: "material:plugin-primary-payment", ordinal: 0, role: "payment_screenshot",
      display_name: "payment.png", object_ref: "object:plugin-primary-payment", sha256: HASH_A,
      bytes: 10, media_type: "image/png", storage_class: "private_owner_scoped",
      owner_scope_hash: HASH_B, trust_class: "transport_evidence", may_issue_instruction: false,
    }, {
      material_id: "material:plugin-primary-contract", ordinal: 1, role: "result_contract",
      display_name: "contract.json", object_ref: "object:plugin-primary-contract", sha256: HASH_B,
      bytes: 10, media_type: "application/json", storage_class: "private_owner_scoped",
      owner_scope_hash: HASH_A, trust_class: "instruction", may_issue_instruction: true,
    }],
    extra: { parameters: { observation_schema_version: "payment-screenshot-observation-v1" } },
  });
  const dispatchAttemptId = "attempt:plugin-primary-with-cleanup-failure";
  executor.accept(dispatchFailureTask, dispatchAttemptId);
  const gptChildTools = Reflect.get(executor, "gptChildTools") as Record<string, unknown>;
  let settleCalls = 0;
  Reflect.set(gptChildTools, "createExecution", () => ({
    tools: {
      attemptId: dispatchAttemptId,
      readContinuationExact: async () => null,
      readCallFacts: async () => {
        throw executionFailure("failed", "PAYMENT_OBSERVATION_PROVIDER_FAILED");
      },
      execute: async () => { throw new Error("UNREACHABLE_GPT_CHILD_EXECUTION"); },
    },
    continuationRef: () => null,
    settle: async () => {
      settleCalls += 1;
      throw new Error("BROWSER_TARGET_CLOSE_FAILED");
    },
  }));
  await assert.rejects(
    executor.execute(
      dispatchFailureTask,
      [],
      {
        attempt_id: dispatchAttemptId,
        device_id: "device:plugin-primary-with-cleanup-failure",
        lease_version: 1,
        execution_fence_hash: HASH_A,
        control_manifest_hash: HASH_B,
        max_provider_turns: 1,
        provider_turns_used: 0,
        expires_at_monotonic: performance.now() + 10_000,
        command_ttl_ms: 1_000,
        abort_signal: new AbortController().signal,
      },
      "span:plugin-primary-with-cleanup-failure",
      async () => { throw new Error("UNREACHABLE_PLUGIN_COMPLETE"); },
    ),
    (error: unknown) => {
      assert.equal(
        typedExecutionFailure(error)?.code,
        "PAYMENT_OBSERVATION_PROVIDER_FAILED",
      );
      return true;
    },
  );
  assert.equal(settleCalls, 1, "the primary-plus-cleanup path must execute lifecycle settlement exactly once");

  const pluginLogEvents = (await readFile(pluginFailureLogger.currentSegmentPath()!, "utf8")).trim().split("\n")
    .map((line) => JSON.parse(line) as Readonly<Record<string, unknown>>);
  const pluginFailureEvents = pluginLogEvents
    .filter((event) => event.kind === "span.terminal" && event.operation === "plugin.execute");
  assert.equal(pluginFailureEvents.length, 3);
  assert.deepEqual(pluginFailureEvents.map((event) => {
    const failure = event.failure as Readonly<Record<string, unknown>>;
    return [failure.code, failure.impact, failure.causedByEventId ?? null];
  }), [
    ["PUBLIC_KNOWLEDGE_TOPIC_MANIFEST_INVALID", RuntimeFailureImpact.BLOCKING, null],
    ["PLUGIN_EXECUTION_FAILED", RuntimeFailureImpact.CONSEQUENTIAL, childTerminal.eventId],
    ["PAYMENT_OBSERVATION_PROVIDER_FAILED", RuntimeFailureImpact.BLOCKING, null],
  ]);
  const cleanupEvents = pluginLogEvents.filter((event) => {
    const failure = event.failure as Readonly<Record<string, unknown>> | undefined;
    return event.kind === "error" && failure?.code === "GPT_BROWSER_LIFECYCLE_FAILED";
  });
  assert.equal(cleanupEvents.length, 1);
  const cleanupFailure = cleanupEvents[0]!.failure as Readonly<Record<string, unknown>>;
  assert.equal(cleanupFailure.impact, RuntimeFailureImpact.CLEANUP);
  assert.equal(cleanupFailure.causedByEventId, pluginFailureEvents[2]!.eventId);
  pluginFailureStore.close();
} finally {
  await rm(pluginFailureTemporary, { recursive: true, force: true });
}

const runtimeSource = await readFile(
  new URL("../../src/lib/local-runtime/production/runtime-claim.ts", import.meta.url), "utf8",
);
assert.doesNotMatch(runtimeSource, /handleClaimFailure/u);
assert.match(runtimeSource, /error instanceof ProductionRuntimeBoundaryError/u);
assert.match(runtimeSource, /material\.checkpointSeq \+ 1/u);
assert.match(runtimeSource, /RUNTIME_RECOVERY_REQUIRED:/u);

for (const evidenceMode of ["exam.golden", "exam.property"] as const) {
  emitQualityProofObservation({
    lawId: "LAW-AGENT-PRODUCTION-RUNTIME-002-V2",
    evidenceMode,
    clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "summary"],
    locator: `acceptance:agent-production-runtime:credential:${evidenceMode}`,
    observedValue: "credential missing parent missing file malformed JSON missing manifest invalid origin unsafe permissions and symlink each failed with one stable typed code while a valid credential read back exactly",
  });
}
for (const evidenceMode of ["exam.golden", "exam.property", "exam.state-machine"] as const) {
  emitQualityProofObservation({
    lawId: "LAW-AGENT-PRODUCTION-RUNTIME-006-V3",
    evidenceMode,
    clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "summary"],
    locator: `acceptance:agent-production-runtime:storage-inventory:${evidenceMode}`,
    observedValue: "read-only storage inventory preserved owned data reported exact orphan denominator rejected symlinks and blocked claim before credential without deleting any target",
  });
}
