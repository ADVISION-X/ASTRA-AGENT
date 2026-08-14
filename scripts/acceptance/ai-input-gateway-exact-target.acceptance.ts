import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

assert.equal(existsSync("src/capabilities/ai-input-gateway/runtime/web-chat-single-provider-tab.ts"), false);
assert.equal(existsSync("src/capabilities/ai-input-gateway/providers/web-chat-fork-tab-control.ts"), false);
const source = readFileSync("src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-browser.ts", "utf8");
assert.equal(source.includes("BrowserTargetSession"), true);
assert.equal(source.includes("focusSingleProviderTab"), false);
assert.equal(source.includes("evaluateActiveTab"), false);
assert.equal(source.includes("osascript"), false);
assert.equal(source.includes("frontmost"), false);
process.stdout.write("[ai-input-gateway-exact-target] PASS\n");
