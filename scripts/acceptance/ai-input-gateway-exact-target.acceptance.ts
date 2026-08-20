import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { Project, SyntaxKind } from "ts-morph";

assert.equal(existsSync("src/capabilities/ai-input-gateway/runtime/web-chat-single-provider-tab.ts"), false);
assert.equal(existsSync("src/capabilities/ai-input-gateway/providers/web-chat-fork-tab-control.ts"), false);
const project = new Project({ tsConfigFilePath: "tsconfig.json" });
const source = project.getSourceFile("src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-browser.ts");
assert.ok(source, "Exact-target browser adapter must be present.");
const identifiers = new Set(source.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()));
assert.equal(identifiers.has("BrowserTargetSession"), false);
assert.equal(identifiers.has("BrowserTargetLease"), true);
assert.equal(identifiers.has("focusSingleProviderTab"), false);
assert.equal(identifiers.has("evaluateActiveTab"), false);
assert.equal(identifiers.has("osascript"), false);
assert.equal(identifiers.has("frontmost"), false);
process.stdout.write("[ai-input-gateway-exact-target] PASS\n");
