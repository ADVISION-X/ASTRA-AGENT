import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const judgeSource = readFileSync("src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts", "utf8");
const webChatSource = readFileSync("src/capabilities/ai-input-gateway/providers/web-chat-shared.ts", "utf8");

assert.match(judgeSource, /inputRefs:\s*\[/u);
assert.match(judgeSource, /filePath:\s*input\.videoFilePath/u);
assert.match(judgeSource, /mimeType:\s*"video\/mp4"/u);
assert.match(webChatSource, /setFileInputFiles/u);
assert.match(webChatSource, /waitForStableAnswer/u);
assert.match(webChatSource, /STABLE_ROUNDS_REQUIRED\s*=\s*3/u);
assert.doesNotMatch(judgeSource, /providers\/gpt-web-chat|providers\/gemini-web-chat/u);

process.stdout.write("[facebook-product-video-mining-ai-upload] PASS\n");
