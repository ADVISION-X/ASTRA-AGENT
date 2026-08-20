import assert from "node:assert/strict";

import {
  createUnavailableVideoDownloadAbilityGroup,
  type BrowserPageObservationPort,
} from "../index.js";

const requiredFlags = [
  "--require-named-observation",
  "--reject-create-target-session",
  "--reject-evaluate",
  "--reject-script-fallback",
] as const;
for (const flag of requiredFlags) {
  assert.ok(process.argv.includes(flag), `Missing required Browser authority assertion: ${flag}`);
}

const impossibleObservation: BrowserPageObservationPort = {
  observeUniversalVideoCandidates: async () => { throw new Error("BROWSER_HOST_UNAVAILABLE"); },
  observeFacebookVideoCandidates: async () => { throw new Error("BROWSER_HOST_UNAVAILABLE"); },
  observeTikTokVideoCandidates: async () => { throw new Error("BROWSER_HOST_UNAVAILABLE"); },
  observeTelegramWebCache: async () => { throw new Error("BROWSER_HOST_UNAVAILABLE"); },
};

assert.deepEqual(Object.keys(impossibleObservation).sort(), [
  "observeFacebookVideoCandidates",
  "observeTelegramWebCache",
  "observeTikTokVideoCandidates",
  "observeUniversalVideoCandidates",
]);
const unavailable = createUnavailableVideoDownloadAbilityGroup();
assert.deepEqual(unavailable.listChildCapabilityIds(), []);
await assert.rejects(
  () => unavailable.downloadVideo({
    missionId: "blocked-browser-mission",
    runId: "blocked-browser-run",
    sourcePageUrl: "https://example.invalid/",
    platform: "universal",
  }),
  /BROWSER_HOST_UNAVAILABLE/u,
);
console.log("VIDEO_DOWNLOAD_BROWSER_AUTHORITY_ACCEPTANCE_PASS");
