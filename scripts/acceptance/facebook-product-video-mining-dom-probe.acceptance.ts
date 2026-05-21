import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const scriptPath = "scripts/acceptance/facebook-live-dom-probe.ts";
assert.equal(existsSync(scriptPath), true);
const source = readFileSync(scriptPath, "utf8");
assert.doesNotMatch(source, /document\.cookie|localStorage|sessionStorage|outerHTML|innerHTML/u);
assert.match(source, /facebook-live-dom-probe-latest\.json/u);
assert.match(source, /visibleVideoCount/u);
assert.match(source, /notInterested/u);

const latestPath = ".grasseye-local/debug/facebook-live-dom-probe-latest.json";
if (existsSync(latestPath)) {
  const probe = JSON.parse(readFileSync(latestPath, "utf8")) as {
    realPageUrl?: string;
    host?: string;
    visibleVideoCount?: number;
    blocker?: string | null;
  };
  assert.ok(probe.realPageUrl);
  assert.match(probe.host ?? "", /^(www\.)?facebook\.com$/u);
  assert.equal(typeof probe.visibleVideoCount, "number");
}

process.stdout.write("[facebook-product-video-mining-dom-probe] PASS\n");
