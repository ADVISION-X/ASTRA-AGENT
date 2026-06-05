import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import ffmpegStaticPath from "ffmpeg-static";
import {
  createMediaProcessingAbilityGroupFromFilesystem,
} from "../../src/capabilities/media-processing/index.js";

const runCommand = async (command: string, args: readonly string[]): Promise<void> => {
  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  assert.equal(exitCode, 0, `${command} ${args.join(" ")} must pass.`);
};

const commandExitsZero = async (command: string, args: readonly string[]): Promise<boolean> =>
  new Promise<boolean>((resolve) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.once("error", () => resolve(false));
    child.once("exit", (code) => resolve(code === 0));
  });

const findFixtureFfmpegPath = async (): Promise<string | null> => {
  if (typeof ffmpegStaticPath === "string") {
    try {
      await access(ffmpegStaticPath, constants.X_OK);
      return ffmpegStaticPath;
    } catch {
      return null;
    }
  }
  return await commandExitsZero("ffmpeg", ["-version"]) ? "ffmpeg" : null;
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
const fixtureFfmpegPath = await findFixtureFfmpegPath();
const uploadDir = path.join(dataDir, "runtime-data", "media-processing-uploads", "acceptance");
await mkdir(uploadDir, { recursive: true });
const inputFilePath = path.join(uploadDir, "source.mp4");
const portraitInputFilePath = path.join(uploadDir, "portrait-source.mp4");

if (fixtureFfmpegPath) {
  await runCommand(fixtureFfmpegPath, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=160x90:d=1",
    "-pix_fmt",
    "yuv420p",
    inputFilePath,
  ]);
  await runCommand(fixtureFfmpegPath, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=green:s=720x1280:d=1",
    "-pix_fmt",
    "yuv420p",
    portraitInputFilePath,
  ]);
} else {
  await writeFile(inputFilePath, minimalMp4Header);
  await writeFile(portraitInputFilePath, minimalMp4Header);
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

if (result.status === "success") {
  assert.equal(result.status, "success");
  assert.equal(result.output.status, "success");
  if (result.output.status !== "success") {
    throw new Error("Video result did not narrow to success.");
  }
  const [artifact] = result.output.outputArtifacts;
  assert.ok(artifact, "Video processing must produce an artifact when ffmpeg is available.");
  assert.equal(artifact.derivativeKind, "video_optimized");
  assert.equal(artifact.format, "mp4");
  assert.ok(artifact.width !== null && artifact.width > 0, "Video artifact must include ffprobe width.");
  assert.ok(artifact.height !== null && artifact.height > 0, "Video artifact must include ffprobe height.");
  assert.ok(artifact.width <= 160, "Video output must honor requested maxWidth.");
  assert.ok(artifact.height <= 90, "Video output must honor requested maxHeight.");
  assert.ok(artifact.durationMs !== null && artifact.durationMs > 0, "Video artifact must include ffprobe duration.");
  assert.ok(artifact.videoCodec, "Video artifact must include ffprobe video codec.");
  assert.equal(typeof artifact.fastStart, "boolean", "Video artifact must include fastStart readiness proof.");
  assert.equal(artifact.fastStart, true, "Video fastStart must be verified by output atom order, not container name.");
  await stat(artifact.filePath);
  await stat(result.output.proofRef);
  assert.equal(result.output.proofRef, path.join(path.dirname(artifact.filePath), "proof.json"));

  const portraitResult = await group.processMedia({
    missionId: "media-processing-video-acceptance",
    runId: "media-processing-video-portrait-run",
    inputFilePath: portraitInputFilePath,
    childCapabilityId: "optimize-video-for-web-once",
    outputFormat: "mp4",
    maxWidth: 1280,
    maxHeight: 720,
    timeoutMs: 120_000,
  });
  assert.equal(portraitResult.status, "success");
  if (portraitResult.output.status !== "success") {
    throw new Error("Portrait video result did not narrow to success.");
  }
  const [portraitArtifact] = portraitResult.output.outputArtifacts;
  assert.ok(portraitArtifact, "Portrait video processing must produce an artifact.");
  assert.ok(portraitArtifact.width !== null && portraitArtifact.width <= 1280, "Portrait output must honor maxWidth.");
  assert.ok(portraitArtifact.height !== null && portraitArtifact.height <= 720, "Portrait output must honor maxHeight.");

  const compressed = await group.processMedia({
    missionId: "media-processing-video-acceptance",
    runId: "media-processing-video-compressed-run",
    inputFilePath,
    childCapabilityId: "compress-video-for-web-once",
    outputFormat: "mp4",
    maxWidth: 160,
    maxHeight: 90,
    targetBitrateKbps: 256,
    targetMaxBytes: 120_000,
    timeoutMs: 120_000,
  });
  assert.equal(compressed.status, "success");
  if (compressed.output.status !== "success") {
    throw new Error("Compressed video result did not narrow to success.");
  }
  const [compressedArtifact] = compressed.output.outputArtifacts;
  assert.ok(compressedArtifact, "Compressed video processing must produce an artifact.");
  assert.equal(compressedArtifact.derivativeKind, "video_compressed");
  assert.equal(compressedArtifact.targetMaxBytes, 120_000);
  assert.ok(compressedArtifact.targetBitrateKbps !== null && compressedArtifact.targetBitrateKbps <= 256);
  assert.ok(compressedArtifact.byteSize <= 120_000, "Compressed output must honor targetMaxBytes.");
  assert.ok(compressedArtifact.compressionRatio !== null && compressedArtifact.compressionRatio > 0, "Compressed output must include compression ratio.");

  const poster = await group.processMedia({
    missionId: "media-processing-video-acceptance",
    runId: "media-processing-video-poster-run",
    inputFilePath,
    childCapabilityId: "generate-video-poster-once",
    outputFormat: "png",
    maxWidth: 80,
    maxHeight: 80,
    timeoutMs: 120_000,
  });
  assert.equal(poster.status, "success");
  if (poster.output.status !== "success") {
    throw new Error("Poster result did not narrow to success.");
  }
  const [posterArtifact] = poster.output.outputArtifacts;
  assert.ok(posterArtifact, "Poster generation must produce an artifact.");
  assert.equal(posterArtifact.format, "png");
  assert.equal(posterArtifact.contentType, "image/png");
  assert.ok(posterArtifact.width !== null && posterArtifact.width <= 80, "Poster output must honor maxWidth.");
  assert.ok(posterArtifact.height !== null && posterArtifact.height <= 80, "Poster output must honor maxHeight.");
} else {
  assert.equal(result.status, "review_required");
  assert.equal(result.reviewRequiredReason, "Video processing requires the governed ffmpeg runtime before production transcode can run.");
}

process.stdout.write("[ACCEPTANCE][media-processing-video] PASS\n");
