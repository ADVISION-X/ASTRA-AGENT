import { createHash } from "node:crypto";

import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  WebChatConversationTitleProof,
  WebChatSubmissionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { focusChatGptConversationByCanonicalPath } from "../runtime/web-chat-single-tab-routing.js";
import {
  assertStableWebChatDocument,
  recordWebChatPageAction,
} from "./web-chat-page-action-contract.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const locateConversationRowScript = (input: {
  canonicalPath: string;
  expectedTitle: string;
  turnMarker: string;
}): string => `
const expectedPath = ${JSON.stringify(input.canonicalPath)};
const expectedTitle = ${JSON.stringify(input.expectedTitle)};
const marker = ${JSON.stringify(input.turnMarker)};
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none"
    && style.visibility !== "hidden" && Number(style.opacity || "1") > 0;
};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const userTurns = Array.from(document.querySelectorAll("[data-testid^='conversation-turn-'][data-turn='user']"));
const markerCount = userTurns.filter((node) => normalized(node.textContent).includes(marker)).length;
const links = Array.from(document.querySelectorAll("a[href]"))
  .filter((node) => visible(node))
  .filter((node) => {
    try { return new URL(node.getAttribute("href") || "", location.href).pathname === expectedPath; }
    catch { return false; }
  });
const logicalLinks = links.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
const actionable = logicalLinks.find((node) => {
  const rect = node.getBoundingClientRect();
  return rect.top >= 0 && rect.bottom <= innerHeight;
});
if (location.pathname !== expectedPath || markerCount !== 1) return {
  status: markerCount > 1 ? "review_required" : "pending",
  message: markerCount > 1 ? "CHATGPT_TITLE_MARKER_AMBIGUOUS" : "CHATGPT_TITLE_TARGET_NOT_READY",
  pageUrl: location.href,
  markerCount,
  rowCount: logicalLinks.length,
};
if (!actionable) return {
  status: "pending",
  message: "CHATGPT_TITLE_ROW_NOT_ACTIONABLE",
  pageUrl: location.href,
  markerCount,
  rowCount: logicalLinks.length,
};
const rect = actionable.getBoundingClientRect();
return {
  status: "success",
  message: normalized(actionable.textContent) === expectedTitle ? "already_named" : "rename_required",
  pageUrl: location.href,
  markerCount,
  rowCount: logicalLinks.length,
  observedTitle: normalized(actionable.textContent),
  rowPoint: {x: rect.left + Math.min(rect.width / 2, 96), y: rect.top + rect.height / 2},
};
`;

const locateOptionsScript = (canonicalPath: string): string => `
const expectedPath = ${JSON.stringify(canonicalPath)};
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const links = Array.from(document.querySelectorAll("a[href]"))
  .filter(visible)
  .filter((node) => { try { return new URL(node.getAttribute("href") || "", location.href).pathname === expectedPath; } catch { return false; } });
const actionable = links.sort((a,b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
  .find((node) => { const r=node.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
if (!actionable) return {status:"pending", count:0, message:"CHATGPT_TITLE_ROW_NOT_ACTIONABLE"};
const row = actionable.closest("li") || actionable.parentElement;
const options = row ? Array.from(row.querySelectorAll("button,[role='button']"))
  .filter(visible)
  .filter((node) => /^(对话选项|conversation options|chat options)$/iu.test(normalized(node.getAttribute("aria-label") || node.getAttribute("title") || node.textContent))) : [];
if (options.length !== 1) return {status:options.length > 1 ? "review_required" : "pending", count:options.length, message:"CHATGPT_TITLE_OPTIONS_NOT_UNIQUE"};
const rect=options[0].getBoundingClientRect();
return {status:"success", count:1, message:"CHATGPT_TITLE_OPTIONS_READY", point:{x:rect.left+rect.width/2,y:rect.top+rect.height/2}};
`;

const locateRenameMenuScript = `
const visible=(node)=>{if(!(node instanceof Element))return false;const r=node.getBoundingClientRect();const s=getComputedStyle(node);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden";};
const normalized=(value)=>String(value||"").replace(/\\s+/gu," ").trim();
const nodes=Array.from(document.querySelectorAll("[role='menuitem'],[role='menu'] button"))
 .filter(visible).filter((node)=>/^(重命名|rename)$/iu.test(normalized(node.textContent||node.getAttribute("aria-label"))));
if(nodes.length!==1)return{status:nodes.length>1?"review_required":"pending",count:nodes.length,message:"CHATGPT_TITLE_RENAME_ACTION_NOT_UNIQUE"};
const r=nodes[0].getBoundingClientRect();return{status:"success",count:1,message:"CHATGPT_TITLE_RENAME_ACTION_READY",point:{x:r.left+r.width/2,y:r.top+r.height/2}};
`;

const locateTitleTextboxScript = (expectedTitle: string): string => `
const expected=${JSON.stringify(expectedTitle)};
const visible=(node)=>{if(!(node instanceof Element))return false;const r=node.getBoundingClientRect();const s=getComputedStyle(node);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden";};
const normalized=(value)=>String(value||"").replace(/\\s+/gu," ").trim();
const nodes=Array.from(document.querySelectorAll("input,textarea,[role='textbox']"))
 .filter(visible).filter((node)=>/聊天标题|chat title/iu.test(normalized(node.getAttribute("aria-label")||node.getAttribute("placeholder"))));
const value=nodes.length===1?String("value" in nodes[0]?nodes[0].value:nodes[0].textContent||""):null;
if(nodes.length!==1)return{status:nodes.length>1?"review_required":"pending",count:nodes.length,value,message:"CHATGPT_TITLE_TEXTBOX_NOT_UNIQUE"};
const r=nodes[0].getBoundingClientRect();return{status:value===expected?"verified":"success",count:1,value,message:"CHATGPT_TITLE_TEXTBOX_READY",point:{x:r.left+r.width/2,y:r.top+r.height/2}};
`;

type Target = {
  status: "success" | "verified" | "pending" | "review_required";
  message: string;
  count?: number;
  pageUrl?: string;
  markerCount?: number;
  rowCount?: number;
  observedTitle?: string;
  value?: string | null;
  rowPoint?: { x: number; y: number };
  point?: { x: number; y: number };
};

const waitTarget = async (input: {
  browser: BrowserTargetSession;
  context: AiProviderAdapterContext;
  description: string;
  script: string;
  timeoutMs: number;
}): Promise<Target> => {
  const deadline = Date.now() + input.timeoutMs;
  let last: Target | null = null;
  while (Date.now() < deadline) {
    last = await input.browser.evaluate<Target>({
      description: input.description,
      script: input.script,
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
    if (last.status === "review_required") {
      throw new Error(`review_required: ${last.message}`);
    }
    if (last.status === "success" || last.status === "verified") return last;
    await input.browser.wait(150);
  }
  throw new Error(`WEB_CHAT_TITLE_FINALIZATION_NOT_READY:${input.description}:${last?.message ?? "none"}`);
};

const clickTarget = async (input: {
  browser: BrowserTargetSession;
  point: { x: number; y: number } | undefined;
  label: string;
}): Promise<void> => {
  if (!input.point) throw new Error(`WEB_CHAT_TITLE_FINALIZATION_NOT_READY:${input.label}`);
  const clicked = await input.browser.click({ targetLabel: input.label, point: input.point });
  if (!clicked.ok) throw new Error(`WEB_CHAT_TITLE_FINALIZATION_NOT_READY:${input.label}`);
};

const buildProof = (input: {
  state: NonNullable<AiProviderAdapterContext["webChatExecution"]>["conversationTitle"];
  previousObservedTitle: string | null;
  observedTitle: string;
  canonicalConversationUrl: string;
}): WebChatConversationTitleProof => {
  const state = input.state!;
  const verifiedAt = new Date().toISOString();
  const evidence = JSON.stringify({
    owner: state.owner,
    policyVersion: state.policyVersion,
    expectedTitleHash: state.expectedTitleHash,
    canonicalConversationUrl: input.canonicalConversationUrl,
    previousObservedTitle: input.previousObservedTitle,
    observedTitle: input.observedTitle,
    verifiedAt,
  });
  const evidenceHash = hash(evidence);
  return {
    proofStatus: "verified",
    owner: state.owner,
    policyVersion: state.policyVersion,
    sourceMappingVersion: state.sourceMappingVersion,
    operatorTimeZone: state.operatorTimeZone,
    expectedTitle: state.expectedTitle,
    expectedTitleHash: state.expectedTitleHash,
    shortTrace: state.shortTrace,
    previousObservedTitle: input.previousObservedTitle,
    observedTitle: input.observedTitle,
    canonicalConversationUrl: input.canonicalConversationUrl,
    verifiedAt,
    evidenceRef: `conversation-title:${evidenceHash.slice(7)}`,
    evidenceHash,
  };
};

export const finalizeGptWebConversationTitle = async (input: {
  browser: BrowserTargetSession;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  submission: WebChatSubmissionProof;
}): Promise<WebChatConversationTitleProof | null> => {
  const execution = input.context.webChatExecution;
  const state = execution?.conversationTitle ?? null;
  if (input.request.providerKind !== "gpt-web-chat" || !execution || !state) return null;
  const canonicalUrl = input.submission.canonicalConversationUrl;
  if (!canonicalUrl || /\/c\/WEB:/u.test(new URL(canonicalUrl).pathname)) {
    throw new Error("WEB_CHAT_TITLE_FINALIZATION_NOT_READY:canonical conversation unavailable");
  }
  const startedAt = new Date().toISOString();
  await execution.onConversationTitleFinalizationStarted(canonicalUrl);
  const proof = await execution.runExclusivePatrol(async (browser) => {
    await focusChatGptConversationByCanonicalPath({
      base: browser,
      conversationUrl: canonicalUrl,
      turnMarker: execution.turnMarker,
      timeoutMs: Math.min(input.request.timeoutMs, 15_000),
      ...(input.context.abortSignal ? { signal: input.context.abortSignal } : {}),
    });
    const expectedDocumentRef = browser.getTarget?.()?.documentRef ?? null;
    const path = new URL(canonicalUrl).pathname;
    const row = await waitTarget({
      browser,
      context: input.context,
      description: "locate exact owned ChatGPT conversation row for title finalization",
      script: locateConversationRowScript({
        canonicalPath: path,
        expectedTitle: state.expectedTitle,
        turnMarker: execution.turnMarker,
      }),
      timeoutMs: 6_000,
    });
    assertStableWebChatDocument({ browser, expectedDocumentRef, actionId: "rename_exact_conversation" });
    const previousObservedTitle = row.observedTitle ?? null;
    if (row.message === "already_named") {
      return buildProof({
        state,
        previousObservedTitle,
        observedTitle: state.expectedTitle,
        canonicalConversationUrl: canonicalUrl,
      });
    }
    if (!browser.move || !row.rowPoint) {
      throw new Error("review_required: CHATGPT_TITLE_HOVER_UNAVAILABLE");
    }
    const moved = await browser.move({
      targetLabel: "hover exact owned ChatGPT conversation row",
      point: row.rowPoint,
    });
    if (!moved.ok) throw new Error("WEB_CHAT_TITLE_FINALIZATION_NOT_READY:hover did not commit");
    const options = await waitTarget({
      browser,
      context: input.context,
      description: "locate exact owned ChatGPT row options",
      script: locateOptionsScript(path),
      timeoutMs: 4_000,
    });
    await clickTarget({ browser, point: options.point, label: "open exact owned ChatGPT row options" });
    const rename = await waitTarget({
      browser,
      context: input.context,
      description: "locate unique ChatGPT Rename menu action",
      script: locateRenameMenuScript,
      timeoutMs: 3_000,
    });
    await clickTarget({ browser, point: rename.point, label: "choose ChatGPT Rename action" });
    const textbox = await waitTarget({
      browser,
      context: input.context,
      description: "locate unique ChatGPT title textbox",
      script: locateTitleTextboxScript(state.expectedTitle),
      timeoutMs: 3_000,
    });
    if (textbox.status !== "verified") {
      await clickTarget({ browser, point: textbox.point, label: "focus ChatGPT title textbox" });
      await browser.textInput({ targetLabel: "ChatGPT title textbox", action: "clear-input" });
      await browser.textInput({
        targetLabel: "ChatGPT title textbox",
        action: "type-text",
        text: state.expectedTitle,
      });
      const readBack = await waitTarget({
        browser,
        context: input.context,
        description: "read back exact ChatGPT title before commit",
        script: locateTitleTextboxScript(state.expectedTitle),
        timeoutMs: 2_000,
      });
      if (readBack.status !== "verified" || readBack.value !== state.expectedTitle) {
        throw new Error("review_required: CHATGPT_TITLE_TEXTBOX_READBACK_MISMATCH");
      }
      await browser.textInput({
        targetLabel: "ChatGPT title textbox",
        action: "press-key",
        key: "Enter",
      });
    }
    assertStableWebChatDocument({ browser, expectedDocumentRef, actionId: "verify_exact_conversation_title" });
    const verified = await waitTarget({
      browser,
      context: input.context,
      description: "verify exact ChatGPT title and marker after rename",
      script: locateConversationRowScript({
        canonicalPath: path,
        expectedTitle: state.expectedTitle,
        turnMarker: execution.turnMarker,
      }),
      timeoutMs: 8_000,
    });
    if (verified.message !== "already_named") {
      throw new Error("WEB_CHAT_TITLE_FINALIZATION_NOT_READY:title commit not reflected");
    }
    return buildProof({
      state,
      previousObservedTitle,
      observedTitle: state.expectedTitle,
      canonicalConversationUrl: canonicalUrl,
    });
  });
  await execution.onConversationTitleVerified(proof);
  await recordWebChatPageAction({
    browser: input.browser,
    context: input.context,
    actionId: "verify_exact_conversation_title",
    startedAt,
    beforeUrl: canonicalUrl,
    afterUrl: canonicalUrl,
    result: proof.previousObservedTitle === proof.expectedTitle ? "no_op" : "committed",
    semantics: [proof.policyVersion, proof.expectedTitleHash],
  });
  return proof;
};
