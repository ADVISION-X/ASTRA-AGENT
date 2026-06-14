import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { runAppleScript } from "../../../lib/browser/current-chrome-window-control.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

const FACEBOOK_WORKSPACE_ID = "facebook";
const DEEP_RESEARCH_WORKSPACE_ID = "deep-research";

const escapeAppleScriptText = (value: string): string =>
  value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

const workspaceDir = (dataDir: string): string =>
  path.join(dataDir, "runtime-data", "ai-input-gateway", "web-chat-workspaces");

const workspaceUrlPath = (dataDir: string, providerKind: string, workspaceId: string): string =>
  path.join(workspaceDir(dataDir), `${providerKind}-${workspaceId}.url`);

export const resolveWebChatWorkspaceId = (request: AiFeedInput): string | null =>
  request.promptContractId.includes("facebook-product-video-mining")
    ? FACEBOOK_WORKSPACE_ID
    : request.promptContractId.includes("deep-research.")
      ? DEEP_RESEARCH_WORKSPACE_ID
      : null;

export const readSavedWorkspaceUrl = (input: {
  dataDir: string;
  providerKind: string;
  workspaceId: string;
}): string | null => {
  const filePath = workspaceUrlPath(input.dataDir, input.providerKind, input.workspaceId);
  if (!existsSync(filePath)) return null;
  const value = readFileSync(filePath, "utf8").trim();
  return value.startsWith("http") ? value : null;
};

export const saveWorkspaceUrl = (input: {
  dataDir: string;
  providerKind: string;
  workspaceId: string;
  url: string | null;
}): void => {
  if (!input.url || !input.url.startsWith("https://")) return;
  mkdirSync(workspaceDir(input.dataDir), { recursive: true });
  writeFileSync(
    workspaceUrlPath(input.dataDir, input.providerKind, input.workspaceId),
    `${input.url}\n`,
  );
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
    allowAnyProviderTab: false,
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
