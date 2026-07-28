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
};

const sourceText = (repoPath: string): Promise<string> =>
  readFile(path.join(process.cwd(), repoPath), "utf8");

const loadContractSources = async (): Promise<ContractSources> => {
  const values = await Promise.all([
    sourceText(
      "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts",
    ),
    sourceText(
      "src/capabilities/ai-input-gateway/providers/web-chat-chat-title.ts",
    ),
    sourceText(
      "src/capabilities/ai-input-gateway/providers/web-chat-chat-title-scripts.ts",
    ),
    sourceText(
      "src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts",
    ),
    sourceText(
      "src/capabilities/ai-input-gateway/providers/web-chat-rate-limit-dialog.ts",
    ),
    sourceText(
      "src/capabilities/ai-input-gateway/providers/web-chat-answer-support.ts",
    ),
    sourceText(
      "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-routing.ts",
    ),
    sourceText(
      "src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution.ts",
    ),
  ]);
  return {
    shared: values[0],
    title: values[1],
    titleScripts: values[2],
    answerEvaluation: values[3],
    rateLimitWatcher: values[4],
    answerSupport: values[5],
    singleTabRouting: values[6],
    managedExecution: values[7],
  };
};

const assertRenameTiming = (sources: ContractSources): void => {
  const submitFlow = sources.shared.slice(
    sources.shared.indexOf("const executeWebChatConversation"),
    sources.shared.indexOf("const executeOpenedWebChatAdapter"),
  );
  const completedFlow = sources.shared.slice(
    sources.shared.indexOf("const buildCompletedWebChatResponse"),
    sources.shared.indexOf("const executeWebChatConversation"),
  );
  assert.equal(
    submitFlow.includes("renameSubmittedChatGptConversation"),
    false,
    "submission must release the browser mutation lane without waiting for rename",
  );
  assert.equal(
    completedFlow.includes("renameSubmittedChatGptConversation"),
    true,
    "the exact conversation must be renamed only after response completion",
  );
  assert.equal(
    sources.title.includes("runExclusivePatrol")
      && sources.title.includes("WEB_CHAT_RENAME_NOT_READY")
      && !sources.title.includes("rename patrol exhausted the task timeout"),
    true,
    "one completed-chat rename must stay atomic and transient rename UI must never become a terminal task-timeout failure",
  );
};

const assertRenameTargeting = (sources: ContractSources): void => {
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
      && sources.managedExecution.includes("runExclusivePatrol"),
    true,
    "submission priority, global survival and atomic rename patrol must be wired into managed execution",
  );
};

export const assertWebChatSourceContracts = async (): Promise<void> => {
  const sources = await loadContractSources();
  assertRenameTiming(sources);
  assertRenameTargeting(sources);
  assertProviderPatrol(sources);
  assertSharedScheduling(sources);
};
