import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routeSource = readFileSync("src/app/workbench-video-download-routes.ts", "utf8");
const mediatorSource = readFileSync("src/mediator/video-download-artifact-route.ts", "utf8");
const flowSource = readFileSync("src/plugins/video-download-artifact/video-download-artifact.flow.ts", "utf8");
const schemaSource = readFileSync("src/plugins/video-download-artifact/video-download-artifact.schema.ts", "utf8");
const videoInspectorSource = readFileSync("scripts/audit/domains/video-download-capability/inspector.ts", "utf8");
const appInspectorSource = readFileSync("scripts/audit/domains/local-app-shell/inspector.ts", "utf8");

assert.match(routeSource, /routeVideoDownloadArtifactJob/u);
assert.doesNotMatch(routeSource, /getVideoDownloadAbilityGroup\(\)\.execute/u);
assert.match(mediatorSource, /VideoDownloadArtifactJobInputSchema/u);
assert.match(mediatorSource, /runVideoDownloadArtifactFlow/u);
assert.match(flowSource, /videoDownload\.execute/u);
assert.match(flowSource, /jobType:\s*"video-download-artifact"/u);
assert.match(schemaSource, /download-youtube-video-once/u);
assert.match(schemaSource, /preferredQuality/u);
assert.match(schemaSource, /downloadSubtitles/u);
assert.match(videoInspectorSource, /direct-app-ability-call/u);
assert.match(appInspectorSource, /video-download-direct-ability-call/u);

process.stdout.write("[video-download-artifact-flow] PASS\n");
