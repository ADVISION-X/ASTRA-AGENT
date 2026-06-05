import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";

import { createMediaProcessingAbilityGroupFromFilesystem } from "../../src/capabilities/media-processing/index.js";
import { runMediaProcessingArtifactFlow } from "../../src/plugins/media-processing-artifact/index.js";

const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-media-processing-flow-"));
const inputFilePath = path.join(dataDir, "source.png");
await sharp({
  create: {
    width: 320,
    height: 180,
    channels: 3,
    background: { r: 180, g: 90, b: 30 },
  },
}).png().toFile(inputFilePath);

const result = await runMediaProcessingArtifactFlow(
  {
    jobType: "media-processing-artifact",
    inputFilePath,
    childCapabilityId: "resize-image-for-web-once",
    outputFormat: "webp",
    targetWidth: 160,
    targetHeight: 90,
    artifactPolicy: "deliverable",
  },
  { mediaProcessing: createMediaProcessingAbilityGroupFromFilesystem({ dataDir }) },
);

assert.equal(result.jobType, "media-processing-artifact");
assert.equal(result.status, "success");
assert.equal(result.result.abilityGroupId, "media-processing");
assert.equal(result.result.childCapabilityId, "resize-image-for-web-once");

process.stdout.write("[ACCEPTANCE][media-processing-job-flow] PASS\n");
