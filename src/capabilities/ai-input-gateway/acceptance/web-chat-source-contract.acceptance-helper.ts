import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { decideGeneratedImageAssistantTurn } from "../providers/web-chat-generated-image-capture.js";
import { CHATGPT_FRESH_CONVERSATION_SCRIPT } from "../providers/web-chat-fresh-conversation-script.js";
import { buildClearProvenSubmittedRootDraftScript } from "../providers/web-chat-page-action-scripts.js";
import { isRoutableWebChatSubmission } from "../runtime/web-chat-single-tab-browser.js";

const sourceText = (repoPath: string): Promise<string> =>
  readFile(path.join(process.cwd(), repoPath), "utf8");

const exists = async (repoPath: string): Promise<boolean> => {
  try {
    await access(path.join(process.cwd(), repoPath));
    return true;
  } catch {
    return false;
  }
};

const retiredTitlePaths = [
  "src/capabilities/ai-input-gateway/providers/web-chat-chat-title.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-chat-title-scripts.ts",
  "src/capabilities/ai-input-gateway/runtime/web-chat-system-title.ts",
  "src/capabilities/ai-input-gateway/runtime/web-chat-title-housekeeping.ts",
  "src/capabilities/ai-input-gateway/runtime/web-chat-title-housekeeping-worker.ts",
  "src/capabilities/ai-input-gateway/runtime/web-chat-named-conversation-search.ts",
  "src/capabilities/ai-input-gateway/acceptance/web-chat-rename-patrol.acceptance-helper.ts",
] as const;

const sourcePaths = {
  routing: "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-routing.ts",
  executionState: "src/capabilities/ai-input-gateway/runtime/web-chat-execution-state.ts",
  managedExecution: "src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution.ts",
  managedExecutionStart: "src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution-start.ts",
  feedProviderOnce: "src/capabilities/ai-input-gateway/runtime/feed-provider-once.ts",
  operatorControl: "src/capabilities/ai-input-gateway/runtime/provider-operator-control.ts",
  answerEvaluation: "src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts",
  answerSupport: "src/capabilities/ai-input-gateway/providers/web-chat-answer-support.ts",
  exactTargetRef: "src/lib/browser/exact-target/browser-target-ref.ts",
  exactTargetRuntime: "src/lib/browser/exact-target/browser-command-runtime.ts",
  singleTabBrowser: "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-browser.ts",
  searchDialogHygiene: "src/capabilities/ai-input-gateway/providers/web-chat-search-dialog-hygiene.ts",
  submit: "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts",
  browserProtocol: "src/lib/browser/chrome-extension/protocol.ts",
  extensionWorker: "src/lib/browser/chrome-extension/service-worker.ts",
  generatedImageCapture: "src/capabilities/ai-input-gateway/providers/web-chat-generated-image-capture.ts",
  freshConversationControl: "src/capabilities/ai-input-gateway/providers/web-chat-fresh-conversation.ts",
  freshConversationState: "src/capabilities/ai-input-gateway/providers/web-chat-fresh-conversation-script.ts",
  pageActionScripts: "src/capabilities/ai-input-gateway/providers/web-chat-page-action-scripts.ts",
  canonicalBinding: "src/capabilities/ai-input-gateway/runtime/web-chat-canonical-binding.ts",
  providerOpen: "src/capabilities/ai-input-gateway/providers/web-chat-open.ts",
} as const;

type SourceContracts = Record<keyof typeof sourcePaths, string>;

const loadSourceContracts = async (): Promise<SourceContracts> => {
  const entries = await Promise.all(Object.entries(sourcePaths).map(async ([key, repoPath]) => [
    key,
    await sourceText(repoPath),
  ] as const));
  return Object.fromEntries(entries) as SourceContracts;
};

const assertScriptContracts = (): void => {
  assert.doesNotThrow(
    () => new Function(CHATGPT_FRESH_CONVERSATION_SCRIPT),
    "the exact fresh-conversation template must remain executable after string interpolation",
  );
  assert.doesNotThrow(
    () => new Function(buildClearProvenSubmittedRootDraftScript(
      "GRASSEYE_TURN_0123456789abcdef0123456789abcdef",
    )),
    "the guarded stale-draft clear template must remain executable after string interpolation",
  );
};

const assertRetiredPaths = async (): Promise<void> => {
  assert.deepEqual(
    await Promise.all(retiredTitlePaths.map(exists)),
    retiredTitlePaths.map(() => false),
    "provider title mutation, routing, recovery and acceptance files must be physically absent",
  );
};

const assertFreshConversationControlContract = (sources: SourceContracts): void => {
  assert.ok(
    sources.freshConversationControl.includes('a[data-testid="create-new-chat-button"][data-sidebar-item="true"]')
      && sources.freshConversationControl.includes('pointerEvents === "none"')
      && sources.freshConversationControl.includes("hitAnchor === element")
      && sources.freshConversationControl.includes("href.pathname !== providerRoot.pathname")
      && !sources.freshConversationControl.includes("exactAriaCandidates")
      && !sources.freshConversationControl.includes("selected = candidates"),
    "fresh ChatGPT reset must select one actionable exact sidebar control and must not fall back to aria-only trailing actions",
  );
};

const assertFreshConversationDraftContract = (sources: SourceContracts): void => {
  assert.ok(
    sources.freshConversationControl.includes("clearUniquelyOwnedSubmittedRootDraft")
      && sources.freshConversationControl.includes("resolveSubmittedDraftOwnerByTurnMarker")
      && sources.freshConversationControl.includes("owner.matchCount !== 1")
      && sources.freshConversationControl.includes("protected unknown or unproven draft")
      && sources.freshConversationState.includes("eligibleSubmittedDraftCleanup")
      && sources.freshConversationState.includes("internalMarkerMentionCount === 1")
      && sources.pageActionScripts.includes("owned stale draft guard changed before clear")
      && sources.pageActionScripts.includes("markers[0] === expectedTurnMarker")
      && sources.canonicalBinding.includes("candidate.submission?.canonicalConversationUrl")
      && sources.canonicalBinding.includes("matches.length === 1 ? matches[0]!")
      && sources.providerOpen.includes("emitStage: (stage) => emitSubmitStage(")
      && !sources.freshConversationControl.includes("clearComposer(input.browser"),
    "root draft cleanup must require one exact internal marker, one different durable canonical owner, an atomic page guard and protection for unknown drafts",
  );
};

const assertFreshConversationContract = (sources: SourceContracts): void => {
  assertFreshConversationControlContract(sources);
  assertFreshConversationDraftContract(sources);
};

const assertRuntimeHasNoTitleBridge = (sources: SourceContracts): void => {
  for (const source of [
    sources.managedExecution,
    sources.managedExecutionStart,
    sources.feedProviderOnce,
    sources.operatorControl,
    sources.singleTabBrowser,
  ]) {
    assert.doesNotMatch(
      source,
      /systemChatTitle|chatTitleRename|renameSubmittedChatGptConversation|TitleHousekeeping/u,
      "live runtime must not retain a provider-title bridge",
    );
  }
};

const assertRoutingContract = (sources: SourceContracts): void => {
  assert.equal(
    sources.routing.includes("focusChatGptConversationByCanonicalPath")
      && sources.routing.includes('new URL(link.getAttribute("href")')
      && sources.routing.includes("location.pathname === targetPath")
      && !sources.routing.includes("markerCount > 1")
      && sources.routing.includes("Number(right.actionable) - Number(left.actionable)")
      && sources.routing.includes("left.rect.top - right.rect.top")
      && sources.routing.includes("scroll exact canonical ChatGPT sidebar row into view")
      && !sources.routing.includes("textContent) === expectedTitle")
      && !sources.routing.includes("searchAndOpenNamedConversation"),
    true,
    "GPT routing must bind the exact canonical href and use a deterministic visible click without title search",
  );
};

const assertIdentityAndTargetContracts = (sources: SourceContracts): void => {
  assert.equal(
    sources.executionState.includes("_retiredRenameDebt")
      && sources.executionState.includes("_retiredSubmissionTitle")
      && !sources.executionState.includes("buildHumanReadableSystemChatTitle")
      && !sources.executionState.includes("WebChatTitleRenameState"),
    true,
    "old JSON title fields may only be ignored while new execution state remains title-free",
  );
  assert.equal(
    sources.answerEvaluation.includes("visibleProgressClass")
      && sources.answerEvaluation.includes("[class*='shimmer']")
      && sources.answerSupport.includes("WEB_CHAT_BOUND_CONVERSATION_NOT_READY"),
    true,
    "live generation and temporarily unavailable canonical rows must stay distinct",
  );
  assert.equal(
    sources.exactTargetRef.includes("BrowserTargetRef")
      && sources.exactTargetRef.includes("BrowserDocumentRef")
      && sources.exactTargetRuntime.includes("BrowserTargetRegistry")
      && sources.exactTargetRuntime.includes("createTargetSession")
      && sources.singleTabBrowser.includes("BrowserTargetSession")
      && !sources.singleTabBrowser.includes("focusSingleProviderTab"),
    true,
    "web chat must stay bound to one exact extension target and document",
  );
};

const assertRoutableSubmissionContract = (sources: SourceContracts): void => {
  const fixture = {
    executionId: "transient-routing-acceptance",
    turnMarker: "GRASSEYE_TURN_transient_routing_acceptance",
    transientConversationUrl: "https://chatgpt.com/c/WEB:transient-routing-acceptance",
    canonicalConversationUrl: null,
    userTurnId: "conversation-turn-1",
    previousAssistantCount: 0,
    previousUserMessageCount: 0,
    submittedAt: new Date().toISOString(),
  };
  assert.equal(
    isRoutableWebChatSubmission(fixture),
    false,
    "a transient WEB submission receipt must prevent resubmission without becoming a route identity",
  );
  assert.equal(isRoutableWebChatSubmission({
    ...fixture,
    canonicalConversationUrl: "https://chatgpt.com/c/canonical-routing-acceptance",
  }), true, "only a verified canonical conversation may become routable");
  assert.equal(
    sources.singleTabBrowser.includes("if (!isRoutableWebChatSubmission(state.submission)) return;")
      && sources.singleTabBrowser.includes("submission: isRoutableWebChatSubmission(input.resumeSubmission)")
      && (sources.singleTabBrowser.match(
        /if \(isRoutableWebChatSubmission\(submission\) state\.submission = submission;/gu,
      )?.length ?? 0) === 2,
    true,
    "single-tab routing must exclude transient WEB receipts at route, bind and restart boundaries",
  );
};

const assertRestartAndSearchContracts = (sources: SourceContracts): void => {
  assert.equal(
    sources.routing.includes('reusePolicy: "reuse-exact-url"')
      && sources.browserProtocol.includes('"reuse-exact-url"')
      && sources.extensionWorker.includes('command.reusePolicy === "reuse-exact-url"')
      && sources.extensionWorker.includes("TARGET_AMBIGUOUS:multiple exact URL tabs")
      && sources.extensionWorker.indexOf("chrome.tabs.create({ url: command.url, active: false })")
        < sources.extensionWorker.indexOf("return readDescriptor(tabId);"),
    true,
    "restart recovery must bind the exact canonical URL and ignore unrelated same-origin tabs",
  );
  assert.equal(
    sources.searchDialogHygiene.includes("CHATGPT_SEARCH_DIALOG_AMBIGUOUS")
      && sources.searchDialogHygiene.includes("CHATGPT_SEARCH_DIALOG_CLOSE_AMBIGUOUS")
      && sources.searchDialogHygiene.includes("CHATGPT_SEARCH_DIALOG_STILL_VISIBLE")
      && sources.submit.includes("dismissChatGptSearchDialogIfVisible")
      && !sources.submit.includes("dismissFloatingMenus")
      && !sources.submit.includes('new KeyboardEvent("keydown"'),
    true,
    "prompt entry may close only the exact harmless search dialog and never use Escape as universal cleanup",
  );
};

const assertGeneratedImageContract = (sources: SourceContracts): void => {
  assert.equal(
    sources.generatedImageCapture.includes('[data-testid^="conversation-turn-"][data-turn="user"], [data-testid^="conversation-turn-"][data-turn="assistant"]')
      && sources.generatedImageCapture.includes("generatedImageTurnHasSubstantiveContent")
      && sources.generatedImageCapture.includes("target instanceof HTMLElement")
      && sources.generatedImageCapture.includes('button[aria-label="保存"]')
      && !sources.generatedImageCapture.includes("target instanceof HTMLButtonElement")
      && !sources.generatedImageCapture.includes("data-message-author-role")
      && !sources.generatedImageCapture.includes('article[data-testid^="conversation-turn"')
      && !sources.generatedImageCapture.includes('label === "download"')
      && !sources.generatedImageCapture.includes('label === "下载"'),
    true,
    "generated image capture must use only the current outer Chrome turn and exact zh-CN viewer save identities without a legacy selector bridge",
  );
  assert.deepEqual(
    decideGeneratedImageAssistantTurn([
      { role: "user", promptMatched: true, substantive: true },
      { role: "assistant", promptMatched: false, substantive: true },
      { role: "assistant", promptMatched: false, substantive: false },
    ]),
    { status: "success", message: "exact generated-image assistant turn located", assistantIndex: 1 },
  );
  assert.equal(
    decideGeneratedImageAssistantTurn([
      { role: "user", promptMatched: true, substantive: true },
      { role: "assistant", promptMatched: false, substantive: false },
    ]).status,
    "pending",
  );
  for (const fixture of [
    [
      { role: "user" as const, promptMatched: true, substantive: true },
      { role: "user" as const, promptMatched: true, substantive: true },
      { role: "assistant" as const, promptMatched: false, substantive: true },
    ],
    [
      { role: "user" as const, promptMatched: true, substantive: true },
      { role: "user" as const, promptMatched: false, substantive: true },
    ],
    [
      { role: "user" as const, promptMatched: true, substantive: true },
      { role: "assistant" as const, promptMatched: false, substantive: true },
      { role: "user" as const, promptMatched: false, substantive: true },
    ],
  ]) {
    assert.equal(decideGeneratedImageAssistantTurn(fixture).status, "review_required");
  }
};

export const assertWebChatSourceContracts = async (): Promise<void> => {
  assertScriptContracts();
  const sources = await loadSourceContracts();
  await assertRetiredPaths();
  assertFreshConversationContract(sources);
  assertRuntimeHasNoTitleBridge(sources);
  assertRoutingContract(sources);
  assertIdentityAndTargetContracts(sources);
  assertRoutableSubmissionContract(sources);
  assertRestartAndSearchContracts(sources);
  assertGeneratedImageContract(sources);
};
