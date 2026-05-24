import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import type { WebChatArtifactCandidate } from "./web-chat-artifact-detector.js";
import {
  WEB_CHAT_PPTX_MIME_TYPE,
  calculateFileSha256,
  validateWebChatPptxCandidate,
} from "./web-chat-download-support.js";

export type WebChatPptxDownloadSuccess = {
  ok: true;
  artifactName: string;
  artifactMimeType: string;
  filePath: string;
  fileHash: string;
  fileSizeBytes: number;
  downloadedAt: string;
};

export type WebChatPptxDownloadFailure = {
  ok: false;
  status:
    | "deck_pptx_artifact_missing"
    | "deck_pptx_download_failed"
    | "deck_pptx_invalid_file";
  failureReason: string;
};

export type WebChatPptxDownloadResult =
  | WebChatPptxDownloadSuccess
  | WebChatPptxDownloadFailure;

export const downloadWebChatPptxArtifact = (input: {
  candidate: WebChatArtifactCandidate | null;
  outputPath: string;
}): WebChatPptxDownloadResult => {
  if (!input.candidate) {
    return {
      ok: false,
      status: "deck_pptx_artifact_missing",
      failureReason: "deck_pptx_artifact_missing",
    };
  }
  const validationStatus = validateWebChatPptxCandidate(input.candidate);
  if (validationStatus) {
    return {
      ok: false,
      status: validationStatus,
      failureReason: validationStatus,
    };
  }
  try {
    mkdirSync(path.dirname(input.outputPath), { recursive: true });
    copyFileSync(input.candidate.sourcePath, input.outputPath);
    const bytes = readFileSync(input.outputPath);
    const stat = statSync(input.outputPath);
    if (stat.size <= 0) {
      return {
        ok: false,
        status: "deck_pptx_invalid_file",
        failureReason: "deck_pptx_invalid_file",
      };
    }
    return {
      ok: true,
      artifactName: input.candidate.artifactName,
      artifactMimeType: input.candidate.artifactMimeType ?? WEB_CHAT_PPTX_MIME_TYPE,
      filePath: input.outputPath,
      fileHash: calculateFileSha256(bytes),
      fileSizeBytes: stat.size,
      downloadedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      status: "deck_pptx_download_failed",
      failureReason: error instanceof Error ? error.message : "deck_pptx_download_failed",
    };
  }
};
