import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

import { createForensicsPersistenceAbilityGroupFromStorage } from
  "../../src/capabilities/forensics-persistence/index.js";
import { createGrassEyeFileStorage } from "../../src/lib/storage/index.js";
import { createArtifactRef } from "../../src/lib/storage/refs.js";

const tempRoot = await mkdtemp(join(tmpdir(), "grasseye-artifact-acceptance-"));
try {
  const group = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(tempRoot));
  const input = { missionId: "mission-1", runId: "run-1", artifactType: "ai_raw_output" as const,
    content: "raw-answer", idempotencyKey: "answer-1" };
  const artifact = await group.appendArtifact(input);
  if (artifact.status !== "success") throw new Error(artifact.failureReason);
  const duplicate = await group.appendArtifact(input);
  if (duplicate.status !== "success") throw new Error(duplicate.failureReason);
  assert.equal(duplicate.artifactRef, artifact.artifactRef);
  const conflict = await group.appendArtifact({ ...input, content: "different" });
  assert.equal(conflict.status, "failed");
  assert.equal(conflict.failureReason, "FORENSICS_IDEMPOTENCY_CONFLICT");
  const readback = await group.readArtifact({ missionId: input.missionId, runId: input.runId,
    idempotencyKey: input.idempotencyKey });
  if (readback.status !== "success") throw new Error(readback.failureReason);
  assert.equal(Buffer.from(readback.artifact.content).toString("utf8"), "raw-answer");

  const crashBytes = Buffer.from([0, 1, 2, 254, 255]);
  const crashRef = createArtifactRef("artifact\0mission-crash\0run-crash\0answer-crash");
  const legacyOrphanRef = createArtifactRef("artifact\0mission-legacy\0run-legacy\0answer-legacy");
  await mkdir(join(tempRoot, "forensics", "artifacts"), { recursive: true });
  await writeFile(join(tempRoot, "forensics", "artifacts", `${crashRef}.bin`), crashBytes,
    { flag: "wx", mode: 0o600 });
  const storage = createGrassEyeFileStorage(tempRoot);
  const recovered = await group.appendArtifact({ missionId: "mission-crash", runId: "run-crash",
    artifactType: "ai_raw_output", content: crashBytes, idempotencyKey: "answer-crash" });
  if (recovered.status !== "success") throw new Error(recovered.failureReason);
  assert.equal(recovered.artifactRef, crashRef);
  const legacyOrphanPath = join(tempRoot, "forensics", "artifacts", `${legacyOrphanRef}.bin`);
  await writeFile(legacyOrphanPath, crashBytes, { flag: "wx", mode: 0o600 });
  await storage.deleteArtifactsForMission("mission-legacy");
  await assert.rejects(readFile(legacyOrphanPath), /ENOENT/u,
    "legacy byte-only orphan must be removed before an exact 404 purge is acknowledged");
  assert.ok(await storage.readArtifact(artifact.artifactRef),
    "unindexed garbage collection must not remove indexed sibling evidence");
  const index = await readFile(join(tempRoot, "forensics", "artifacts.ndjson"), "utf8");
  assert.equal(index.includes("raw-answer"), false);
  assert.equal(index.trim().split("\n").length, 2);
  await rm(join(tempRoot, "forensics", "artifacts", `${crashRef}.bin`));
  await storage.deleteArtifactsForMission("mission-crash");
  assert.equal(await storage.readArtifact(crashRef), null,
    "an indexed write interrupted before bytes must remain exactly purgeable");
  assert.equal((await readFile(join(tempRoot, "forensics", "artifacts.ndjson"), "utf8"))
    .includes(crashRef), false);
  assert.ok(await storage.readArtifact(artifact.artifactRef),
    "purging the interrupted mission must preserve its sibling artifact");
  await assert.rejects(readFile(join(tempRoot, "forensics", "records-run_1.ndjson")));
  const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
  const image = await group.appendArtifact({ missionId: input.missionId, runId: input.runId,
    artifactType: "ai_raw_output", mimeType: "image/png", content: imageBytes, idempotencyKey: "image-1" });
  if (image.status !== "success") throw new Error(image.failureReason);
  const imageReadback = await group.readArtifact({ missionId: input.missionId, runId: input.runId,
    idempotencyKey: "image-1" });
  if (imageReadback.status !== "success") throw new Error(imageReadback.failureReason);
  assert.equal(imageReadback.artifactRef, image.artifactRef);
  assert.equal(imageReadback.artifact.mimeType, "image/png");
  assert.deepEqual(new Uint8Array(imageReadback.artifact.content), imageBytes);
  assert.match(imageReadback.artifact.integrityHash, /^sha256:[a-f0-9]{64}$/u);
  assert.notEqual(imageReadback.artifact.integrityHash,
    `sha256:${createHash("sha256").update(imageBytes).digest("hex")}`,
    "integrityHash authenticates the stored envelope, not the raw image identity");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE] forensics-persistence-capability PASS\n");
for (const lawId of ["LAW-FORENSICS-PERSISTENCE-CAPABILITY-001-V6",
  "LAW-FORENSICS-PERSISTENCE-CAPABILITY-002-V6", "LAW-FORENSICS-PERSISTENCE-CAPABILITY-003-V5"]) {
  emitQualityProofObservation({ lawId, evidenceMode: "exam.golden", clauses: ["forbidden:0", "summary"],
    locator: "acceptance:forensics:raw-answer-artifact",
    observedValue: "one idempotent raw answer artifact is appended and read back; record ledger is absent" });
}
