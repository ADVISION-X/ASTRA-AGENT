import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

type ContractSources = {
  shared: string;
  title: string;
  titleScripts: string;
  answerEvaluation: string;
  rateLimitWatcher: string;
  answerSupport: string;
  singleTabRouting: string;
  managedExecution: string;
  managedExecutionStart: string;
  continuationTitle: string;
  executionState: string;
  searchDialogHygiene: string;
  namedConversationSearch: string;
  pageActions: string;
  submit: string;
  exactTargetRef: string;
  exactTargetRuntime: string;
  singleTabBrowser: string;
  abilityGroup: string;
  providerOperatorControl: string;
  feedProviderOnce: string;
  titleHousekeeping: string;
  titleHousekeepingWorker: string;
  recoveryAcceptance: string;
};

const sourceText = (repoPath: string): Promise<string> =>
  readFile(path.join(process.cwd(), repoPath), "utf8");

const contractSourcePaths = [
  "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-chat-title.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-chat-title-scripts.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-rate-limit-dialog.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-answer-support.ts",
  "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-routing.ts",
  "src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution.ts",
  "src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution-start.ts",
  "src/capabilities/ai-input-gateway/runtime/web-chat-continuation-title.ts",
  "src/capabilities/ai-input-gateway/runtime/web-chat-execution-state.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-search-dialog-hygiene.ts",
  "src/capabilities/ai-input-gateway/runtime/web-chat-named-conversation-search.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-page-actions.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts",
  "src/lib/browser/exact-target/browser-target-ref.ts",
  "src/lib/browser/exact-target/browser-command-runtime.ts",
  "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-browser.ts",
  "src/capabilities/ai-input-gateway/ability-group.ts",
  "src/capabilities/ai-input-gateway/runtime/provider-operator-control.ts",
  "src/capabilities/ai-input-gateway/runtime/feed-provider-once.ts",
  "src/capabilities/ai-input-gateway/runtime/web-chat-title-housekeeping.ts",
  "src/capabilities/ai-input-gateway/runtime/web-chat-title-housekeeping-worker.ts",
  "src/capabilities/ai-input-gateway/acceptance/web-chat-recovery.acceptance-helper.ts",
] as const;

const requiredSource = (values: readonly string[], index: number): string => {
  const value = values[index];
  if (value === undefined) throw new Error(`missing contract source ${index}`);
  return value;
};

const loadContractSources = async (): Promise<ContractSources> => {
  const values = await Promise.all(contractSourcePaths.map(sourceText));
  return {
    shared: requiredSource(values, 0),
    title: requiredSource(values, 1),
    titleScripts: requiredSource(values, 2),
    answerEvaluation: requiredSource(values, 3),
    rateLimitWatcher: requiredSource(values, 4),
    answerSupport: requiredSource(values, 5),
    singleTabRouting: requiredSource(values, 6),
    managedExecution: requiredSource(values, 7),
    managedExecutionStart: requiredSource(values, 8),
    continuationTitle: requiredSource(values, 9),
    executionState: requiredSource(values, 10),
    searchDialogHygiene: requiredSource(values, 11),
    namedConversationSearch: requiredSource(values, 12),
    pageActions: requiredSource(values, 13),
    submit: requiredSource(values, 14),
    exactTargetRef: requiredSource(values, 15),
    exactTargetRuntime: requiredSource(values, 16),
    singleTabBrowser: requiredSource(values, 17),
    abilityGroup: requiredSource(values, 18),
    providerOperatorControl: requiredSource(values, 19),
    feedProviderOnce: requiredSource(values, 20),
    titleHousekeeping: requiredSource(values, 21),
    titleHousekeepingWorker: requiredSource(values, 22),
    recoveryAcceptance: requiredSource(values, 23),
  };
};

const assertRenameTargeting = (sources: ContractSources): void => {
  const renameTransaction = sources.title.slice(
    sources.title.indexOf("const runRenameTransaction"),
    sources.title.indexOf(
      "export const renameSubmittedChatGptConversation",
    ),
  );
  assert.equal(
    sources.titleScripts.includes("(?!WEB:)"),
    true,
    "transient ChatGPT WEB sidebar rows must never be rename targets",
  );
  assert.equal(
    sources.titleScripts.includes(
      'CHATGPT_CONVERSATION_ROW_SELECTOR = "li"',
    )
      && sources.titleScripts.includes(
        "link.closest(${JSON.stringify(CHATGPT_CONVERSATION_ROW_SELECTOR)})",
      ),
    true,
    "rename options must be scoped to the exact sidebar conversation row",
  );
  assert.equal(
    sources.titleScripts.includes("depth < 7"),
    false,
    "rename targeting must not climb into the page-header conversation menu",
  );
  assert.equal(
    sources.titleScripts.includes(
      "new URL(link.href, location.href).pathname === expectedPath",
    )
      && sources.titleScripts.includes(
        "titleLinks.length === ${String(proof.titleLinks)}",
      )
      && sources.titleScripts.includes(
        "markerCount === ${String(proof.markerCount)}",
      )
      && sources.titleScripts.includes(
        "currentPathMatches === ${JSON.stringify(proof.currentPathMatches)}",
      ),
    true,
    "rename verification must bind the exact canonical path, exact durable title and exact turn marker",
  );
  assert.equal(
    sources.titleScripts.includes("buildRenameMenuTargetScript")
      && sources.titleScripts.includes("aria-labelledby")
      && sources.titleScripts.includes("aria-controls")
      && sources.title.includes(
        "detect an interrupted exact-conversation rename menu",
      ),
    true,
    "an interrupted open rename menu must be resumed only when its trigger belongs to the exact canonical conversation row",
  );
  assert.equal(
    renameTransaction.indexOf("focusBoundWebChatConversation")
      < renameTransaction.indexOf("recoverOpenTitleEditor"),
    true,
    "restart rename recovery must prove the exact parent conversation before touching any open title editor",
  );
};

const assertDurableRenameHousekeeping = (
  sources: ContractSources,
): void => {
  assert.equal(
    sources.executionState.includes("WebChatTitleRenameState")
      && sources.executionState.includes("chatTitleRename")
      && sources.titleHousekeeping.includes(
        'record.status === "response_captured"',
      )
      && sources.titleHousekeeping.includes(
        'record.chatTitleRename?.status === "pending"',
      )
      && sources.titleHousekeeping.includes(
        "drainWebChatTitleHousekeeping",
      ),
    true,
    "published answers with an unverified title must remain explicit durable housekeeping debt",
  );
  assert.equal(
    sources.abilityGroup.includes("createProviderOperatorControl")
      && sources.abilityGroup.includes("operatorControl.ensureHousekeeping()")
      && sources.providerOperatorControl.includes(
        "scheduleWebChatTitleHousekeeping",
      )
      && sources.providerOperatorControl.includes("ensureHousekeeping();")
      && sources.providerOperatorControl.includes(
        "stopWebChatTitleHousekeeping",
      )
      && sources.feedProviderOnce.includes(
        "schedulePublishedTitleHousekeeping",
      )
      && sources.managedExecution.includes(
        "scheduleWebChatTitleHousekeeping",
      )
      && sources.titleHousekeepingWorker.includes(
        "runWebChatTitleHousekeepingNow",
      )
      && sources.titleHousekeepingWorker.includes(
        "setTimeout",
      )
      && sources.titleHousekeepingWorker.includes(
        "timer.unref()",
    ),
    true,
    "the provider operator owner, checkpoint recovery and post-publication failure must all reawaken one bounded durable rename worker",
  );
  assert.equal(
    sources.recoveryAcceptance.includes(
      "finishTitleHousekeepingAfterRestart",
    )
      && sources.recoveryAcceptance.includes(
        "drainWebChatTitleHousekeeping",
      )
      && sources.recoveryAcceptance.includes(
        'verified?.chatTitleRename?.status, "verified"',
      ),
    true,
    "acceptance must prove a checkpoint survives interruption and its rename debt completes after restart without another provider answer",
  );
};

const assertProviderPatrol = (sources: ContractSources): void => {
  assert.equal(
    sources.answerEvaluation.includes("visibleProgressClass")
      && sources.answerEvaluation.includes("[class*='shimmer']"),
    true,
    "a visible ChatGPT loading or shimmer progress node must keep the exact turn in generating state",
  );
  assert.equal(
    sources.answerSupport.includes("WEB_CHAT_BOUND_CONVERSATION_NOT_READY")
      && sources.singleTabRouting.includes(
        "WEB_CHAT_BOUND_CONVERSATION_NOT_READY",
      ),
    true,
    "an automatic sidebar row that has not materialized yet must remain retryable patrol state",
  );
  assert.equal(
    sources.singleTabRouting.includes('"scroll_title"')
      && sources.singleTabRouting.includes("scrollDeltaY")
      && sources.singleTabRouting.includes(
        "scroll exact submitted ChatGPT sidebar row into view",
      ),
    true,
    "an exact sidebar row outside the viewport must be physically scrolled into view before clicking",
  );
};

const assertSharedScheduling = (sources: ContractSources): void => {
  assert.equal(
    sources.rateLimitWatcher.includes("sharedAcknowledgementWatchers")
      && sources.rateLimitWatcher.includes("refCount"),
    true,
    "one shared immediate acknowledgement watcher must serve all managed conversations",
  );
  assert.equal(
    sources.managedExecution.includes("releasePendingSubmission")
      && sources.managedExecution.includes("globalBrowser")
      && sources.managedExecution.includes("runExclusivePatrol")
      && sources.managedExecutionStart.includes(
        "resolveContinuationWebChatSystemTitle",
      )
      && sources.continuationTitle.includes("earliestVerifiedTitle")
      && sources.continuationTitle.includes("verifiedAt"),
    true,
    "submission priority, global survival, atomic rename patrol and one inherited whole-order parent title must be wired into managed execution",
  );
};

const assertExactWindowStabilization = (sources: ContractSources): void => {
  assert.equal(
    sources.exactTargetRef.includes("BrowserTargetRef")
      && sources.exactTargetRef.includes("BrowserDocumentRef")
      && sources.exactTargetRuntime.includes("BrowserTargetRegistry")
      && sources.exactTargetRuntime.includes("createTargetSession")
      && sources.singleTabBrowser.includes("BrowserTargetSession")
      && !sources.singleTabBrowser.includes("focusSingleProviderTab"),
    true,
    "web chat must stay bound to one exact target and document identity without foreground focus",
  );
};

const assertExactSearchDialogHygiene = (sources: ContractSources): void => {
  assert.equal(
    sources.searchDialogHygiene.includes("CHATGPT_SEARCH_DIALOG_AMBIGUOUS")
      && sources.searchDialogHygiene.includes("CHATGPT_SEARCH_DIALOG_CLOSE_AMBIGUOUS")
      && sources.searchDialogHygiene.includes("CHATGPT_SEARCH_DIALOG_STILL_VISIBLE"),
    true,
    "search-dialog cleanup must identify one exact harmless overlay and verify its disappearance",
  );
  assert.equal(
    sources.namedConversationSearch.match(/dismissChatGptSearchDialogIfVisible/g)?.length === 3
      && sources.pageActions.includes("dismissChatGptSearchDialogIfVisible")
      && sources.submit.includes("dismissChatGptSearchDialogIfVisible"),
    true,
    "failed search, attachment upload and prompt focus must share exact search-dialog hygiene",
  );
  assert.equal(
    sources.submit.includes("dismissFloatingMenus")
      || sources.submit.includes("new KeyboardEvent(\"keydown\""),
    false,
    "provider actions must not use an unclassified Escape key as universal dialog cleanup",
  );
};

export const assertWebChatSourceContracts = async (): Promise<void> => {
  const sources = await loadContractSources();
  assertRenameTargeting(sources);
  assertDurableRenameHousekeeping(sources);
  assertProviderPatrol(sources);
  assertSharedScheduling(sources);
  assertExactWindowStabilization(sources);
  assertExactSearchDialogHygiene(sources);
};
