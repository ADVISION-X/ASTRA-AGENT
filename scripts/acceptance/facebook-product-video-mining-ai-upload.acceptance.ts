import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

import { judgeFacebookProductVideo } from "../../src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";

const judgeSource = readFileSync("src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts", "utf8");
const webChatSource = readFileSync("src/capabilities/ai-input-gateway/providers/web-chat-shared.ts", "utf8");
const webChatEvaluationSource = readFileSync("src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts", "utf8");
const webChatOpenSource = readFileSync("src/capabilities/ai-input-gateway/providers/web-chat-open.ts", "utf8");
const webChatPageActionsSource = readFileSync("src/capabilities/ai-input-gateway/providers/web-chat-page-actions.ts", "utf8");
const webChatSubmitSource = readFileSync("src/capabilities/ai-input-gateway/providers/web-chat-submit.ts", "utf8");
const uploadSource = readFileSync("src/capabilities/ai-input-gateway/providers/web-chat-upload.ts", "utf8");
const uploadPageActionsSource = readFileSync("src/capabilities/ai-input-gateway/providers/web-chat-upload-page-actions.ts", "utf8");
const workspaceSource = readFileSync("src/capabilities/ai-input-gateway/providers/web-chat-workspace.ts", "utf8");
const roundOutcomesSource = readFileSync("src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-outcomes.ts", "utf8");
const roundSource = readFileSync("src/plugins/facebook-product-video-mining/facebook-product-video-mining.round.ts", "utf8");

assert.match(judgeSource, /inputRefs:\s*\[/u);
assert.match(judgeSource, /filePath:\s*input\.videoFilePath/u);
assert.match(judgeSource, /mimeType:\s*"video\/mp4"/u);
assert.match(webChatSource, /pasteFilesViaClipboard/u);
assert.doesNotMatch(webChatSource, /setFileInputFiles/u);
assert.match(webChatSource, /ensureProviderWorkspaceFocused/u);
assert.match(workspaceSource, /startsWith\("focused"\)/u);
assert.match(webChatOpenSource, /allowAnyProviderTab:\s*false/u);
assert.match(workspaceSource, /allowAnyProviderTab:\s*false/u);
assert.match(webChatOpenSource, /saveWorkspaceUrl/u);
assert.doesNotMatch(workspaceSource, /lowerTitle contains/u);
assert.match(webChatPageActionsSource, /MAX_ATTACHMENT_COUNT_WAIT_MS\s*=\s*15_000/u);
assert.match(webChatPageActionsSource, /waitForAttachmentCountAtLeast/u);
assert.match(webChatPageActionsSource, /waitForComposerFocused/u);
assert.match(webChatSubmitSource, /MAX_SUBMIT_BUTTON_WAIT_MS\s*=\s*45_000/u);
assert.match(webChatSubmitSource, /verify_attachments_before_submit/u);
assert.doesNotMatch(webChatSubmitSource, /setComposerText|set_prompt_text_after_paste_miss/u);
assert.match(uploadSource, /CLIPBOARD_UPLOAD_TIMEOUT_MS\s*=\s*20_000/u);
assert.match(uploadSource, /CLIPBOARD_PASTE_RETRY_LIMIT\s*=\s*3/u);
assert.match(uploadSource, /copyFileObjectToMacClipboard/u);
assert.match(uploadSource, /pasteMacClipboardIntoChrome/u);
assert.match(uploadSource, /waitForAttachmentCountAtLeast/u);
assert.match(uploadSource, /waitForComposerFocused/u);
assert.match(uploadSource, /for \(const \[index, ref\] of refs\.entries\(\)\)/u);
assert.doesNotMatch(uploadSource, /uploadLocatedFileInput/u);
assert.doesNotMatch(uploadSource, /setProviderFileInputWithTimeout/u);
assert.doesNotMatch(uploadSource, /waitForUploadTarget/u);
assert.doesNotMatch(uploadSource, /openProviderUploadMenu/u);
assert.doesNotMatch(uploadSource, /setFileInputFiles/u);
assert.doesNotMatch(uploadSource, /waitForUploadComplete/u);
assert.doesNotMatch(uploadPageActionsSource, /input\[type='file'\]|buildFindUploadTargetScript|buildWaitForUploadScript|waitForUploadTarget|waitForUploadComplete/u);
assert.match(roundOutcomesSource, /terminal:\s*true,\s*reason:\s*input\.judgment\.reason/u);
assert.match(roundSource, /timeoutMs:\s*90_000/u);
assert.match(webChatSource, /waitForStableAnswer/u);
assert.match(webChatSource, /STABLE_ROUNDS_REQUIRED\s*=\s*2/u);
assert.match(webChatEvaluationSource, /data-message-author-role='assistant'/u);
assert.match(webChatEvaluationSource, /\[class\*='model-response'\]/u);
assert.match(webChatEvaluationSource, /aria-busy="true"/u);
assert.match(webChatEvaluationSource, /main article|data-testid\*='conversation'|role='presentation'/u);
assert.match(webChatEvaluationSource, /thinking|reasoning|回答中|生成中|思考中/u);
assert.doesNotMatch(uploadSource, /chooseFileInNativeDialog/u);
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
  runtimeLogger: createRuntimeLogger({ terminalEnabled: false }),
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
