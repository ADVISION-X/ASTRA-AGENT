import assert from "node:assert/strict";

import { BrowserTerminalError } from "../../src/lib/browser/exact-target/browser-command-contract.js";
import { BrowserTargetRegistry } from "../../src/lib/browser/exact-target/browser-target-registry.js";

const descriptor = (loaderId: string, url = "https://example.com/a") => ({
  tabId: 7, windowId: 2, url, title: "fixture", frameId: "frame", loaderId,
  viewportWidth: 1200, viewportHeight: 800, deviceScaleFactor: 2,
  active: false, windowFocused: false,
});

const registry = new BrowserTargetRegistry("controller-a");
const target = registry.register("fixture-owner", descriptor("loader-1"));
assert.equal(target.targetRef.startsWith("bt_"), true);
assert.equal(target.documentRef.startsWith("bd_"), true);
assert.equal(JSON.stringify(target).includes("tabId"), false, "raw Chrome ids must stay private");
assert.equal(registry.resolve(target.targetRef, target.documentRef).descriptor.tabId, 7);

const navigated = registry.updateDocument(target.targetRef, descriptor("loader-2"));
assert.notEqual(navigated.documentRef, target.documentRef);
assert.throws(
  () => registry.resolve(target.targetRef, target.documentRef),
  (error) => error instanceof BrowserTerminalError && error.code === "DOCUMENT_STALE",
);

registry.close(target.targetRef);
assert.throws(
  () => registry.resolve(target.targetRef),
  (error) => error instanceof BrowserTerminalError && error.code === "TARGET_CLOSED",
);
process.stdout.write("[local-browser-exact-target-contract] PASS\n");
