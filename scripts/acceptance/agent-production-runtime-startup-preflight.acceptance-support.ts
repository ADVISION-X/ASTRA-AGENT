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
import { HASH_A, validDeviceCredential } from "./agent-production-runtime-fixtures.js";

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
    }), { status: "READY", version: 27 });
  
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
