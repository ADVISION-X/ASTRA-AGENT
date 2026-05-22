import { createHash } from "node:crypto";

import {
  createVideoDownloadAbilityGroup,
} from "../../src/capabilities/video-download/index.js";
import type { BrowserMediaSourcePort } from "../../src/capabilities/video-download/ports/browser-media-source-port.js";
import type {
  VideoArtifactStoragePort,
  WriteVideoArtifactInput,
} from "../../src/capabilities/video-download/ports/video-artifact-storage-port.js";

const mp4Bytes = new Uint8Array([
  0x00, 0x00, 0x00, 0x18,
  0x66, 0x74, 0x79, 0x70,
  0x69, 0x73, 0x6f, 0x6d,
  0x00, 0x00, 0x00, 0x00,
  0x69, 0x73, 0x6f, 0x6d,
  0x6d, 0x70, 0x34, 0x32,
]);

const toBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64");

const baseInput = {
  abilityGroupId: "video-download" as const,
  childCapabilityId: "download-telegram-web-video-once" as const,
  missionId: "mission-telegram",
  runId: "run-telegram",
  capabilityCallId: "call-telegram",
  sourcePageUrl: "https://web.telegram.org/a/#-1000000000000",
};

const createStorage = (): VideoArtifactStoragePort => ({
  async writeVideoArtifact(input: WriteVideoArtifactInput) {
    return {
      artifactRef: `artifact:${input.artifactId}`,
      storageRef: `storage:${input.artifactId}`,
      filePath: `/tmp/${input.artifactId}${input.extension}`,
      sha256: createHash("sha256").update(input.bytes).digest("hex"),
      artifactDisposition: input.artifactDisposition ?? "final",
    };
  },
  async promoteVideoArtifact(input) {
    return input.artifact;
  },
  async deleteVideoArtifact() {
    return undefined;
  },
});

const createBrowser = (result: unknown): BrowserMediaSourcePort => ({
  async evaluateActiveTab<T>() {
    return result as T;
  },
});

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message);
};

const successBrowser = createBrowser({
  ok: true,
  status: "success",
  candidateKind: "telegram_sw_progressive_cache",
  documentId: "6088993264596164353",
  contentType: "video/mp4",
  byteSize: mp4Bytes.length,
  ranges: [{ start: 0, end: mp4Bytes.length - 1, byteLength: mp4Bytes.length, total: mp4Bytes.length }],
  bytesBase64: toBase64(mp4Bytes),
});

const successGroup = createVideoDownloadAbilityGroup({
  browserMediaSourcePort: successBrowser,
  artifactStoragePort: createStorage(),
});
const successResult = await successGroup.execute(baseInput);
assert(successResult.status === "success", "Telegram Web complete cache should produce success.");
assert(successResult.output.status === "success", "Telegram Web output should be success.");
if (successResult.output.status !== "success") {
  throw new Error("Telegram Web output did not narrow to success.");
}
assert(successResult.output.platformId === "telegram-web", "Telegram Web platformId should be telegram-web.");
assert(successResult.output.candidateKind === "telegram_sw_progressive_cache", "Telegram Web candidateKind should prove cache chain.");
assert(successResult.output.byteSize === mp4Bytes.length, "Telegram Web byte size should match cached media.");
assert(successResult.output.videoId?.startsWith("telegram-document-"), "Telegram Web video id should be redacted.");

const reviewGroup = createVideoDownloadAbilityGroup({
  browserMediaSourcePort: createBrowser({
    ok: false,
    status: "review_required",
    failureReason: "candidate_not_found",
    reason: "Telegram Web media cache exists but does not cover one complete contiguous video.",
  }),
  artifactStoragePort: createStorage(),
});
const reviewResult = await reviewGroup.execute(baseInput);
assert(reviewResult.status === "review_required", "Incomplete Telegram Web cache should request review.");
assert(reviewResult.failureReason === "candidate_not_found", "Incomplete cache should report candidate_not_found.");

const invalidHostResult = await successGroup.execute({
  ...baseInput,
  sourcePageUrl: "https://telegram.org/",
});
assert(invalidHostResult.status === "invalid_input", "Non web.telegram.org sources should be invalid.");

console.log("video-download telegram-web acceptance: PASS");
