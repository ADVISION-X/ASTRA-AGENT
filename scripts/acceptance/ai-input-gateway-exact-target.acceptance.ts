import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { Project, SyntaxKind } from "ts-morph";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

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
const freshConversation = project.getSourceFile("src/capabilities/ai-input-gateway/providers/web-chat-fresh-conversation.ts");
assert.ok(freshConversation, "The governed fresh ChatGPT conversation owner must be present.");
const navigateAwait = freshConversation.getDescendantsOfKind(SyntaxKind.AwaitExpression)
  .find((node) => node.getExpression().getText().includes("input.browser.navigate"));
const guardedNavigation = navigateAwait?.getFirstAncestorByKind(SyntaxKind.IfStatement);
assert.ok(guardedNavigation?.getExpression().getText().includes("isExactFreshChatGptRoot"),
  "An already exact empty ChatGPT root must bypass navigation as a proved no-op.");
const firstWaitAwait = freshConversation.getDescendantsOfKind(SyntaxKind.AwaitExpression)
  .find((node) => node.getExpression().getText().includes("input.browser.wait"));
assert.ok(navigateAwait && firstWaitAwait && firstWaitAwait.getStart() > navigateAwait.getEnd(),
  "The first governed DOM read must have a bounded post-navigation stabilization wait.");
const freshLiterals = new Set(freshConversation.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralValue()));
assert.equal(freshLiterals.has("BROWSER_TARGET_INVALID"), true,
  "Transient hydrated-node invalidation must remain inside the existing bounded fresh-root observation loop.");
assert.equal(freshLiterals.has("WEB_CHAT_FRESH_CONVERSATION_HYDRATION_PENDING: BROWSER_TARGET_INVALID"), true,
  "Bounded hydrated-node exhaustion must preserve one explicit recoverable reason.");
process.stdout.write("[ai-input-gateway-exact-target] PASS\n");
emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-AI-INPUT-GATEWAY-002-V2", evidenceMode: "exam.golden", clauses: ["forbidden:0","forbidden:1","forbidden:2","forbidden:3","forbidden:4","forbidden:5","forbidden:6","summary"], locator: "acceptance:exact-target:caller-owned-lease", observedValue: "BrowserTargetLease exact-target atomic boundary verified" });
