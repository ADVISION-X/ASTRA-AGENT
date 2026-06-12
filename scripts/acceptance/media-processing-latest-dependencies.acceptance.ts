import assert from "node:assert/strict";
import { mkdir, mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createMediaProcessingAbilityGroupFromFilesystem } from "../../src/capabilities/media-processing/index.js";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);
const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-media-processing-latest-deps-"));
const uploadDir = path.join(dataDir, "runtime-data", "media-processing-uploads", "acceptance");
await mkdir(uploadDir, { recursive: true });
const inputFilePath = path.join(uploadDir, "source.png");
await writeFile(inputFilePath, onePixelPng);

const group = createMediaProcessingAbilityGroupFromFilesystem({ dataDir });
const result = await group.processMedia({
  missionId: "media-processing-latest-dependencies-acceptance",
  runId: "media-processing-latest-dependencies-run",
  inputFilePath,
  presetId: "web-image",
  outputFormat: "webp",
  quality: 82,
});

assert.equal(result.status, "success", "Public media processing must pass the latest dependency gate before child work.");
if (result.output.status !== "success") {
  throw new Error("Latest dependency gate acceptance did not produce a success result.");
}
const [artifact] = result.output.outputArtifacts;
assert.ok(artifact, "Latest dependency gate acceptance must produce an artifact.");
await stat(artifact.filePath);

process.stdout.write("[ACCEPTANCE][media-processing-latest-dependencies] PASS\n");
