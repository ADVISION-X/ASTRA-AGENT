import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

import { createForensicsPersistenceAbilityGroupFromStorage } from "../../src/capabilities/forensics-persistence/index.js";
import { createGrassEyeFileStorage } from "../../src/lib/storage/index.js";
import { createArtifactRef } from "../../src/lib/storage/refs.js";

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
  const duplicateRecord = await group.appendRecord({
    missionId: "mission-1",
    runId: "run-1",
    recordType: "evidence",
    recordPayload: { status: "observed" },
    idempotencyKey: "record-1",
  });
  assert.equal(duplicateRecord.recordRef, record.recordRef);
  const readback = await group.readRecordRef({ childCapabilityId: "read-record-ref", recordRef: record.recordRef! });
  assert.equal(readback.status, "success");
  assert.deepEqual(readback.record?.payload, { status: "observed" });
  const recordConflict = await group.appendRecord({
    missionId: "mission-1",
    runId: "run-1",
    recordType: "evidence",
    recordPayload: { status: "drifted" },
    idempotencyKey: "record-1",
  });
  assert.equal(recordConflict.status, "failed");
  assert.match(recordConflict.failureReason ?? "", /FORENSICS_IDEMPOTENCY_CONFLICT/u);

  const exactCallIdentityHash = `sha256:${"7".repeat(64)}` as const;
  const exactEvidence = await group.appendRecord({
    missionId: "mission-exact",
    runId: "run-exact",
    stepId: "step-exact",
    sourceCapabilityId: "gpt",
    sourceChildCapabilityId: "submit_exact_gpt_turn_once",
    recordType: "evidence",
    recordPayload: {
      exact_call_identity_hash: exactCallIdentityHash,
      action_ordinal: 12,
      source_evidence_hash: `sha256:${"8".repeat(64)}`,
    },
    idempotencyKey: `gpt-call-evidence:v1:${exactCallIdentityHash}`,
  });
  const exactReadback = await group.readExactCallEvidence({
    missionId: "mission-exact",
    runId: "run-exact",
    exactCallIdentityHash,
  });
  assert.equal(exactReadback?.recordRef, exactEvidence.recordRef,
    "exact call identity must derive and read back the original deterministic recordRef");
  assert.deepEqual(exactReadback?.record.payload, {
    exact_call_identity_hash: exactCallIdentityHash,
    action_ordinal: 12,
    source_evidence_hash: `sha256:${"8".repeat(64)}`,
  });
  assert.equal(await group.readExactCallEvidence({
    missionId: "mission-exact",
    runId: "run-exact",
    exactCallIdentityHash: `sha256:${"9".repeat(64)}`,
  }), null, "an absent exact call must remain a null fact without creating a record");

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
  const duplicateArtifact = await group.appendArtifact({
    missionId: "mission-1",
    runId: "run-1",
    artifactType: "other",
    content: "private-body",
    idempotencyKey: "artifact-1",
  });
  assert.equal(duplicateArtifact.artifactRef, artifact.artifactRef);
  const artifactReadback = await group.readArtifactRef({
    childCapabilityId: "read-artifact-ref",
    artifactRef: artifact.artifactRef!,
  });
  assert.equal(artifactReadback.status, "success");
  assert.deepEqual(Buffer.from(artifactReadback.artifact!.content), Buffer.from("private-body"));

  const crashBytes = Buffer.from([0, 1, 2, 254, 255]);
  const crashArtifactRef = createArtifactRef("artifact\0mission-crash\0run-crash\0artifact-crash");
  await mkdir(join(tempRoot, "forensics", "artifacts"), { recursive: true });
  await writeFile(join(tempRoot, "forensics", "artifacts", `${crashArtifactRef}.bin`), crashBytes, { flag: "wx", mode: 0o600 });
  const recoveredArtifact = await group.appendArtifact({
    missionId: "mission-crash",
    runId: "run-crash",
    artifactType: "other",
    content: crashBytes,
    idempotencyKey: "artifact-crash",
  });
  assert.equal(recoveredArtifact.status, "success");
  assert.equal(recoveredArtifact.artifactRef, crashArtifactRef,
    "bytes persisted before an index crash must recover under the same content-bound identity");
  const recoveredReadback = await group.readArtifactRef({
    childCapabilityId: "read-artifact-ref",
    artifactRef: crashArtifactRef,
  });
  assert.deepEqual(Buffer.from(recoveredReadback.artifact!.content), crashBytes);

  const recordLog = await readFile(join(tempRoot, "forensics", "records-run_1.ndjson"), "utf8");
  const artifactLog = await readFile(join(tempRoot, "forensics", "artifacts.ndjson"), "utf8");
  assert.match(recordLog, /"integrityHash"/);
  assert.match(artifactLog, /"integrityHash"/);
  assert.equal(artifactLog.includes("private-body"), false, "artifact body must not be embedded in the artifact index");
  assert.equal(
    await readFile(join(tempRoot, "forensics", "artifacts", `${artifact.artifactRef}.bin`), "utf8"),
    "private-body",
  );
  assert.equal(recordLog.trim().split("\n").length, 1, "idempotent record append must not duplicate the WAL row");
  assert.equal(artifactLog.trim().split("\n").length, 2, "idempotent append and crash recovery must each own one index row");

  const evidenceWriterSource = await readFile(
    new URL("../../src/lib/local-runtime/production/gpt-evidence-writer.ts", import.meta.url),
    "utf8",
  );
  const artifactAppendAt = evidenceWriterSource.indexOf("input.evidenceStore.appendArtifact");
  const artifactReadbackAt = evidenceWriterSource.indexOf("input.evidenceStore.readArtifactRef", artifactAppendAt);
  const recordAppendAt = evidenceWriterSource.indexOf("input.evidenceStore.appendRecord", artifactReadbackAt);
  assert(artifactAppendAt >= 0 && artifactReadbackAt > artifactAppendAt && recordAppendAt > artifactReadbackAt,
    "binary Provider artifacts must be persisted and byte-readback verified before their safe proof record is admitted");
  assert.match(evidenceWriterSource, /artifactRefs/u,
    "the safe proof record must bind the ordered binary artifact refs");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE] forensics-persistence-capability PASS\n");
emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-FORENSICS-PERSISTENCE-CAPABILITY-001-V4", evidenceMode: "exam.golden", clauses: ["forbidden:0","summary"], locator: "acceptance:forensics:append-only-record", observedValue: "exact-call record append, deterministic readback, and integrity hash verified" });
emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-FORENSICS-PERSISTENCE-CAPABILITY-002-V4", evidenceMode: "exam.golden", clauses: ["forbidden:0","summary"], locator: "acceptance:forensics:artifact-index", observedValue: "exact-call keys bind one record and artifact index without embedding private body" });
emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-FORENSICS-PERSISTENCE-CAPABILITY-003-V3", evidenceMode: "exam.golden", clauses: ["forbidden:0","summary"], locator: "acceptance:forensics:storage-owner", observedValue: "ability group persists through sole governed file storage" });
