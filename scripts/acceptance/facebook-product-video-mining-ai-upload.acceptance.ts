import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

import { judgeFacebookProductVideo } from "../../src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.js";

const judgeSource = readFileSync("src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts", "utf8");
const webChatSource = readFileSync("src/capabilities/ai-input-gateway/providers/web-chat-shared.ts", "utf8");

assert.match(judgeSource, /inputRefs:\s*\[/u);
assert.match(judgeSource, /filePath:\s*input\.videoFilePath/u);
assert.match(judgeSource, /mimeType:\s*"video\/mp4"/u);
assert.match(webChatSource, /setFileInputFiles/u);
assert.match(webChatSource, /waitForStableAnswer/u);
assert.match(webChatSource, /STABLE_ROUNDS_REQUIRED\s*=\s*3/u);
assert.doesNotMatch(judgeSource, /providers\/gpt-web-chat|providers\/gemini-web-chat/u);

let aborted = false;
const judgment = await judgeFacebookProductVideo({
  aiInputGateway: {
    abilityGroupId: "ai-input-gateway",
    listChildCapabilityIds: () => ["feed-gpt-web-chat-once"],
    execute: (_input, options) => {
      options?.signal?.addEventListener("abort", () => {
        aborted = true;
      });
      return new Promise(() => undefined);
    },
  },
  providerKind: "gpt-web-chat",
  missionId: "facebook_mission_timeout_acceptance",
  runId: "facebook_run_timeout_acceptance",
  roundId: "facebook_round_timeout_acceptance",
  probe: {
    status: "success",
    sourcePageUrl: "https://www.facebook.com/reel/2161128771300430",
    pageTitle: "Facebook",
    facebookVideoId: "2161128771300430",
    videoElementFacts: [],
    primaryVideoFact: null,
    likeCount: null,
    commentCountDisplayed: null,
    shareCountDisplayed: null,
    authorText: null,
    captionText: null,
    commentEntryElementRef: null,
    moreMenuElementRef: null,
    notInterestedElementRef: null,
    nextVideoElementRef: null,
    likeCountElementRef: null,
    commentCountElementRef: null,
    rawDomSignalsSummary: { matchedTexts: [], blockerReasons: [], candidateCounts: [] },
    blocker: null,
    capturedAt: new Date().toISOString(),
  },
  comments: [],
  videoFilePath: "/tmp/facebook-timeout-acceptance.mp4",
  timeoutMs: 10,
  maxFileBytes: 200_000_000,
});
assert.equal(aborted, true);
assert.equal(judgment.status, "review_required");
assert.equal(judgment.selectedOptionId, "UNCERTAIN");
assert.equal(judgment.reason, "ai_feed_timeout_after_10ms");

process.stdout.write("[facebook-product-video-mining-ai-upload] PASS\n");
