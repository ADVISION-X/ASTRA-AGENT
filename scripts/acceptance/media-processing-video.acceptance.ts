import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createMediaProcessingAbilityGroupFromFilesystem,
  prepareMediaProcessingRuntimeDependencies,
} from "../../src/capabilities/media-processing/index.js";

const runCommand = async (command: string, args: readonly string[]): Promise<void> => {
  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  assert.equal(exitCode, 0, `${command} ${args.join(" ")} must pass.`);
};

const minimalMp4Header = new Uint8Array([
  0x00, 0x00, 0x00, 0x18,
  0x66, 0x74, 0x79, 0x70,
  0x69, 0x73, 0x6f, 0x6d,
  0x00, 0x00, 0x00, 0x00,
  0x69, 0x73, 0x6f, 0x6d,
  0x6d, 0x70, 0x34, 0x32,
]);

const dataDir = await mkdtemp(path.join(tmpdir(), "grasseye-media-processing-video-"));
const readiness = await prepareMediaProcessingRuntimeDependencies();
const inputFilePath = path.join(dataDir, "source.mp4");

if (readiness.video.available && readiness.video.ffmpegPath) {
  await runCommand(readiness.video.ffmpegPath, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=160x90:d=1",
    "-pix_fmt",
    "yuv420p",
    inputFilePath,
  ]);
} else {
  await writeFile(inputFilePath, minimalMp4Header);
}

const group = createMediaProcessingAbilityGroupFromFilesystem({ dataDir });
const result = await group.processMedia({
  missionId: "media-processing-video-acceptance",
  runId: "media-processing-video-run",
  inputFilePath,
  childCapabilityId: "optimize-video-for-web-once",
  outputFormat: "mp4",
  maxWidth: 160,
  maxHeight: 90,
  timeoutMs: 120_000,
});

if (readiness.video.available) {
  assert.equal(result.status, "success");
  assert.equal(result.output.status, "success");
  if (result.output.status !== "success") {
    throw new Error("Video result did not narrow to success.");
  }
  const [artifact] = result.output.outputArtifacts;
  assert.ok(artifact, "Video processing must produce an artifact when ffmpeg is available.");
  assert.equal(artifact.derivativeKind, "video_optimized");
  assert.equal(artifact.format, "mp4");
  await stat(artifact.filePath);
  await stat(path.join(path.dirname(artifact.filePath), "proof.json"));
} else {
  assert.equal(result.status, "review_required");
  assert.equal(result.reviewRequiredReason, "Video processing requires the governed ffmpeg runtime before production transcode can run.");
}

process.stdout.write("[ACCEPTANCE][media-processing-video] PASS\n");
