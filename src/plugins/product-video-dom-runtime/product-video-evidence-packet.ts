import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { DomSnapshot } from "../../capabilities/dom-automation/index.js";
import type {
  ProductVideoCommentDetail,
  ProductVideoEvidenceRecord,
  ProductVideoJudgeOutput,
} from "./product-video-dom.schema.js";
import {
  extractExternalLinkVisible,
  extractProductLinkVisible,
  extractProductVideoEngagement,
  extractProductVideoVisitId,
  extractShopEntryVisible,
  parseProductVideoCount,
} from "./product-video-dom-extractor.js";
import { extractCommentCountText } from "./product-video-comment-extractor.js";
import {
  extractProductVideoAuthor,
  extractProductVideoDescription,
  extractProductVideoHashtags,
  extractProductVideoTitle,
} from "./product-video-dom-text.js";

const rawDomDirectory = (dataDir: string, missionId: string): string =>
  path.join(dataDir, "runtime-data", "product-video-dom-artifacts", missionId);

export const saveProductVideoRawDomSnapshot = (input: {
  dataDir: string;
  missionId: string;
  roundId: string;
  snapshot: DomSnapshot;
}): string => {
  const directory = rawDomDirectory(input.dataDir, input.missionId);
  mkdirSync(directory, { recursive: true });
  const filePath = path.join(directory, `${input.roundId}-dom-snapshot.json`);
  writeFileSync(filePath, JSON.stringify(input.snapshot, null, 2));
  return filePath;
};

const buildRecordTextFields = (snapshot: DomSnapshot) => ({
  titleText: extractProductVideoTitle(snapshot) ?? null,
  descriptionText: extractProductVideoDescription(snapshot) ?? null,
  authorText: extractProductVideoAuthor(snapshot) ?? null,
  hashtags: extractProductVideoHashtags(snapshot),
});

const buildRecordEngagementFields = (snapshot: DomSnapshot) => {
  const engagement = extractProductVideoEngagement(snapshot);
  const commentsText = engagement.commentsText ?? extractCommentCountText(snapshot) ?? null;
  return {
    likesText: engagement.likesText ?? null,
    likesCount: parseProductVideoCount(engagement.likesText),
    commentsText,
    commentsCount: parseProductVideoCount(commentsText),
    sharesText: engagement.sharesText ?? null,
    sharesCount: parseProductVideoCount(engagement.sharesText),
  };
};

const buildRecordVisibilityFields = (snapshot: DomSnapshot) => ({
  productLinkVisible: extractProductLinkVisible(snapshot),
  shopEntryVisible: extractShopEntryVisible(snapshot),
  externalLinkVisible: extractExternalLinkVisible(snapshot),
});

export const buildProductVideoEvidenceRecord = (input: {
  id: string;
  missionId: string;
  runId: string;
  roundId: string;
  platformId: string;
  snapshot: DomSnapshot;
  screenshotStatus: "success" | "failed";
  screenshotRef: string | null;
  screenshotPath: string | null;
  commentFetchStatus: ProductVideoEvidenceRecord["commentFetchStatus"];
  commentDetails: ProductVideoCommentDetail[];
  aiJudge: ProductVideoJudgeOutput;
  rawDomEvidenceRef: string | null;
  evidenceRefs: string[];
}): ProductVideoEvidenceRecord => ({
    id: input.id,
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    platformId: input.platformId,
    pageUrl: input.snapshot.url,
    videoVisitId: extractProductVideoVisitId(input.snapshot),
    capturedAt: new Date().toISOString(),
    screenshotStatus: input.screenshotStatus,
    screenshotRef: input.screenshotRef,
    screenshotPath: input.screenshotPath,
    ...buildRecordTextFields(input.snapshot),
    ...buildRecordEngagementFields(input.snapshot),
    ...buildRecordVisibilityFields(input.snapshot),
    commentFetchStatus: input.commentFetchStatus,
    commentDetails: input.commentDetails,
    aiJudge: input.aiJudge,
    rawDomEvidenceRef: input.rawDomEvidenceRef,
    evidenceRefs: input.evidenceRefs,
  });
