import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { isRoutableWebChatSubmission } from "../runtime/web-chat-single-tab-browser.js";

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
  extensionSocket: "src/lib/browser/chrome-extension/websocket-actor.ts",
  extensionTarget: "src/lib/browser/chrome-extension/extension-target-authority.ts",
  transportAuthenticator: "src/lib/browser/transport/transport-authenticator.ts",
  routing: "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-routing.ts",
  answer: "src/capabilities/ai-input-gateway/providers/web-chat-answer-support.ts",
  attachment: "src/capabilities/ai-input-gateway/providers/web-chat-exact-target-file-input-attachment.ts",
  attachmentPreflight: "src/capabilities/ai-input-gateway/providers/web-chat-upload-page-actions.ts",
  freshConversation: "src/capabilities/ai-input-gateway/providers/web-chat-fresh-conversation.ts",
  submissionState: "src/capabilities/ai-input-gateway/providers/web-chat-submit-page-actions.ts",
  resume: "src/capabilities/ai-input-gateway/providers/web-chat-resume.ts",
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

const assertAuthorityBoundLease = (sources: Record<keyof typeof activeSources, string>): void => {
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
};

const assertFiniteDomIntent = (sources: Record<keyof typeof activeSources, string>): void => {
  assert.ok(
    sources.domIntent.includes('kind: "document"')
      && sources.domIntent.includes('kind: "find"')
      && sources.domIntent.includes('kind: "click"')
      && sources.domIntent.includes("expectedMatches")
      && !sources.domIntent.includes("evaluate"),
    "Browser DOM access must be a finite, uniqueness-aware command set",
  );
};

const assertFixedDevtoolsRuntime = (sources: Record<keyof typeof activeSources, string>): void => {
  assert.ok(
    sources.domRuntime.includes("DOM.querySelectorAll")
      && sources.domRuntime.includes("Page.getNavigationHistory")
      && sources.domRuntime.includes("Input.dispatchMouseEvent")
      && !sources.domRuntime.includes("Runtime.evaluate")
      && !sources.domRuntime.includes("new Function"),
    "the extension must use fixed DevTools DOM methods rather than a page-script surface",
  );
};

const assertNativeTargetBinding = (sources: Record<keyof typeof activeSources, string>): void => {
  assert.ok(
    sources.extensionSocket.includes('const SOCKET_URL = "ws://127.0.0.1:4173/browser-authority/v1"')
      && sources.extensionSocket.includes("acquireJobBoundChatGptTarget")
      && sources.extensionSocket.includes('frame.kind === "TARGET_ACQUIRE"')
      && sources.extensionTarget.includes("debugger.getTargets")
      && sources.extensionTarget.includes("GPT_WEB_CHAT_START_URL")
      && sources.extensionTarget.includes("claimOperatorTarget")
      && sources.extensionTarget.includes("tabs.create")
      && !sources.extensionTarget.includes("tabs.query")
      && sources.transportAuthenticator.includes("sourceChannelToken"),
    "the single authenticated extension socket must bind only the fixed preauthorized exact ChatGPT target",
  );
};

const assertBrowserBoundary = (sources: Record<keyof typeof activeSources, string>): void => {
  assertAuthorityBoundLease(sources);
  assertFiniteDomIntent(sources);
  assertFixedDevtoolsRuntime(sources);
  assertNativeTargetBinding(sources);
};

const assertObservedChatGptActions = (sources: Record<keyof typeof activeSources, string>): void => {
  assert.ok(
    sources.routing.includes("focusChatGptConversationByCanonicalPath")
      && sources.routing.includes("executeDomIntent")
      && sources.routing.includes("CHATGPT_CANONICAL_CONVERSATION_IDENTITY_AMBIGUOUS")
      && sources.routing.includes("discoverChatGptConversationViaSearch")
      && sources.routing.includes("Search chats fallback")
      && !sources.routing.includes(".evaluate("),
    "canonical routing must use exact path/marker instructions and the observed bounded Search chats dialog",
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
      && sources.attachment.includes("detectedFileCount: 0")
      && !sources.attachment.includes("setFileInputFiles"),
    "attachment selection must use one opaque-grant batch and may not claim unobserved post-selection proof",
  );
  assert.ok(
    sources.attachmentPreflight.includes("#prompt-textarea")
      && sources.attachmentPreflight.includes("form:has(#prompt-textarea)")
      && sources.attachmentPreflight.includes("WEB_CHAT_COMPOSER_NOT_EMPTY")
      && sources.attachmentPreflight.includes("ATTACHMENT_SURFACE_CONTRACT_MISMATCH")
      && sources.attachmentPreflight.includes("CHATGPT_ATTACHMENT_SURFACE_EMPTY")
      && sources.attachmentPreflight.includes("observeExactAttachmentSet")
      && !sources.attachmentPreflight.includes("#upload-files")
      && !sources.attachmentPreflight.includes("#composer-submit-button")
      && !sources.attachmentPreflight.includes("button[aria-label")
      && !sources.attachmentPreflight.includes("while (")
      && !sources.attachmentPreflight.includes(".evaluate("),
    "attachment flow must use one visible deterministic-name surface decision without delete-button or polling denominators",
  );
};

const assertSerialProviderBrowserActions = (sources: Record<keyof typeof activeSources, string>): void => {
  for (const sourceKey of ["freshConversation", "attachmentPreflight", "submissionState", "resume"] as const) {
    assert.equal(
      sources[sourceKey].includes("Promise.all(") || sources[sourceKey].includes("Promise.allSettled("),
      false,
      `${sourceKey} must await BrowserTargetLease commands serially instead of bypassing the single browser mutation lane`,
    );
  }
};

const assertTransientSubmissionDoesNotRoute = (): void => {
  const base = {
    transientConversationUrl: "https://chatgpt.com/c/WEB:submitted",
    userTurnId: "conversation-turn-1",
    previousAssistantCount: 0,
    previousUserMessageCount: 0,
    submittedAt: new Date().toISOString(),
  };
  assert.equal(
    isRoutableWebChatSubmission({ ...base, canonicalConversationUrl: "https://chatgpt.com/c/WEB:submitted" }),
    false,
    "a transient WEB submission receipt must prevent resubmission without becoming a route identity",
  );
  assert.equal(
    isRoutableWebChatSubmission({ ...base, canonicalConversationUrl: "https://chatgpt.com/c/canonical" }),
    true,
    "only a verified canonical conversation may become routable",
  );
  assert.equal(
    isRoutableWebChatSubmission({ ...base, canonicalConversationUrl: "not-a-url" }),
    false,
    "an invalid provider URL must never become routable",
  );
};

export const assertWebChatSourceContracts = async (): Promise<void> => {
  await assertNoRetiredPaths();
  const sources = await readActiveSources();
  assertBrowserBoundary(sources);
  assertObservedChatGptActions(sources);
  assertSerialProviderBrowserActions(sources);
  assertTransientSubmissionDoesNotRoute();
};
