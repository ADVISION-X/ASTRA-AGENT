import assert from "node:assert/strict";
import { mkdir, mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";

import { createMediaProcessingAbilityGroupFromFilesystem } from "../../src/capabilities/media-processing/index.js";

const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-media-processing-image-"));
const uploadDir = path.join(dataDir, "runtime-data", "media-processing-uploads", "acceptance");
await mkdir(uploadDir, { recursive: true });
const inputFilePath = path.join(uploadDir, "source.png");

await sharp({
  create: {
    width: 640,
    height: 360,
    channels: 4,
    background: { r: 40, g: 120, b: 210, alpha: 1 },
  },
}).png().toFile(inputFilePath);

const group = createMediaProcessingAbilityGroupFromFilesystem({ dataDir });
const result = await group.processMedia({
  missionId: "media-processing-image-acceptance",
  runId: "media-processing-image-run",
  inputFilePath,
  presetId: "web-image",
  outputFormat: "webp",
  quality: 82,
  maxWidth: 320,
  maxHeight: 240,
});

assert.equal(result.abilityGroupId, "media-processing");
assert.equal(result.childCapabilityId, "optimize-image-for-web-once");
assert.equal(result.status, "success");
assert.equal(result.output.status, "success");
if (result.output.status !== "success") {
  throw new Error("Image result did not narrow to success.");
}
const [artifact] = result.output.outputArtifacts;
assert.ok(artifact, "Image processing must produce an artifact.");
assert.equal(artifact.derivativeKind, "optimized");
assert.equal(artifact.format, "webp");
assert.ok(artifact.byteSize > 0, "Image artifact must have byte size.");
assert.equal(artifact.sha256.length, 64, "Image artifact must include sha256.");
await stat(artifact.filePath);
await stat(result.output.proofRef);
assert.equal(result.output.proofRef, path.join(path.dirname(artifact.filePath), "proof.json"));

const heroSourcePath = path.join(uploadDir, "hero-source.png");
await sharp({
  create: {
    width: 400,
    height: 800,
    channels: 3,
    background: { r: 30, g: 90, b: 180 },
  },
}).png().toFile(heroSourcePath);
const hero = await group.processMedia({
  missionId: "media-processing-public-hero-acceptance",
  runId: "media-processing-public-hero-run",
  inputFilePath: heroSourcePath,
  presetId: "public-knowledge-hero",
});
assert.equal(hero.status, "success");
if (hero.output.status !== "success") throw new Error("Public hero normalization failed.");
const heroArtifact = hero.output.outputArtifacts[0]!;
const heroMetadata = await sharp(heroArtifact.filePath).metadata();
assert.equal(heroArtifact.width, 1200);
assert.equal(heroArtifact.height, 630);
assert.equal(heroMetadata.format, "webp");
assert.equal(heroMetadata.hasAlpha, false, "Public hero canvas must be opaque.");
assert.equal(heroMetadata.exif, undefined, "Public hero must strip EXIF.");
assert.equal(heroMetadata.xmp, undefined, "Public hero must strip XMP.");
const edge = await sharp(heroArtifact.filePath).extract({ left: 0, top: 315, width: 1, height: 1 }).raw().toBuffer();
const center = await sharp(heroArtifact.filePath).extract({ left: 600, top: 315, width: 1, height: 1 }).raw().toBuffer();
assert.ok(edge[0]! > 180 && edge[1]! > 180, "Contain canvas must retain the neutral side background.");
assert.ok(center[2]! > center[0]!, "Contain canvas must retain the uncropped blue source at center.");

const redline = await group.processMedia({
  missionId: "media-processing-public-redline-acceptance",
  runId: "media-processing-public-redline-run",
  inputFilePath: heroArtifact.filePath,
  presetId: "public-knowledge-redline-check",
});
assert.equal(redline.childCapabilityId, "inspect-public-knowledge-image-redlines-once");
assert.equal(redline.status, "success", "A plain abstract image must pass the governed redline observer.");

process.stdout.write("[ACCEPTANCE][media-processing-image] PASS\n");
