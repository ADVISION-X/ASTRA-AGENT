import { createHash } from "node:crypto";

import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  WebChatForkActionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import {
  focusChatGptConversationByCanonicalPath,
} from "../runtime/web-chat-single-tab-routing.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;

type ForkCheckpointObservation = {
  pageUrl: string;
  turns: Array<{
    turnId: string;
    role: "user" | "assistant";
    text: string;
  }>;
};

const checkpointHistoryFingerprint = (
  turns: ForkCheckpointObservation["turns"],
): `sha256:${string}` => hash(JSON.stringify(turns.map((turn) => ({
  role: turn.role,
  text: turn.text,
}))));

const emitForkStage = (input: {
  request: AiFeedInput;
  stage: string;
  status: "start" | "success" | "failed";
  startedAtMs: number;
  refs?: Record<string, unknown>;
}): void => {
  process.stdout.write(`${JSON.stringify({
    ts: new Date().toISOString(),
    marker: "[GRASSEYE][AI-GATEWAY][WEB-CHAT-FORK]",
    stage: input.stage,
    status: input.status,
    elapsedMs: Date.now() - input.startedAtMs,
    refs: {
      promptPackageId: input.request.promptPackageId,
      conversationScopeRef: input.request.conversationScopeRef,
      ...input.refs,
    },
  })}\n`);
};

const CHECKPOINT_OBSERVATION_SCRIPT = `
const normalize = (node) => (node instanceof HTMLElement ? node.innerText : node?.textContent || "")
  .replace(/\\s+/gu, " ")
  .trim();
const turns = Array.from(document.querySelectorAll("[data-testid^='conversation-turn-']"))
  .map((turn, index) => {
    const user = turn.querySelector("[data-message-author-role='user']");
    const assistant = turn.querySelector("[data-message-author-role='assistant']");
    const role = user ? "user" : assistant ? "assistant" : null;
    const node = user || assistant;
    return role && node ? {
      turnId: turn.getAttribute("data-testid") || "turn-" + String(index + 1),
      role,
      text: normalize(node),
    } : null;
  })
  .filter(Boolean);
return {pageUrl: location.href, turns};
`;

const OPEN_BRANCH_ACTION_SCRIPT = (assistantTurnId: string): string => `
const turnId = ${JSON.stringify(assistantTurnId)};
const visible = (element) => {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const label = (element) => [
  element.getAttribute("aria-label"),
  element.getAttribute("title"),
  element.textContent,
].filter(Boolean).join(" ").replace(/\\s+/gu, " ").trim();
const turn = Array.from(document.querySelectorAll("[data-testid^='conversation-turn-']"))
  .find((node) => node.getAttribute("data-testid") === turnId);
if (!(turn instanceof HTMLElement)) {
  return {status: "review_required", message: "CHATGPT_FORK_CHECKPOINT_TURN_MISSING", labels: []};
}
turn.scrollIntoView({block: "center"});
const direct = Array.from(turn.querySelectorAll("button,[role='button'],[role='menuitem']"))
  .filter(visible)
  .filter((element) => /branch in new chat|在新聊天中分支|新聊天中的分支|分支到新聊天/iu.test(label(element)));
if (direct.length === 1) {
  direct[0].click();
  return {status: "success", message: "clicked direct branch action", labels: direct.map(label)};
}
if (direct.length > 1) {
  return {status: "review_required", message: "CHATGPT_FORK_ACTION_AMBIGUOUS", labels: direct.map(label)};
}
const menus = Array.from(turn.querySelectorAll("button,[role='button']"))
  .filter(visible)
  .filter((element) => /more|更多|其他操作|actions/iu.test(label(element)));
if (menus.length !== 1) {
  return {
    status: "review_required",
    message: menus.length === 0 ? "CHATGPT_FORK_MENU_CONTROL_MISSING" : "CHATGPT_FORK_MENU_CONTROL_AMBIGUOUS",
    labels: menus.map(label),
  };
}
menus[0].click();
return {status: "menu_opened", message: "opened exact checkpoint action menu", labels: menus.map(label)};
`;

const CLICK_OPEN_BRANCH_MENU_SCRIPT = `
const visible = (element) => {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const label = (element) => [
  element.getAttribute("aria-label"),
  element.getAttribute("title"),
  element.textContent,
].filter(Boolean).join(" ").replace(/\\s+/gu, " ").trim();
const candidates = Array.from(document.querySelectorAll("[role='menuitem'],[data-radix-menu-content] button,[role='menu'] button"))
  .filter(visible)
  .filter((element) => /branch in new chat|在新聊天中分支|新聊天中的分支|分支到新聊天/iu.test(label(element)));
if (candidates.length !== 1) {
  return {
    status: "review_required",
    message: candidates.length === 0 ? "CHATGPT_FORK_MENU_ITEM_MISSING" : "CHATGPT_FORK_MENU_ITEM_AMBIGUOUS",
    labels: candidates.map(label),
  };
}
candidates[0].click();
return {status: "success", message: "clicked exact branch menu item", labels: candidates.map(label)};
`;

const canonicalConversationUrl = (value: string): string => {
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:"
    || parsed.host !== "chatgpt.com"
    || !/^\/c\/(?!WEB:)[^/]+$/u.test(parsed.pathname)
  ) {
    throw new Error("review_required: provider fork URL is not a governed ChatGPT conversation URL");
  }
  return `${parsed.origin}${parsed.pathname}`;
};

const transientBranchChildConversationUrl = (value: string): string => {
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:"
    || parsed.host !== "chatgpt.com"
    || !/^\/c\/WEB:[^/]+$/u.test(parsed.pathname)
  ) {
    throw new Error(
      "recovery_pending: provider fork child URL is not a fresh transient ChatGPT branch URL",
    );
  }
  return `${parsed.origin}${parsed.pathname}`;
};

const observeCheckpoint = async (
  browser: BrowserTargetSession,
  context: AiProviderAdapterContext,
): Promise<ForkCheckpointObservation> => browser.evaluate<ForkCheckpointObservation>({
  description: "verify exact ChatGPT fork checkpoint",
  script: CHECKPOINT_OBSERVATION_SCRIPT,
  ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
});

const checkpointAssistant = (
  observation: ForkCheckpointObservation,
  marker: string,
): ForkCheckpointObservation["turns"][number] => {
  const matches = observation.turns
    .map((turn, index) => ({ turn, index }))
    .filter(({ turn }) => turn.role === "user" && turn.text.includes(marker));
  if (matches.length !== 1) {
    throw new Error("review_required: CHATGPT_FORK_CHECKPOINT_MARKER_AMBIGUOUS");
  }
  const assistant = observation.turns
    .slice(matches[0]!.index + 1)
    .find((turn) => turn.role === "assistant");
  if (!assistant) {
    throw new Error("recovery_pending: CHATGPT_FORK_CHECKPOINT_RESPONSE_NOT_HYDRATED");
  }
  return assistant;
};

const inspectCheckpointAssistant = (
  observation: ForkCheckpointObservation,
  marker: string,
): {
  markerCount: number;
  assistant: ForkCheckpointObservation["turns"][number] | null;
} => {
  const matches = observation.turns
    .map((turn, index) => ({ turn, index }))
    .filter(({ turn }) => turn.role === "user" && turn.text.includes(marker));
  if (matches.length !== 1) {
    return { markerCount: matches.length, assistant: null };
  }
  return {
    markerCount: 1,
    assistant: observation.turns
      .slice(matches[0]!.index + 1)
      .find((turn) => turn.role === "assistant") ?? null,
  };
};

type ForkRuntimeInput = {
  browser: BrowserTargetSession;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  waitForComposer: () => Promise<void>;
};

type VerifiedParentCheckpoint = {
  fork: NonNullable<AiFeedInput["providerForkRef"]>;
  parentUrl: string;
  assistant: ForkCheckpointObservation["turns"][number];
  checkpointTurns: ForkCheckpointObservation["turns"];
  checkpointHistoryFingerprint: `sha256:${string}`;
  parentVerifiedMs: number;
};

const verifyParentCheckpoint = async (
  input: ForkRuntimeInput,
  startedAtMs: number,
): Promise<VerifiedParentCheckpoint> => {
  const fork = input.request.providerForkRef;
  if (!fork) throw new Error("review_required: provider fork reference is missing");
  const parentUrl = canonicalConversationUrl(fork.providerPageUrl);
  emitForkStage({
    request: input.request,
    stage: "parent_open",
    status: "start",
    startedAtMs,
    refs: { parentUrl },
  });
  await focusChatGptConversationByCanonicalPath({
    base: input.browser,
    conversationUrl: parentUrl,
    turnMarker: fork.checkpointTurnMarker,
    timeoutMs: 15_000,
    ...(input.context.abortSignal
      ? { signal: input.context.abortSignal }
      : {}),
  });
  await input.waitForComposer();
  const parent = await observeCheckpoint(input.browser, input.context);
  if (canonicalConversationUrl(parent.pageUrl) !== parentUrl) {
    throw new Error("review_required: CHATGPT_FORK_PARENT_CONVERSATION_DRIFT");
  }
  const assistant = checkpointAssistant(parent, fork.checkpointTurnMarker);
  if (
    hash(assistant.text) !== fork.checkpointResponseHash
    || fork.priorRawOutputHash !== fork.checkpointResponseHash
  ) {
    throw new Error("review_required: CHATGPT_FORK_CHECKPOINT_RESPONSE_HASH_MISMATCH");
  }
  const checkpointIndex = parent.turns.findIndex(
    (turn) => turn.turnId === assistant.turnId,
  );
  if (checkpointIndex < 0) {
    throw new Error("review_required: CHATGPT_FORK_CHECKPOINT_TURN_MISSING");
  }
  const checkpointTurns = parent.turns.slice(0, checkpointIndex + 1);
  const checkpointHistoryFingerprintValue =
    checkpointHistoryFingerprint(checkpointTurns);
  const parentVerifiedMs = Date.now() - startedAtMs;
  emitForkStage({
    request: input.request,
    stage: "parent_checkpoint_verified",
    status: "success",
    startedAtMs,
    refs: { parentUrl, checkpointTurnId: assistant.turnId },
  });
  return {
    fork,
    parentUrl,
    assistant,
    checkpointTurns,
    checkpointHistoryFingerprint: checkpointHistoryFingerprintValue,
    parentVerifiedMs,
  };
};

const clickBranchMenuItem = async (
  input: ForkRuntimeInput,
): Promise<{ message: string; labels: string[] }> => {
  const deadline = Date.now() + 3_000;
  let clicked: {
    status: "success" | "review_required";
    message: string;
    labels: string[];
  } | null = null;
  while (Date.now() < deadline) {
    clicked = await input.browser.evaluate<{
      status: "success" | "review_required";
      message: string;
      labels: string[];
    }>({
      description: "click exact ChatGPT checkpoint branch menu item",
      script: CLICK_OPEN_BRANCH_MENU_SCRIPT,
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    if (clicked.status === "success"
      || clicked.message !== "CHATGPT_FORK_MENU_ITEM_MISSING") break;
    await input.browser.wait(100);
  }
  if (!clicked || clicked.status !== "success") {
    throw new Error(`review_required: ${clicked?.message ?? "CHATGPT_FORK_MENU_ITEM_MISSING"}`);
  }
  return clicked;
};

const triggerForkAction = async (
  input: ForkRuntimeInput,
  assistantTurnId: string,
  startedAtMs: number,
): Promise<{ actionMessage: string; actionLabels: string[]; forkActionClickedMs: number }> => {
  const openedAction = await input.browser.evaluate<{
    status: "success" | "menu_opened" | "review_required";
    message: string;
    labels: string[];
  }>({
    description: "open exact ChatGPT checkpoint branch action",
    script: OPEN_BRANCH_ACTION_SCRIPT(assistantTurnId),
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  if (openedAction.status === "review_required") {
    throw new Error(`review_required: ${openedAction.message}`);
  }
  let actionMessage = openedAction.message;
  let actionLabels = openedAction.labels;
  if (openedAction.status === "menu_opened") {
    const clicked = await clickBranchMenuItem(input);
    actionMessage = `${actionMessage};${clicked.message}`;
    actionLabels = [...actionLabels, ...clicked.labels];
  }
  const forkActionClickedMs = Date.now() - startedAtMs;
  emitForkStage({
    request: input.request,
    stage: "fork_action_clicked",
    status: "success",
    startedAtMs,
    refs: { actionMessage, actionLabels },
  });
  return { actionMessage, actionLabels, forkActionClickedMs };
};

type ForkChildState = {
  pageUrl: string;
  turnCount: number;
  markerCount: number;
  assistantFound: boolean;
};

const waitForForkChildHistory = async (
  input: ForkRuntimeInput,
  parent: VerifiedParentCheckpoint,
  startedAtMs: number,
): Promise<ForkCheckpointObservation> => {
  const deadline = Date.now() + 5_000;
  let lastState: ForkChildState | null = null;
  let lastStateKey = "";
  while (Date.now() < deadline) {
    await input.browser.wait(100);
    const observed = await observeCheckpoint(input.browser, input.context);
    const inspected = inspectCheckpointAssistant(observed, parent.fork.checkpointTurnMarker);
    lastState = {
      pageUrl: observed.pageUrl,
      turnCount: observed.turns.length,
      markerCount: inspected.markerCount,
      assistantFound: inspected.assistant !== null,
    };
    const stateKey = JSON.stringify(lastState);
    if (stateKey !== lastStateKey) {
      lastStateKey = stateKey;
      emitForkStage({ request: input.request, stage: "child_history_probe",
        status: "start", startedAtMs, refs: lastState });
    }
    let childUrl: string | null = null;
    try {
      childUrl = transientBranchChildConversationUrl(observed.pageUrl);
    } catch {
      // Provider transition URLs remain pending until one governed child exists.
    }
    if (childUrl && childUrl !== parent.parentUrl && inspected.assistant) {
      if (hash(inspected.assistant.text) !== parent.fork.checkpointResponseHash) {
        throw new Error("review_required: CHATGPT_FORK_CHILD_HISTORY_MISMATCH");
      }
      if (
        observed.turns.length !== parent.checkpointTurns.length
        || checkpointHistoryFingerprint(observed.turns)
          !== parent.checkpointHistoryFingerprint
      ) {
        throw new Error(
          "review_required: CHATGPT_FORK_CHILD_INHERITED_HISTORY_MISMATCH",
        );
      }
      return observed;
    }
  }
  emitForkStage({ request: input.request, stage: "child_history_verified",
    status: "failed", startedAtMs, refs: { lastChildState: lastState } });
  throw new Error(
    `recovery_pending: CHATGPT_FORK_CHILD_CONVERSATION_NOT_CREATED:${JSON.stringify(lastState)}`,
  );
};

const verifyForkChild = async (
  input: ForkRuntimeInput,
  parent: VerifiedParentCheckpoint,
  startedAtMs: number,
): Promise<{ child: ForkCheckpointObservation; childUrl: string;
  childSingleTabMs: number; childVerifiedMs: number }> => {
  const childSingleTabMs = Date.now() - startedAtMs;
  emitForkStage({
    request: input.request,
    stage: "child_single_tab_observed",
    status: "success",
    startedAtMs,
  });
  const child = await waitForForkChildHistory(input, parent, startedAtMs);
  await input.waitForComposer();
  const childUrl = transientBranchChildConversationUrl(child.pageUrl);
  const childVerifiedMs = Date.now() - startedAtMs;
  emitForkStage({
    request: input.request,
    stage: "child_history_verified",
    status: "success",
    startedAtMs,
    refs: { childUrl, childUrlKind: childUrl.includes("/c/WEB:") ? "transient" : "canonical" },
  });
  return { child, childUrl, childSingleTabMs, childVerifiedMs };
};

const buildForkActionProof = (input: {
  parent: VerifiedParentCheckpoint;
  action: Awaited<ReturnType<typeof triggerForkAction>>;
  child: Awaited<ReturnType<typeof verifyForkChild>>;
}): WebChatForkActionProof => {
  const historyFingerprint = checkpointHistoryFingerprint(
    input.child.child.turns,
  );
  const verifiedAt = new Date().toISOString();
  const actionEvidence = JSON.stringify({
    actionMessage: input.action.actionMessage,
    actionLabels: input.action.actionLabels,
    parentUrl: input.parent.parentUrl,
    checkpointTurnId: input.parent.assistant.turnId,
    parentCheckpointHistoryFingerprint:
      input.parent.checkpointHistoryFingerprint,
    childUrl: input.child.childUrl,
    childInitialHistoryFingerprint: historyFingerprint,
    verifiedAt,
    timingsMs: {
      parentVerifiedMs: input.parent.parentVerifiedMs,
      forkActionClickedMs: input.action.forkActionClickedMs,
      childSingleTabMs: input.child.childSingleTabMs,
      childVerifiedMs: input.child.childVerifiedMs,
    },
  });
  const actionEvidenceHash = hash(actionEvidence);
  return {
    mode: "forked_from_checkpoint",
    parentConversationUrl: input.parent.parentUrl,
    parentCheckpointTurnMarker: input.parent.fork.checkpointTurnMarker,
    parentCheckpointResponseHash: hash(input.parent.assistant.text),
    forkActionEvidenceRef: `provider-dom-action:chatgpt-branch:${actionEvidenceHash.slice(7)}`,
    forkActionEvidenceHash: actionEvidenceHash,
    childConversationUrl: input.child.childUrl,
    childInitialHistoryFingerprint: historyFingerprint,
    verifiedAt,
  };
};

export const openGovernedForkFromCheckpoint = async (
  input: ForkRuntimeInput,
): Promise<WebChatForkActionProof> => {
  const startedAtMs = Date.now();
  const parent = await verifyParentCheckpoint(input, startedAtMs);
  const action = await triggerForkAction(input, parent.assistant.turnId, startedAtMs);
  const child = await verifyForkChild(input, parent, startedAtMs);
  return buildForkActionProof({ parent, action, child });
};
