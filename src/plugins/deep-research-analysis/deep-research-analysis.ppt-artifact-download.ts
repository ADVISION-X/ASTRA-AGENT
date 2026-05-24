import { createHash } from "node:crypto";
import path from "node:path";

import {
  downloadWebChatPptxArtifact,
  detectPptxArtifactInWebChatResponse,
  type WebChatPptxDownloadSuccess,
} from "../../capabilities/ai-input-gateway/index.js";
import {
  buildFailure,
  type DeepResearchParserResult,
} from "./deep-research-analysis.parser-support.js";

export type DeepResearchBusinessPptArtifactRecord = WebChatPptxDownloadSuccess & {
  status: "deck_pptx_ai_generated";
  exportKind: "business-deck.ai-pptx";
};

export const buildBusinessPptArtifactOutputPath = (
  dataDir: string,
  jobId: string,
): string => path.join(
  dataDir,
  "deep-research-analysis",
  "exports",
  jobId,
  "business-deck.ai.pptx",
);

export const parseAndDownloadBusinessPptArtifact = (input: {
  rawText: string;
  outputPath: string;
}): DeepResearchParserResult<DeepResearchBusinessPptArtifactRecord> => {
  const normalizedText = input.rawText.trim();
  const rawResponseHash = "sha256:" + createHash("sha256").update(normalizedText, "utf8").digest("hex");
  const candidate = detectPptxArtifactInWebChatResponse(normalizedText);
  const result = downloadWebChatPptxArtifact({
    candidate,
    outputPath: input.outputPath,
  });
  if (!result.ok) {
    return buildFailure(
      normalizedText,
      rawResponseHash,
      result.status,
      "partial_review_required",
    );
  }
  return {
    parseStatus: "parsed",
    parsed: {
      ...result,
      status: "deck_pptx_ai_generated",
      exportKind: "business-deck.ai-pptx",
    },
    normalizedText,
    rawResponseHash,
  };
};
