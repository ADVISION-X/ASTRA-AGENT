import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import { dismissChatGptSearchDialogIfVisible } from "./web-chat-search-dialog-hygiene.js";
import { recordWebChatPageAction } from "./web-chat-page-action-contract.js";

const OPEN_SEARCH_SCRIPT = `
const visible=(node)=>{if(!(node instanceof Element))return false;const r=node.getBoundingClientRect();const s=getComputedStyle(node);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden";};
const normalized=(value)=>String(value||"").replace(/\\s+/gu," ").trim();
const candidates=Array.from(document.querySelectorAll("button,[role='button']")).filter(visible)
 .filter((node)=>/^(搜索聊天|search chats)$/iu.test(normalized(node.getAttribute("aria-label")||node.getAttribute("title")||node.textContent)));
if(candidates.length!==1)return{status:candidates.length>1?"review_required":"pending",count:candidates.length};
const r=candidates[0].getBoundingClientRect();return{status:"success",count:1,point:{x:r.left+r.width/2,y:r.top+r.height/2}};
`;

const SEARCH_BOX_SCRIPT = `
const visible=(node)=>{if(!(node instanceof Element))return false;const r=node.getBoundingClientRect();const s=getComputedStyle(node);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden";};
const normalized=(value)=>String(value||"").replace(/\\s+/gu," ").trim();
const nodes=Array.from(document.querySelectorAll("input,textarea,[role='textbox']")).filter(visible)
 .filter((node)=>/^(搜索聊天|search chats)$/iu.test(normalized(node.getAttribute("aria-label")||node.getAttribute("placeholder"))));
if(nodes.length!==1)return{status:nodes.length>1?"review_required":"pending",count:nodes.length};
const r=nodes[0].getBoundingClientRect();return{status:"success",count:1,point:{x:r.left+r.width/2,y:r.top+r.height/2}};
`;

const searchResultScript = (targetPath: string): string => `
const targetPath=${JSON.stringify(targetPath)};
const visible=(node)=>{if(!(node instanceof Element))return false;const r=node.getBoundingClientRect();const s=getComputedStyle(node);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden";};
const links=Array.from(document.querySelectorAll("a[href]")).filter(visible).filter((node)=>{try{return new URL(node.getAttribute("href")||"",location.href).pathname===targetPath;}catch{return false;}});
const logical=links.sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);
if(logical.length===0)return{status:"pending",count:0};
const node=logical[0];const r=node.getBoundingClientRect();return{status:"success",count:logical.length,point:{x:r.left+Math.min(r.width/2,96),y:r.top+r.height/2}};
`;

type Located = { status: "success" | "pending" | "review_required"; count: number; point?: { x: number; y: number } };
type DiscoveryInput = {
  browser: BrowserTargetLease;
  context?: AiProviderAdapterContext;
  canonicalConversationUrl: string;
  turnMarker: string;
};

const waitLocated = async (input: {
  browser: BrowserTargetLease;
  context?: AiProviderAdapterContext;
  description: string;
  script: string;
  timeoutMs: number;
}): Promise<Located> => {
  const deadline = Date.now() + input.timeoutMs;
  let last: Located | null = null;
  while (Date.now() < deadline) {
    last = await input.browser.evaluate<Located>({ description: input.description, script: input.script,
      ...(input.context?.abortSignal ? { abortSignal: input.context.abortSignal } : {}) });
    if (last.status === "review_required") throw new Error(`review_required: ${input.description} ambiguous`);
    if (last.status === "success") return last;
    await input.browser.wait(150);
  }
  throw new Error(`WEB_CHAT_SEARCH_RESULT_NOT_READY:${input.description};count=${last?.count ?? 0}`);
};

const enterConversationSearch = async (input: DiscoveryInput): Promise<void> => {
  await dismissChatGptSearchDialogIfVisible(input.browser, input.context ?? {});
  const open = await waitLocated({ browser: input.browser, ...(input.context ? { context: input.context } : {}),
    description: "locate unique ChatGPT Search chats control", script: OPEN_SEARCH_SCRIPT, timeoutMs: 2_000 });
  const opened = await input.browser.click({ targetLabel: "open ChatGPT chat search", point: open.point! });
  if (!opened.ok) throw new Error("WEB_CHAT_SEARCH_RESULT_NOT_READY:search control click failed");
  const box = await waitLocated({ browser: input.browser, ...(input.context ? { context: input.context } : {}),
    description: "locate unique ChatGPT Search chats textbox", script: SEARCH_BOX_SCRIPT, timeoutMs: 2_000 });
  const focused = await input.browser.click({ targetLabel: "focus ChatGPT chat search textbox", point: box.point! });
  if (!focused.ok) throw new Error("WEB_CHAT_SEARCH_RESULT_NOT_READY:search textbox focus failed");
  await input.browser.textInput({ targetLabel: "ChatGPT chat search textbox", action: "clear-input" });
  await input.browser.textInput({ targetLabel: "ChatGPT chat search textbox", action: "type-text", text: input.turnMarker });
};

const openDiscoveredConversation = async (input: DiscoveryInput) => {
  const targetPath = new URL(input.canonicalConversationUrl).pathname;
  const result = await waitLocated({ browser: input.browser, ...(input.context ? { context: input.context } : {}),
    description: "locate exact canonical ChatGPT conversation in search results",
    script: searchResultScript(targetPath), timeoutMs: 5_000 });
  const clicked = await input.browser.click({ targetLabel: "open exact canonical ChatGPT search result", point: result.point! });
  if (!clicked.ok) throw new Error("WEB_CHAT_SEARCH_RESULT_NOT_READY:search result click failed");
  await input.browser.wait(250);
  const current = await input.browser.evaluate<{ pageUrl: string; markerCount: number }>({
    description: "verify exact ChatGPT search-discovered conversation",
    script: `
const marker=${JSON.stringify(input.turnMarker)};
const normalized=(value)=>String(value||"").replace(/\\s+/gu," ").trim();
const markerCount=Array.from(document.querySelectorAll("[data-testid^='conversation-turn-'][data-turn='user']"))
 .filter((node)=>normalized(node.textContent).includes(marker)).length;
return {pageUrl:location.href,markerCount};`,
  });
  if (new URL(current.pageUrl).pathname !== targetPath || current.markerCount !== 1) {
    throw new Error("review_required: CHATGPT_SEARCH_DISCOVERY_IDENTITY_MISMATCH");
  }
  return { current, result, targetPath };
};

export const discoverChatGptConversationViaSearch = async (input: DiscoveryInput): Promise<void> => {
  const startedAt = new Date().toISOString();
  const beforeUrl = input.browser.getTarget?.()?.url ?? null;
  try {
    await enterConversationSearch(input);
    const { current, result, targetPath } = await openDiscoveredConversation(input);
    if (input.context?.webChatExecution) await recordWebChatPageAction({
      browser: input.browser, context: input.context, actionId: "discover_conversation_via_search",
      startedAt, beforeUrl, afterUrl: current.pageUrl, result: "committed",
      candidateCount: result.count, semantics: ["turn-marker-search", targetPath], allowDocumentChange: true,
    });
  } finally {
    await dismissChatGptSearchDialogIfVisible(input.browser, input.context ?? {}).catch(() => undefined);
  }
};
