import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
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
  await mkdir(join(tempRoot, "forensics", "artifacts"), { recursive: true });
  await writeFile(join(tempRoot, "forensics", "artifacts", `${crashRef}.bin`), crashBytes,
    { flag: "wx", mode: 0o600 });
  const recovered = await group.appendArtifact({ missionId: "mission-crash", runId: "run-crash",
    artifactType: "ai_raw_output", content: crashBytes, idempotencyKey: "answer-crash" });
  if (recovered.status !== "success") throw new Error(recovered.failureReason);
  assert.equal(recovered.artifactRef, crashRef);
  const index = await readFile(join(tempRoot, "forensics", "artifacts.ndjson"), "utf8");
  assert.equal(index.includes("raw-answer"), false);
  assert.equal(index.trim().split("\n").length, 2);
  await assert.rejects(readFile(join(tempRoot, "forensics", "records-run_1.ndjson")));
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
