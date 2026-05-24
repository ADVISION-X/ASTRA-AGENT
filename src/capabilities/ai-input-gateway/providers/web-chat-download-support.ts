import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

import type { WebChatArtifactCandidate } from "./web-chat-artifact-detector.js";

export type WebChatPptxValidationStatus =
  | "deck_pptx_invalid_file"
  | "deck_pptx_download_failed";

export const WEB_CHAT_PPTX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export const isPptxFileName = (fileName: string): boolean =>
  path.extname(fileName).toLowerCase() === ".pptx";

export const calculateFileSha256 = (bytes: Buffer): string =>
  "sha256:" + createHash("sha256").update(bytes).digest("hex");

export const validateWebChatPptxCandidate = (
  candidate: WebChatArtifactCandidate,
): WebChatPptxValidationStatus | null => {
  if (!isPptxFileName(candidate.artifactName) || !isPptxFileName(candidate.sourcePath)) {
    return "deck_pptx_invalid_file";
  }
  if (!existsSync(candidate.sourcePath)) {
    return "deck_pptx_download_failed";
  }
  const stat = statSync(candidate.sourcePath);
  return stat.size > 0 ? null : "deck_pptx_invalid_file";
};
