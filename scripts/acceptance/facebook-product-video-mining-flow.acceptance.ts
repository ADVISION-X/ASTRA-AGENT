import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const flowSource = readFileSync("src/plugins/facebook-product-video-mining/facebook-product-video-mining.flow.ts", "utf8");
const roundSource = readFileSync("src/plugins/facebook-product-video-mining/facebook-product-video-mining.round.ts", "utf8");
const roundOutcomesSource = readFileSync("src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-outcomes.ts", "utf8");
const serverSource = readFileSync("src/app/workbench-facebook-routes.ts", "utf8");
const videoSource = readFileSync("src/plugins/facebook-product-video-mining/facebook-product-video-mining.video.ts", "utf8");

assert.match(flowSource, /savedProductCount\s*>=\s*(?:run|input\.run)\.targetProductCount/u);
assert.match(flowSource, /runFacebookMiningRound/u);
assert.match(roundSource, /downloadCurrentFacebookVideo/u);
assert.match(roundSource, /judgeFacebookProductVideo/u);
assert.match(roundOutcomesSource, /clickFacebookNotInterested/u);
assert.match(flowSource, /createFacebookProductVideoMiningStorage/u);
assert.match(videoSource, /artifactDisposition:\s*"staging"/u);
assert.match(videoSource, /promoteArtifact/u);
assert.match(videoSource, /deleteArtifact/u);
assert.match(serverSource, /POST:\/api\/facebook-product-video-mining\/mission/u);
assert.match(serverSource, /GET:\/api\/facebook-product-video-mining\/run/u);
assert.match(serverSource, /GET:\/api\/facebook-product-video-mining\/latest/u);

process.stdout.write("[facebook-product-video-mining-flow] PASS\n");
