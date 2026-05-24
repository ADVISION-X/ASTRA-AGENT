import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { downloadWebChatPptxArtifact } from "../../src/capabilities/ai-input-gateway/providers/web-chat-artifact-download.js";
import { detectPptxArtifactInWebChatResponse } from "../../src/capabilities/ai-input-gateway/providers/web-chat-artifact-detector.js";

const dataDir = mkdtempSync(path.join(tmpdir(), "grasseye-ai-ppt-download-"));
const artifactDir = path.join(dataDir, "artifacts");
mkdirSync(artifactDir, { recursive: true });

const sourcePptx = path.join(artifactDir, "generated-business-deck.pptx");
writeFileSync(sourcePptx, Buffer.from("pptx bytes"));

const candidate = detectPptxArtifactInWebChatResponse(`PPTX_ARTIFACT_PATH=${sourcePptx}`);
const success = downloadWebChatPptxArtifact({
  candidate,
  outputPath: path.join(dataDir, "exports", "business-deck.ai.pptx"),
});
assert(success.ok, "PPTX artifact download must succeed.");
assert(success.filePath.endsWith(".pptx"), "Downloaded artifact must keep .pptx extension.");
assert(success.fileHash.startsWith("sha256:"), "Downloaded artifact must record fileHash.");
assert(success.fileSizeBytes > 0, "Downloaded artifact must record fileSizeBytes.");

const missing = downloadWebChatPptxArtifact({
  candidate: null,
  outputPath: path.join(dataDir, "missing.pptx"),
});
assert(!missing.ok && missing.status === "deck_pptx_artifact_missing");

const nonPptx = path.join(artifactDir, "notes.txt");
writeFileSync(nonPptx, "not a pptx");
const invalid = downloadWebChatPptxArtifact({
  candidate: {
    artifactName: "notes.txt",
    artifactMimeType: "text/plain",
    sourcePath: nonPptx,
  },
  outputPath: path.join(dataDir, "invalid.txt"),
});
assert(!invalid.ok && invalid.status === "deck_pptx_invalid_file");

const failed = downloadWebChatPptxArtifact({
  candidate: {
    artifactName: "missing.pptx",
    artifactMimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    sourcePath: path.join(dataDir, "does-not-exist.pptx"),
  },
  outputPath: path.join(dataDir, "failed.pptx"),
});
assert(!failed.ok && failed.status === "deck_pptx_download_failed");

process.stdout.write("[ACCEPTANCE][deep-research-ai-ppt-download] PASS\n");
