import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createGptAbilityGroup } from "../../src/capabilities/gpt/index.js";
import { createForensicsPersistenceAbilityGroupFromStorage } from
  "../../src/capabilities/forensics-persistence/index.js";
import {
  productionCredentialPath,
  readProductionCredential,
} from "../../src/lib/local-runtime/production/credential.js";
import { startProductionRuntime } from "../../src/lib/local-runtime/production/runtime.js";
import {
  productionRuntimeTaskRoot,
  productionRuntimeTaskPath,
  readProductionRuntimeStorageInventory,
} from "../../src/lib/local-runtime/production/runtime-storage-inventory.js";
import { DeviceCredentialSchema } from "../../src/lib/local-runtime/production/transport-protocol.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { createGrassEyeFileStorage } from "../../src/lib/storage/index.js";
import { typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { verifyProductionDependency } from "../startup/lib/production-contract-preflight.js";
import { HASH_A, HASH_B, resultFor, task, validDeviceCredential } from "./agent-production-runtime-fixtures.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";

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

const responsibilities = (taskIds: readonly string[]) => ({
  task_ids: taskIds, outbox_responsibility_count: 0, pending_outbox_count: 0,
});

const assertDependencyProjection = async (): Promise<void> => {
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
    }), { status: "READY", version: 44 });
  
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
    assert.throws(() => DeviceCredentialSchema.parse({
      ...validDeviceCredential,
      control_manifest_hash: HASH_A,
    }));
  } finally {
    await rm(projectionTemporary, { recursive: true, force: true });
  }
};

const assertCredentialFormatFailures = async (credentialTemporary: string): Promise<void> => {
    await expectCredentialCode(path.join(credentialTemporary, "missing-parent"),
      "PRODUCTION_CREDENTIAL_PARENT_MISSING");
    const missingFile = path.join(credentialTemporary, "missing-file");
    await mkdir(path.dirname(productionCredentialPath(missingFile)), { recursive: true, mode: 0o700 });
    await expectCredentialCode(missingFile, "PRODUCTION_CREDENTIAL_MISSING");
  
    const malformed = path.join(credentialTemporary, "malformed");
    await writeCredential(malformed, "{");
    await expectCredentialCode(malformed, "PRODUCTION_CREDENTIAL_JSON_INVALID");
  
};

const assertCredentialValueFailures = async (credentialTemporary: string): Promise<void> => {
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
};

const assertCredentialSymlinkAndValid = async (credentialTemporary: string): Promise<void> => {
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
};

const assertCredentialBoundary = async (): Promise<void> => {
  const credentialTemporary = await mkdtemp(path.join(tmpdir(), "agent-production-credential-"));
  try {
    await assertCredentialFormatFailures(credentialTemporary);
    await assertCredentialValueFailures(credentialTemporary);
    await assertCredentialSymlinkAndValid(credentialTemporary);
  } finally {
    await rm(credentialTemporary, { recursive: true, force: true });
  }
};

const assertEmptyStorageInventory = async (inventoryTemporary: string): Promise<void> => {
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
};

const assertOccupiedStorageInventory = async (
  inventoryTemporary: string,
): Promise<Readonly<{ dataDir: string; root: string }>> => {
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
      browserAuthority: { verifyRuntimeTaskProvenance: () => undefined,
        readProductionRuntimeState: () => ({
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
  return { dataDir, root };
};

const assertStorageSymlinkRejected = async (
  inventoryTemporary: string,
  dataDir: string,
  root: string,
): Promise<void> => {
    const linkedFile = path.join(inventoryTemporary, "linked-material.txt");
    await writeFile(linkedFile, "linked");
    await symlink(linkedFile, path.join(root, "job:owned", "materials", "linked.txt"));
    await assert.rejects(readProductionRuntimeStorageInventory(
      dataDir, responsibilities(["job:owned", "job:orphan"]),
    ),
      (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_STORAGE_SYMLINK_INVALID");
};

const assertStorageInventoryBoundary = async (): Promise<void> => {
  const inventoryTemporary = await mkdtemp(path.join(tmpdir(), "agent-production-storage-inventory-"));
  try {
    await assertEmptyStorageInventory(inventoryTemporary);
    const { dataDir, root } = await assertOccupiedStorageInventory(inventoryTemporary);
    await assertStorageSymlinkRejected(inventoryTemporary, dataDir, root);
  } finally {
    await rm(inventoryTemporary, { recursive: true, force: true });
  }
};

export const assertProductionStartupPreflight = async (): Promise<void> => {
  await assertDependencyProjection();
  await assertCredentialBoundary();
  await assertStorageInventoryBoundary();
};

const seedHistoricalTerminalAttempt = async (dataDir: string): Promise<void> => {
  const historyStore = new ProductionRuntimeStore(dataDir);
  const historyTask = task({ jobId: "job:historical-terminal-new-attempt",
    productId: "payment_screenshot_observation", actionId: "observe" });
  historyStore.acceptTask(historyTask, "attempt:historical-terminal");
  const historicalResult = { ...resultFor(historyTask),
    evidence_refs: [`art-${"a".repeat(64)}`] };
  historyStore.markExecuting(historyTask.job_id);
  historyStore.stageResult(historyTask.job_id, "attempt:historical-terminal", historicalResult);
  for (const [key, receipt] of [["payload", HASH_A], ["envelope", HASH_B]] as const) {
    historyStore.enqueue({ idempotency_key: `artifact:historical-terminal:${key}`, kind: "artifact",
      path: `/internal/ai-production/v6/jobs/${historyTask.job_id}/artifacts/${key}`,
      method: "PUT", headers: {}, body: Buffer.from(key) });
    historyStore.markOutboxSent(`artifact:historical-terminal:${key}`, { receipt_hash: receipt });
  }
  const historicalPayloadHash = hashCanonical(historicalResult);
  historyStore.enqueue({ idempotency_key: "terminal:historical-terminal", kind: "terminal",
    path: `/internal/ai-production/v6/jobs/${historyTask.job_id}/terminal`,
    method: "POST", headers: {}, body: JSON.stringify({
      schema_version: "xuanxue-ai-terminal-cas.v6", job_id: historyTask.job_id,
      terminal_status: "completed", payload_hash: historicalPayloadHash, failure: null,
      worker_session_id: "session:historical-terminal",
      worker_session_epoch: 1,
      result_object_receipts: [HASH_A, HASH_B],
    }) });
  historyStore.markOutboxSent("terminal:historical-terminal", {
    schema_version: "xuanxue-ai-terminal-receipt.v6", job_id: historyTask.job_id,
    terminal_status: "completed", payload_hash: historicalPayloadHash, failure: null,
    first_terminal: true, device_id: "device:historical-terminal", device_epoch: 1,
    worker_session_id: "session:historical-terminal",
    worker_session_epoch: 1,
    runtime_attestation_receipt_hash: HASH_A,
  });
  (Reflect.get(historyStore, "database") as import("better-sqlite3").Database)
    .prepare(`update production_tasks set current_attempt_id=? where job_id=?`).run(
      "attempt:website-authorized-next", historyTask.job_id,
    );
  historyStore.close();
};

export const assertSessionBindingMismatchStartup = async (): Promise<void> => {
const bindingMismatchTemporary = await mkdtemp(path.join(tmpdir(), "agent-session-binding-mismatch-"));
const bindingMismatchCredentialPath = path.join(bindingMismatchTemporary, "device-credential.json");
const bindingMismatchOriginalCredentialPath = process.env.AGENT_PRODUCTION_CREDENTIAL_FILE;
const bindingMismatchOriginalFetch = globalThis.fetch;
let bindingMismatchRuntime: Awaited<ReturnType<typeof startProductionRuntime>> | null = null;
const bindingMismatchRequestPaths: string[] = [];
try {
  await writeFile(bindingMismatchCredentialPath, JSON.stringify(validDeviceCredential), { mode: 0o600 });
  process.env.AGENT_PRODUCTION_CREDENTIAL_FILE = bindingMismatchCredentialPath;
  globalThis.fetch = (async (input: string | URL | Request) => {
    bindingMismatchRequestPaths.push(new URL(input instanceof Request ? input.url : input).pathname);
    return new Response(JSON.stringify({
      ok: false,
      error: {
        code: "AI_SESSION_BINDING_MISMATCH",
        message: "Worker session binding rejected.",
        status: 409,
        request_id: "request:binding-mismatch",
      },
    }), { status: 409, headers: { "content-type": "application/json" } });
  }) as typeof globalThis.fetch;
  const dataDir = path.join(bindingMismatchTemporary, "runtime");
  await mkdir(dataDir);
  await seedHistoricalTerminalAttempt(dataDir);
  bindingMismatchRuntime = await startProductionRuntime({
    dataDir,
    sourceHash: HASH_A,
    gpt: createGptAbilityGroup(),
    evidenceStore: createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(dataDir)),
    browserAuthority: {
      verifyRuntimeTaskProvenance: () => undefined,
      readProductionRuntimeState: () => ({
        browserAuthorityState: "absent" as const,
        browserTargetState: "absent" as const,
      }),
    } as never,
    runtimeLogger: createRuntimeLogger({
      producer: "agent-session-binding-mismatch", owner: "production-runtime", component: "production-session",
      terminalEnabled: false, fileSink: { directoryPath: path.join(bindingMismatchTemporary, "runtime-logs") },
    }),
  });
  const health = bindingMismatchRuntime.readHealth();
  assert.equal(health.shellState, "ready");
  assert.equal(health.cloudState, "contract_blocked");
  assert.equal(health.executionState, "blocked");
  assert.equal(health.claimAdmissionState, "blocked");
  assert.equal(health.controlContractVersion, 44,
    "blocked diagnostics must retain only the consumer contract version needed for exact comparison");
  assert.equal(health.lastErrorCode, "AI_SESSION_BINDING_MISMATCH");
  await bindingMismatchRuntime.close();
  bindingMismatchRuntime = null;
  assert.deepEqual(bindingMismatchRequestPaths, ["/internal/ai-production/v6/sessions/open"],
    "a deterministic session binding 409 must not create a worker or heartbeat handle that reopens on shutdown");
} finally {
  if (bindingMismatchRuntime) await bindingMismatchRuntime.close();
  globalThis.fetch = bindingMismatchOriginalFetch;
  if (bindingMismatchOriginalCredentialPath === undefined) delete process.env.AGENT_PRODUCTION_CREDENTIAL_FILE;
  else process.env.AGENT_PRODUCTION_CREDENTIAL_FILE = bindingMismatchOriginalCredentialPath;
  await rm(bindingMismatchTemporary, { recursive: true, force: true });
}

};
