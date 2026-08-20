import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const source = (repoPath: string): Promise<string> => readFile(path.join(process.cwd(), repoPath), "utf8");

const exists = async (repoPath: string): Promise<boolean> => {
  try {
    await access(path.join(process.cwd(), repoPath));
    return true;
  } catch {
    return false;
  }
};

const retiredPaths = [
  "src/lib/browser/browser-controller.ts",
  "src/lib/browser/current-chrome-browser-controller.ts",
  "src/lib/browser/current-chrome-browser-controller-runtime.ts",
  "src/lib/browser/exact-target/browser-command-runtime.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-model-identity.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-chat-title.ts",
  "src/capabilities/ai-input-gateway/runtime/web-chat-system-title.ts",
  "src/capabilities/ai-input-gateway/runtime/web-chat-title-housekeeping.ts",
] as const;

const activeSources = {
  browserApi: "src/lib/browser/browser-authority-api.ts",
  targetLease: "src/lib/browser/exact-target/browser-target-lease.ts",
  domIntent: "src/lib/browser/exact-target/browser-dom-intent.ts",
  domRuntime: "src/lib/browser/chrome-extension/dom-intent-runtime.ts",
  nativeActor: "src/lib/browser/chrome-extension/native-port-actor.ts",
  routing: "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-routing.ts",
  answer: "src/capabilities/ai-input-gateway/providers/web-chat-answer-support.ts",
  attachment: "src/capabilities/ai-input-gateway/providers/web-chat-exact-target-file-input-attachment.ts",
  attachmentPreflight: "src/capabilities/ai-input-gateway/providers/web-chat-upload-page-actions.ts",
} as const;

const readActiveSources = async (): Promise<Record<keyof typeof activeSources, string>> => {
  const entries = await Promise.all(Object.entries(activeSources).map(async ([key, repoPath]) => [key, await source(repoPath)] as const));
  return Object.fromEntries(entries) as Record<keyof typeof activeSources, string>;
};

const assertNoRetiredPaths = async (): Promise<void> => {
  assert.deepEqual(
    await Promise.all(retiredPaths.map(exists)),
    retiredPaths.map(() => false),
    "the retired Browser controller/session chain must be physically absent",
  );
};

const assertBrowserBoundary = (sources: Record<keyof typeof activeSources, string>): void => {
  assert.ok(
    sources.browserApi.includes("BrowserTargetLease")
      && sources.targetLease.includes("executionBindingHash")
      && sources.targetLease.includes("agentJobRefHash")
      && sources.targetLease.includes("writerFenceHash")
      && sources.targetLease.includes("executeDomIntent")
      && sources.targetLease.includes("attachFile")
      && !sources.browserApi.includes("BrowserTargetSession"),
    "AI must receive an authority-bound exact target lease, never a controller/session object",
  );
  assert.ok(
    sources.domIntent.includes('kind: "document"')
      && sources.domIntent.includes('kind: "find"')
      && sources.domIntent.includes('kind: "click"')
      && sources.domIntent.includes("expectedMatches")
      && !sources.domIntent.includes("evaluate"),
    "Browser DOM access must be a finite, uniqueness-aware command set",
  );
  assert.ok(
    sources.domRuntime.includes("DOM.querySelectorAll")
      && sources.domRuntime.includes("Page.getNavigationHistory")
      && sources.domRuntime.includes("Input.dispatchMouseEvent")
      && !sources.domRuntime.includes("Runtime.evaluate")
      && !sources.domRuntime.includes("new Function"),
    "the extension must use fixed DevTools DOM methods rather than a page-script surface",
  );
  assert.ok(
    sources.nativeActor.includes("controller-command")
      && sources.nativeActor.includes("claimOperatorTarget")
      && sources.nativeActor.includes("sourceChannelToken")
      && !sources.nativeActor.includes("tabs.query"),
    "the native actor must bind only the operator-claimed target and authenticated command channel",
  );
};

const assertObservedChatGptActions = (sources: Record<keyof typeof activeSources, string>): void => {
  assert.ok(
    sources.routing.includes("focusChatGptConversationByCanonicalPath")
      && sources.routing.includes("executeDomIntent")
      && sources.routing.includes("CHATGPT_CANONICAL_CONVERSATION_IDENTITY_AMBIGUOUS")
      && sources.routing.includes("Search-dialog recovery is not")
      && !sources.routing.includes(".evaluate("),
    "canonical routing must use exact path/marker instructions and fail closed for unobserved search UI",
  );
  assert.ok(
    sources.answer.includes("conversation-turn-")
      && sources.answer.includes("turnOrdinal")
      && sources.answer.includes("executeDomIntent")
      && !sources.answer.includes(".evaluate("),
    "answer capture must bind the marked user turn to its immediately following assistant turn without arbitrary evaluation",
  );
  assert.ok(
    sources.attachment.includes("#upload-files")
      && sources.attachment.includes("issueBrowserFileArtifactGrant")
      && sources.attachment.includes("attachFile")
      && sources.attachment.includes("NOT_PRODUCTION_VERIFIED")
      && !sources.attachment.includes("setFileInputFiles"),
    "attachment selection must use one opaque-grant batch and may not claim unobserved post-selection proof",
  );
  assert.ok(
    sources.attachmentPreflight.includes("#prompt-textarea")
      && sources.attachmentPreflight.includes("#upload-files")
      && sources.attachmentPreflight.includes("WEB_CHAT_COMPOSER_NOT_EMPTY")
      && !sources.attachmentPreflight.includes(".evaluate("),
    "attachment preflight must preserve an unknown draft and inspect only the observed composer/input topology",
  );
};

export const assertWebChatSourceContracts = async (): Promise<void> => {
  await assertNoRetiredPaths();
  const sources = await readActiveSources();
  assertBrowserBoundary(sources);
  assertObservedChatGptActions(sources);
};
