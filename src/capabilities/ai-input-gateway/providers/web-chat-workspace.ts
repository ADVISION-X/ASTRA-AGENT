import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { runAppleScript } from "../../../lib/browser/current-chrome-window-control.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

const FACEBOOK_WORKSPACE_ID = "facebook";
const DEEP_RESEARCH_WORKSPACE_ID = "deep-research";
const PICK3_WORKSPACE_ID = "pick3-is-blind-eval";
const FULL_CORPUS_WORKSPACE_ID = "full-corpus";

const escapeAppleScriptText = (value: string): string =>
  value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

const workspaceDir = (dataDir: string): string =>
  path.join(dataDir, "runtime-data", "ai-input-gateway", "web-chat-workspaces");

const workspaceUrlPath = (dataDir: string, providerKind: string, workspaceId: string): string =>
  path.join(workspaceDir(dataDir), `${providerKind}-${workspaceId}.url`);

const workspaceConversationLedgerPath = (dataDir: string, providerKind: string, workspaceId: string): string =>
  path.join(workspaceDir(dataDir), `${providerKind}-${workspaceId}-conversation-urls.json`);

const PICK3_CONVERSATION_LEDGER_MAX_ENTRIES = 100;

export const isPick3WorkspaceId = (workspaceId: string | null): boolean =>
  workspaceId === PICK3_WORKSPACE_ID;

export const normalizeWorkspaceUrl = (input: {
  workspaceId: string;
  url: string | null;
}): string | null => {
  if (!input.url || !input.url.startsWith("https://")) return null;
  if (!isPick3WorkspaceId(input.workspaceId)) return input.url;
  try {
    const parsed = new URL(input.url);
    return parsed.host === "chatgpt.com" ? `${parsed.origin}/` : input.url;
  } catch {
    return null;
  }
};

export const resolveWebChatWorkspaceId = (request: AiFeedInput): string | null =>
  request.promptContractId.includes("facebook-product-video-mining")
    ? FACEBOOK_WORKSPACE_ID
    : request.promptContractId.includes("deep-research.")
      ? DEEP_RESEARCH_WORKSPACE_ID
      : request.promptContractId.includes("pick3-is-blind-eval")
        ? PICK3_WORKSPACE_ID
        : request.promptContractId.startsWith("full-corpus-")
          ? FULL_CORPUS_WORKSPACE_ID
        : null;

export const readSavedWorkspaceUrl = (input: {
  dataDir: string;
  providerKind: string;
  workspaceId: string;
}): string | null => {
  const filePath = workspaceUrlPath(input.dataDir, input.providerKind, input.workspaceId);
  if (!existsSync(filePath)) return null;
  const value = readFileSync(filePath, "utf8").trim();
  return value.startsWith("http")
    ? normalizeWorkspaceUrl({ workspaceId: input.workspaceId, url: value })
    : null;
};

export const saveWorkspaceUrl = (input: {
  dataDir: string;
  providerKind: string;
  workspaceId: string;
  url: string | null;
}): void => {
  const normalizedUrl = normalizeWorkspaceUrl({ workspaceId: input.workspaceId, url: input.url });
  if (!normalizedUrl) return;
  mkdirSync(workspaceDir(input.dataDir), { recursive: true });
  writeFileSync(
    workspaceUrlPath(input.dataDir, input.providerKind, input.workspaceId),
    `${normalizedUrl}\n`,
  );
};

export const readWorkspaceConversationLedger = (input: {
  dataDir: string;
  providerKind: string;
  workspaceId: string;
}): string[] => {
  const filePath = workspaceConversationLedgerPath(input.dataDir, input.providerKind, input.workspaceId);
  if (!existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string" && value.startsWith("https://")) : [];
  } catch {
    return [];
  }
};

export const recordWorkspaceConversationUrl = (input: {
  dataDir: string;
  providerKind: string;
  workspaceId: string;
  url: string | null;
}): void => {
  if (!input.url) return;
  const isSupportedConversationUrl = input.providerKind === "gemini-web-chat"
    ? input.url.startsWith("https://gemini.google.com/app/")
    : input.url.startsWith("https://chatgpt.com/");
  if (!isSupportedConversationUrl) return;
  const existing = readWorkspaceConversationLedger(input).filter((url) => url !== input.url);
  const next = [...existing, input.url].slice(-PICK3_CONVERSATION_LEDGER_MAX_ENTRIES);
  mkdirSync(workspaceDir(input.dataDir), { recursive: true });
  writeFileSync(
    workspaceConversationLedgerPath(input.dataDir, input.providerKind, input.workspaceId),
    `${JSON.stringify(next, null, 2)}\n`,
  );
};

export const cleanupStaleWorkspaceConversationTabs = async (input: {
  dataDir: string;
  providerKind: string;
  workspaceId: string;
  keepRecentCount: number;
  abortSignal?: AbortSignal;
}): Promise<string> => {
  const ledger = readWorkspaceConversationLedger(input);
  const staleUrls = ledger.slice(0, Math.max(0, ledger.length - input.keepRecentCount));
  if (staleUrls.length === 0) return "not_needed";
  const staleList = staleUrls.map((url) => `"${escapeAppleScriptText(url)}"`).join(", ");
  const result = await runAppleScript(`
set staleUrls to {${staleList}}
set closedCount to 0
tell application "Google Chrome"
  if (count of windows) = 0 then return "closed_0"
  repeat with w in windows
    set tIndex to (count of tabs of w)
    repeat while tIndex > 0
      set tabUrl to URL of tab tIndex of w
      if staleUrls contains tabUrl then
        close tab tIndex of w
        set closedCount to closedCount + 1
      end if
      set tIndex to tIndex - 1
    end repeat
  end repeat
end tell
return "closed_" & closedCount
`, input.abortSignal ? { signal: input.abortSignal } : undefined);
  return result.trim();
};

export const focusExistingWorkspaceTab = async (input: {
  providerHost: string;
  workspaceId: string;
  savedUrl: string | null;
  allowAnyProviderTab: boolean;
  abortSignal?: AbortSignal;
}): Promise<boolean> => {
  const result = await runAppleScript(`
tell application "Google Chrome" to activate
tell application "Google Chrome"
  if (count of windows) = 0 then return "not_found"
  repeat with w in windows
    set tIndex to 1
    repeat with t in tabs of w
      set tabUrl to URL of t
      if tabUrl contains "${escapeAppleScriptText(input.providerHost)}" then
        if ${input.savedUrl ? `tabUrl is "${escapeAppleScriptText(input.savedUrl)}"` : "false"} then
          set active tab index of w to tIndex
          set index of w to 1
          return "focused"
        end if
        if ${input.allowAnyProviderTab ? "true" : "false"} then
          set active tab index of w to tIndex
          set index of w to 1
          return "focused_any_provider_tab"
        end if
      end if
      set tIndex to tIndex + 1
    end repeat
  end repeat
  return "not_found"
end tell
`, input.abortSignal ? { signal: input.abortSignal } : undefined);
  return result.trim().startsWith("focused");
};

export const ensureProviderWorkspaceFocused = async (input: {
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  allowAnyProviderTab?: boolean;
}): Promise<void> => {
  if (input.context.webChatExecution) {
    // The managed browser routes the one physical provider tab by exact
    // system-renamed conversation title and then verifies the prompt marker.
    return;
  }
  const workspaceId = resolveWebChatWorkspaceId(input.request);
  if (!workspaceId) return;
  const savedUrl = readSavedWorkspaceUrl({
    dataDir: input.context.dataDir,
    providerKind: input.request.providerKind,
    workspaceId,
  });
  const focused = await focusExistingWorkspaceTab({
    providerHost: new URL(input.providerUrl).host,
    workspaceId,
    savedUrl,
    allowAnyProviderTab: isPick3WorkspaceId(workspaceId) || workspaceId === "full-corpus" || input.allowAnyProviderTab === true,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  if (!focused) {
    throw new Error("review_required: provider workspace tab was not focused before web-chat action.");
  }
};

export const focusExistingSourceTab = async (input: {
  sourceUrl: string;
  abortSignal?: AbortSignal;
}): Promise<boolean> => {
  const parsed = new URL(input.sourceUrl);
  const parsedSource = parsed.protocol === "blob:"
    ? (() => {
        try {
          return new URL(parsed.pathname);
        } catch {
          return parsed;
        }
      })()
    : parsed;
  const sourceHostPath = `${parsedSource.host}${parsedSource.pathname}`;
  const sourceOrigin = parsedSource.origin;
  const mayUseSameOriginWorkbenchTab =
    parsedSource.protocol === "http:"
    && (parsedSource.hostname === "127.0.0.1" || parsedSource.hostname === "localhost");
  const result = await runAppleScript(`
tell application "Google Chrome" to activate
tell application "Google Chrome"
  if (count of windows) = 0 then return "not_found"
  repeat with w in windows
    set tIndex to 1
    repeat with t in tabs of w
      set tabUrl to URL of t
      if tabUrl is "${escapeAppleScriptText(input.sourceUrl)}" or tabUrl contains "${escapeAppleScriptText(sourceHostPath)}" then
        set active tab index of w to tIndex
        set index of w to 1
        return "focused"
      end if
      if ${mayUseSameOriginWorkbenchTab ? "true" : "false"} and tabUrl starts with "${escapeAppleScriptText(sourceOrigin)}" then
        set active tab index of w to tIndex
        set index of w to 1
        return "focused"
      end if
      set tIndex to tIndex + 1
    end repeat
  end repeat
  return "not_found"
end tell
`, input.abortSignal ? { signal: input.abortSignal } : undefined);
  return result.trim() === "focused";
};
