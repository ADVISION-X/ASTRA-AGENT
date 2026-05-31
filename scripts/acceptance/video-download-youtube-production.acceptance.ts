import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const read = (path: string): string => readFileSync(path, "utf8");

const client = read("src/app/workbench-video-download-client.ts");
const route = read("src/app/workbench-video-download-routes.ts");
const runtime = read("src/capabilities/video-download/runtime/youtube-dlp-download.ts");
const child = read("src/capabilities/video-download/children/download-youtube-video-once.ts");
const policy = read("src/capabilities/video-download/runtime/youtube-dlp-policy.ts");
const abilityGroup = read("src/capabilities/video-download/ability-group.ts");
const binary = read("src/capabilities/video-download/runtime/youtube-dlp-binary.ts");
const workbench = read("src/lib/local-runtime/workbench.ts");

assert.match(policy, /YOUTUBE_DEFAULT_TIMEOUT_MS = 120_000/u);
assert.match(policy, /replace\(\/https\?:/u);
assert.match(policy, /drm_or_private_video/u);
assert.match(policy, /captcha_or_2fa_required/u);
assert.match(policy, /login_required/u);
assert.match(policy, /network_failed/u);
assert.match(client, /form\.preferredQuality\.value = "720p"/u);
assert.match(client, /requestTimeoutMs.*youtube.*120000/u);
assert.match(client, /setText\("\[data-evidence-ref\]"/u);
assert.match(route, /platform === "youtube" \? 120_000 : 3_600_000/u);
assert.match(runtime, /youtube metadata probe started/u);
assert.match(runtime, /youtubeMetadataTimeoutSeconds/u);
assert.match(runtime, /sanitizeYoutubeProgressLine/u);
assert.match(runtime, /YOUTUBE_PROCESS_KILL_GRACE_MS/u);
assert.match(child, /input\.downloaded\.failureReason/u);
assert.match(abilityGroup, /prepareVideoDownloadRuntimeDependencies/u);
assert.match(abilityGroup, /resolveYtDlpBinaryPath\(\{ refresh: process\.env\.GRASSEYE_YT_DLP_AUTO_UPDATE !== "0" \}\)/u);
assert.match(workbench, /await prepareVideoDownloadRuntimeDependencies\(\);/u);
assert.match(binary, /downloadFromGithub/u);
assert.match(binary, /resolveCachedLocalBinaryPath/u);
assert.match(binary, /input\.refresh === true/u);
assert.match(binary, /python3\.10/u);

const refreshBranchIndex = binary.indexOf("if (input.refresh === true)");
const systemBinaryIndex = binary.indexOf('canExecute("yt-dlp")');
assert.ok(refreshBranchIndex >= 0 && systemBinaryIndex > refreshBranchIndex, "startup refresh must prefer managed latest yt-dlp before PATH yt-dlp");

process.stdout.write("[ACCEPTANCE][video-download-youtube-production] PASS\n");
