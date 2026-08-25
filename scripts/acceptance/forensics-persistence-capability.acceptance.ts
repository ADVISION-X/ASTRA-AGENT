import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

import { createForensicsPersistenceAbilityGroupFromStorage } from "../../src/capabilities/forensics-persistence/index.js";
import { createGrassEyeFileStorage } from "../../src/lib/storage/index.js";

const tempRoot = await mkdtemp(join(tmpdir(), "grasseye-forensics-acceptance-"));

try {
  const group = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(tempRoot));
  const record = await group.appendRecord({
    missionId: "mission-1",
    runId: "run-1",
    recordType: "evidence",
    recordPayload: { status: "observed" },
    idempotencyKey: "record-1",
  });
  assert.equal(record.status, "success");
  assert.equal(record.proof?.abilityGroupId, "forensics-persistence");
  assert.equal(record.proof?.childCapabilityId, "append-record");
  assert.equal(typeof record.proof?.recordRef, "string");
  assert.equal(typeof record.proof?.integrityHash, "string");

  const artifact = await group.appendArtifact({
    missionId: "mission-1",
    runId: "run-1",
    artifactType: "other",
    content: "private-body",
    idempotencyKey: "artifact-1",
  });
  assert.equal(artifact.status, "success");
  assert.equal(artifact.proof?.childCapabilityId, "append-artifact");
  assert.equal(typeof artifact.proof?.artifactRef, "string");
  assert.equal(typeof artifact.proof?.integrityHash, "string");

  const recordLog = await readFile(join(tempRoot, "forensics", "records-run_1.ndjson"), "utf8");
  const artifactLog = await readFile(join(tempRoot, "forensics", "artifacts.ndjson"), "utf8");
  assert.match(recordLog, /"integrityHash"/);
  assert.match(artifactLog, /"integrityHash"/);
  assert.equal(artifactLog.includes("private-body"), false, "artifact body must not be embedded in the artifact index");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE] forensics-persistence-capability PASS\n");
emitQualityProofObservation({ lawId: "LAW-FORENSICS-PERSISTENCE-CAPABILITY-001-V2", evidenceMode: "exam.golden", locator: "acceptance:forensics:append-only-record", observedValue: "record append and integrity hash verified" });
emitQualityProofObservation({ lawId: "LAW-FORENSICS-PERSISTENCE-CAPABILITY-002-V2", evidenceMode: "exam.golden", locator: "acceptance:forensics:artifact-index", observedValue: "artifact index binds integrity hash without embedding private body" });
emitQualityProofObservation({ lawId: "LAW-FORENSICS-PERSISTENCE-CAPABILITY-003-V2", evidenceMode: "exam.golden", locator: "acceptance:forensics:storage-owner", observedValue: "ability group persists through sole governed file storage" });
