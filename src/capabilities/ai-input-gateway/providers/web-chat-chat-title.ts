import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  WebChatSubmissionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import {
  copyTextToMacClipboard,
  pasteMacClipboardIntoChrome,
} from "./web-chat-clipboard.js";

type LocatedTarget = {
  status: "success" | "pending" | "review_required";
  message: string;
  pageUrl: string;
  observedTitle?: string | null;
  targetPoint?: { x: number; y: number };
};

type RenameVerification = {
  status: "success" | "pending" | "review_required";
  titleLinkCount: number;
  markerCount: number;
  currentPathMatches: boolean;
  documentTitleMatches: boolean;
};

type TextboxValueVerification = {
  status: "success" | "pending" | "review_required";
  observedValue: string | null;
};

const buildConversationOptionsTargetScript = (canonicalConversationUrl: string): string => `
const expectedPath = ${JSON.stringify(new URL(canonicalConversationUrl).pathname)};
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const links = Array.from(document.querySelectorAll("a[href]"))
  .filter((link) => {
    try {
      const rawHref = link.getAttribute("href") || "";
      return rawHref.includes("/c/")
        && new URL(link.href, location.href).pathname === expectedPath
        && visible(link);
    } catch {
      return false;
    }
  });
if (links.length !== 1) {
  return {
    status: links.length === 0 ? "pending" : "review_required",
    message: links.length === 0 ? "waiting for submitted conversation sidebar entry" : "CHATGPT_CONVERSATION_LINK_AMBIGUOUS",
    pageUrl: location.href,
  };
}
const link = links[0];
let container = link;
let options = null;
for (let depth = 0; depth < 7 && container && !options; depth += 1) {
  options = Array.from(container.querySelectorAll("button"))
    .find((button) => {
      const label = normalized(button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent);
      return visible(button) && (/对话选项|conversation options|chat options/i.test(label));
    }) || null;
  container = container.parentElement;
}
if (!options) {
  return {
    status: "pending",
    message: "waiting for submitted conversation options control",
    pageUrl: location.href,
    observedTitle: normalized(link.textContent),
  };
}
const rect = options.getBoundingClientRect();
return {
  status: "success",
  message: "submitted conversation options control located",
  pageUrl: location.href,
  observedTitle: normalized(link.textContent),
  targetPoint: {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2},
};
`;

const buildConversationLinkTargetScript = (canonicalConversationUrl: string): string => `
const expectedPath = ${JSON.stringify(new URL(canonicalConversationUrl).pathname)};
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const links = Array.from(document.querySelectorAll("a[href]"))
  .filter((link) => {
    try {
      const rawHref = link.getAttribute("href") || "";
      return rawHref.includes("/c/")
        && new URL(link.href, location.href).pathname === expectedPath
        && visible(link);
    } catch {
      return false;
    }
  });
if (links.length !== 1) {
  return {
    status: links.length === 0 ? "pending" : "review_required",
    message: links.length === 0 ? "waiting for submitted conversation sidebar link" : "CHATGPT_CONVERSATION_LINK_AMBIGUOUS",
    pageUrl: location.href,
  };
}
const rect = links[0].getBoundingClientRect();
return {
  status: "success",
  message: "submitted conversation sidebar link located",
  pageUrl: location.href,
  targetPoint: {x: rect.left + Math.min(rect.width / 2, 96), y: rect.top + rect.height / 2},
};
`;

const buildFocusedSubmittedConversationScript = (input: {
  canonicalConversationUrl: string;
  turnMarker: string;
}): string => `
const expectedPath = ${JSON.stringify(new URL(input.canonicalConversationUrl).pathname)};
const marker = ${JSON.stringify(input.turnMarker)};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const markerCount = Array.from(document.querySelectorAll("[data-message-author-role='user']"))
  .filter((node) => normalized(node.textContent).includes(marker))
  .length;
return {
  status: location.pathname === expectedPath && markerCount === 1
    ? "success"
    : markerCount > 1
      ? "review_required"
      : "pending",
  message: "verify submitted conversation is current before opening its options",
  pageUrl: location.href,
  markerCount,
};
`;

const RENAME_MENU_TARGET_SCRIPT = `
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const candidates = Array.from(document.querySelectorAll("[role='menuitem'], [role='menu'] button"))
  .filter((node) => visible(node))
  .filter((node) => /^(重命名|rename)$/iu.test(normalized(node.textContent || node.getAttribute("aria-label"))));
if (candidates.length !== 1) {
  return {
    status: candidates.length === 0 ? "pending" : "review_required",
    message: candidates.length === 0 ? "waiting for ChatGPT rename menu item" : "CHATGPT_RENAME_MENU_ITEM_AMBIGUOUS",
    pageUrl: location.href,
  };
}
const rect = candidates[0].getBoundingClientRect();
return {
  status: "success",
  message: "ChatGPT rename menu item located",
  pageUrl: location.href,
  targetPoint: {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2},
};
`;

const buildRenameTextboxTargetScript = (): string => `
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const candidates = Array.from(document.querySelectorAll("input, textarea, [role='textbox']"))
  .filter((node) => visible(node))
  .filter((node) => /聊天标题|chat title/i.test(normalized(
    node.getAttribute("aria-label") || node.getAttribute("placeholder")
  )));
if (candidates.length !== 1) {
  return {
    status: candidates.length === 0 ? "pending" : "review_required",
    message: candidates.length === 0 ? "waiting for ChatGPT chat title textbox" : "CHATGPT_CHAT_TITLE_TEXTBOX_AMBIGUOUS",
    pageUrl: location.href,
  };
}
const rect = candidates[0].getBoundingClientRect();
return {
  status: "success",
  message: "ChatGPT chat title textbox located",
  pageUrl: location.href,
  targetPoint: {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2},
};
`;

const buildRenameTextboxValueScript = (expectedTitle: string): string => `
const expectedTitle = ${JSON.stringify(expectedTitle)};
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const candidates = Array.from(document.querySelectorAll("input, textarea, [role='textbox']"))
  .filter((node) => visible(node))
  .filter((node) => /聊天标题|chat title/i.test(normalized(
    node.getAttribute("aria-label") || node.getAttribute("placeholder")
  )));
const observedValue = candidates.length === 1
  ? String("value" in candidates[0] ? candidates[0].value : candidates[0].textContent || "")
  : null;
return {
  status: candidates.length > 1
    ? "review_required"
    : observedValue === expectedTitle
      ? "success"
      : "pending",
  observedValue,
};
`;

const buildRenamedIdentityVerificationScript = (input: {
  canonicalConversationUrl: string;
  systemChatTitle: string;
  turnMarker: string;
}): string => `
const expectedPath = ${JSON.stringify(new URL(input.canonicalConversationUrl).pathname)};
const expectedTitle = ${JSON.stringify(input.systemChatTitle)};
const marker = ${JSON.stringify(input.turnMarker)};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const titleLinks = Array.from(document.querySelectorAll("a[href]"))
  .filter((link) => {
    try {
      return (link.getAttribute("href") || "").includes("/c/")
        && new URL(link.href, location.href).pathname === expectedPath
        && normalized(link.textContent) === expectedTitle;
    } catch {
      return false;
    }
  });
const markerCount = Array.from(document.querySelectorAll("[data-message-author-role='user']"))
  .filter((node) => normalized(node.textContent).includes(marker))
  .length;
const currentPathMatches = location.pathname === expectedPath;
const documentTitleMatches = normalized(document.title) === expectedTitle;
return {
  status: titleLinks.length === 1 && markerCount === 1 && currentPathMatches
    ? "success"
    : titleLinks.length > 1 || markerCount > 1
      ? "review_required"
      : "pending",
  message: "verify manually renamed ChatGPT conversation identity",
  pageUrl: location.href,
  titleLinkCount: titleLinks.length,
  markerCount,
  currentPathMatches,
  documentTitleMatches,
};
`;

const locateAndClick = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  description: string;
  script: string;
  timeoutMs: number;
}): Promise<LocatedTarget> => {
  const deadline = Date.now() + input.timeoutMs;
  let last: LocatedTarget | null = null;
  while (Date.now() < deadline) {
    last = await input.browser.evaluateActiveTab<LocatedTarget>({
      description: input.description,
      script: input.script,
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    if (last.status === "review_required") {
      throw new Error(`review_required: ${last.message}`);
    }
    if (last.status === "success" && last.targetPoint) {
      const clicked = await input.browser.click({
        targetLabel: input.description,
        point: last.targetPoint,
        coordinateSpace: "browserViewport",
        button: "left",
        clickCount: 1,
      });
      if (!clicked.ok) throw new Error(`review_required: ${input.description} real click failed; ${clicked.message}`);
      return last;
    }
    await input.browser.wait(250);
  }
  throw new Error(`review_required: ${input.description} did not become uniquely clickable; last=${last?.message ?? "none"}`);
};

const focusSubmittedConversation = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  canonicalConversationUrl: string;
  turnMarker: string;
}): Promise<void> => {
  await locateAndClick({
    browser: input.browser,
    context: input.context,
    description: "open the just-submitted ChatGPT conversation before renaming",
    script: buildConversationLinkTargetScript(input.canonicalConversationUrl),
    timeoutMs: 60_000,
  });
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const observation = await input.browser.evaluateActiveTab<{
      status: "success" | "pending" | "review_required";
      pageUrl: string;
      markerCount: number;
    }>({
      description: "verify the just-submitted ChatGPT conversation is current before renaming",
      script: buildFocusedSubmittedConversationScript({
        canonicalConversationUrl: input.canonicalConversationUrl,
        turnMarker: input.turnMarker,
      }),
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    if (observation.status === "success") return;
    if (observation.status === "review_required") {
      throw new Error(
        `review_required: submitted ChatGPT conversation marker is ambiguous before rename; count=${observation.markerCount}`,
      );
    }
    await input.browser.wait(250);
  }
  throw new Error("review_required: just-submitted ChatGPT conversation did not become current before rename.");
};

const applySystemChatTitle = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  canonicalConversationUrl: string;
  systemChatTitle: string;
}): Promise<string | null> => {
  const options = await locateAndClick({
    browser: input.browser,
    context: input.context,
    description: "click the submitted ChatGPT conversation options control",
    script: buildConversationOptionsTargetScript(input.canonicalConversationUrl),
    timeoutMs: 60_000,
  });
  await locateAndClick({
    browser: input.browser,
    context: input.context,
    description: "click ChatGPT rename menu item",
    script: RENAME_MENU_TARGET_SCRIPT,
    timeoutMs: 10_000,
  });
  await locateAndClick({
    browser: input.browser,
    context: input.context,
    description: "focus ChatGPT chat title textbox",
    script: buildRenameTextboxTargetScript(),
    timeoutMs: 10_000,
  });
  await writeExactSystemChatTitle(input);
  return options.observedTitle?.trim() || null;
};

const writeExactSystemChatTitle = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  systemChatTitle: string;
}): Promise<void> => {
  let last: TextboxValueVerification | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await input.browser.textInput({
      targetLabel: "ChatGPT chat title textbox",
      action: "clear-input",
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    await copyTextToMacClipboard(input.systemChatTitle, input.context.abortSignal);
    await pasteMacClipboardIntoChrome(input.context.abortSignal);
    await input.browser.wait(250);
    last = await input.browser.evaluateActiveTab<TextboxValueVerification>({
      description: "verify exact system title text before committing ChatGPT rename",
      script: buildRenameTextboxValueScript(input.systemChatTitle),
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    if (last.status === "review_required") {
      throw new Error("review_required: ChatGPT chat title textbox became ambiguous before rename commit.");
    }
    if (last.status === "success") {
      await input.browser.textInput({
        targetLabel: "ChatGPT chat title textbox",
        action: "press-key",
        key: "Enter",
        ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
      });
      return;
    }
  }
  throw new Error(
    `review_required: exact ChatGPT system title was not present before rename commit; observed=${last?.observedValue ?? "none"}`,
  );
};

const waitForRenamedIdentity = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  canonicalConversationUrl: string;
  systemChatTitle: string;
  turnMarker: string;
}): Promise<RenameVerification> => {
  const deadline = Date.now() + 12_000;
  let last: RenameVerification = {
    status: "pending",
    titleLinkCount: 0,
    markerCount: 0,
    currentPathMatches: false,
    documentTitleMatches: false,
  };
  while (Date.now() < deadline) {
    last = await input.browser.evaluateActiveTab<RenameVerification>({
      description: "verify exact system title and marker after ChatGPT rename",
      script: buildRenamedIdentityVerificationScript(input),
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    if (last.status !== "pending") return last;
    await input.browser.wait(250);
  }
  return last;
};

export const renameSubmittedChatGptConversation = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  submission: WebChatSubmissionProof;
}): Promise<WebChatSubmissionProof> => {
  const execution = input.context.webChatExecution;
  if (!execution || execution.providerKind !== "gpt-web-chat") return input.submission;
  if (!execution.systemChatTitle || !input.submission.canonicalConversationUrl) {
    throw new Error("review_required: ChatGPT submission is missing the durable name or canonical conversation URL.");
  }
  await focusSubmittedConversation({
    browser: input.browser,
    context: input.context,
    canonicalConversationUrl: input.submission.canonicalConversationUrl,
    turnMarker: execution.turnMarker,
  });
  let last: RenameVerification | null = null;
  let observedAutoChatTitle: string | null = null;
  for (let renameAttempt = 1; renameAttempt <= 3; renameAttempt += 1) {
    observedAutoChatTitle ??= await applySystemChatTitle({
      browser: input.browser,
      context: input.context,
      canonicalConversationUrl: input.submission.canonicalConversationUrl,
      systemChatTitle: execution.systemChatTitle,
    });
    last = await waitForRenamedIdentity({
      browser: input.browser,
      context: input.context,
      canonicalConversationUrl: input.submission.canonicalConversationUrl,
      systemChatTitle: execution.systemChatTitle,
      turnMarker: execution.turnMarker,
    });
    if (last.status === "success") {
      return {
        ...input.submission,
        systemChatTitle: execution.systemChatTitle,
        observedAutoChatTitle,
        chatTitleVerifiedAt: new Date().toISOString(),
      };
    }
    if (renameAttempt < 3) await input.browser.wait(2_000);
  }
  throw new Error(
    `review_required: manually renamed ChatGPT identity did not verify; titleLinks=${String(last?.titleLinkCount ?? 0)}; markers=${String(last?.markerCount ?? 0)}; path=${String(last?.currentPathMatches ?? false)}; observedDocumentTitle=${String(last?.documentTitleMatches ?? false)}`,
  );
};
