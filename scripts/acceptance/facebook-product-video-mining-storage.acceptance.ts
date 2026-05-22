import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

import {
  createFacebookProductVideoMiningStorage,
  FacebookProductVideoMiningSchemas,
} from "../../src/plugins/facebook-product-video-mining/index.js";

const dataDir = mkdtempSync(path.join(os.tmpdir(), "facebook-product-video-mining-"));
const now = new Date().toISOString();

try {
  const parsed = FacebookProductVideoMiningSchemas.FacebookProductVideoMiningMissionInputSchema.parse({
    targetProductCount: 1,
  });
  assert.equal(parsed.feedEntryUrl, "https://www.facebook.com/reels/");
  assert.equal(parsed.providerKind, "gpt-web-chat");
  assert.equal(parsed.modelName, null);
  assert.equal(parsed.maxMinutes, 20);
  assert.equal(parsed.maxRounds >= parsed.targetProductCount, true);
  assert.equal(parsed.notInterestedEnabled, false);
  const storage = createFacebookProductVideoMiningStorage(dataDir);
  const run = storage.createRun({
    ...parsed,
    missionId: "facebook_mission_acceptance",
    runId: "facebook_run_acceptance",
    modelName: null,
    startedAt: now,
  });
  assert.equal(run.runId, "facebook_run_acceptance");
  assert.equal(run.savedProductCount, 0);
  assert.equal(storage.getLatestRun()?.runId, run.runId);
  const saved = storage.saveCandidate({
    candidate: {
      id: "facebook_candidate_saved_acceptance",
      missionId: "facebook_mission_acceptance",
      runId: "facebook_run_acceptance",
      roundId: "facebook_round_saved_acceptance",
      roundIndex: 0,
      sourcePageUrl: "https://www.facebook.com/reel/2161128771300430",
      facebookVideoId: "2161128771300430",
      pageTitle: "Facebook",
      authorText: "creator",
      captionText: "product demo",
      likeCount: 10,
      commentCountDisplayed: 2,
      commentsLoadedCount: 2,
      commentsComplete: true,
      commentStopReason: null,
      aiSelectedOptionId: "PRODUCT_SEEDING",
      aiConfidence: 0.91,
      aiReason: "clear product recommendation",
      videoArtifactRef: "artifact://facebook/video",
      videoFilePath: "/tmp/facebook-video.mp4",
      videoSha256: "sha256",
      videoByteSize: 1234,
      videoContentType: "video/mp4",
      videoArtifactDisposition: "final",
      status: "saved",
      notInterestedStatus: null,
      createdAt: now,
      updatedAt: null,
    },
  });
  storage.saveAiJudgment({
    id: "facebook_ai_judgment_saved_acceptance",
    candidateId: saved.id,
    promptContractId: "facebook-product-video-mining.video-judge.v1",
    judgment: {
      providerKind: "gpt-web-chat",
      status: "success",
      selectedOptionId: "PRODUCT_SEEDING",
      confidence: 0.91,
      visibleProduct: "demo product",
      productCategory: "home",
      sellingIntentSignals: ["demo"],
      evidenceFromVideo: ["shows use"],
      reason: "clear product recommendation",
      rawOutputRef: null,
      rawOutputHash: null,
      normalizedText: null,
      parseStatus: "json_valid",
      schemaValidationStatus: "valid",
      providerProof: {
        providerKind: "gpt-web-chat",
        webChatUrl: null,
        sourcePageUrlBeforeFeed: null,
        restoredSourcePage: null,
        startedAt: now,
        endedAt: now,
        durationMs: 1,
        inputHash: "hash",
        outputHash: null,
      },
      createdAt: now,
    },
  });
  const exportPayload = storage.buildSelectionExport(storage.getRunStatus(run.runId)!);
  assert.equal(exportPayload.records.length, 1);
  assert.equal(exportPayload.records[0]?.candidateId, saved.id);
  assert.equal(exportPayload.records[0]?.visibleProduct, "demo product");
  storage.close();
  process.stdout.write("[facebook-product-video-mining-storage] PASS\n");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
