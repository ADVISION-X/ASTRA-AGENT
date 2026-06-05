import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";

import { createMediaProcessingAbilityGroupFromFilesystem } from "../../src/capabilities/media-processing/index.js";

const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-media-processing-proof-"));
const inputFilePath = path.join(dataDir, "source.png");
await sharp({
  create: {
    width: 480,
    height: 300,
    channels: 3,
    background: { r: 90, g: 40, b: 190 },
  },
}).png().toFile(inputFilePath);

const result = await createMediaProcessingAbilityGroupFromFilesystem({ dataDir }).processMedia({
  missionId: "media-processing-proof-acceptance",
  runId: "media-processing-proof-run",
  inputFilePath,
  childCapabilityId: "generate-responsive-image-variants-once",
  outputFormat: "webp",
  variantWidths: [120, 240],
});

assert.equal(result.status, "success");
assert.equal(result.output.status, "success");
if (result.output.status !== "success") {
  throw new Error("Proof result did not narrow to success.");
}
assert.equal(result.output.outputArtifacts.length, 2);
const firstArtifact = result.output.outputArtifacts[0];
assert.ok(firstArtifact, "Responsive image set must produce a first artifact.");
const proofPath = path.join(path.dirname(firstArtifact.filePath), "proof.json");
await stat(proofPath);
const proof = JSON.parse(await readFile(proofPath, "utf8")) as { proofId?: string; outputArtifacts?: unknown[] };
assert.equal(proof.proofId, result.runtimeProof.proofId);
assert.equal(proof.outputArtifacts?.length, 2);

process.stdout.write("[ACCEPTANCE][media-processing-artifact-proof] PASS\n");
