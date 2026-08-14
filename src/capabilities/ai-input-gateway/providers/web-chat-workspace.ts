import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

const DEEP_RESEARCH_WORKSPACE_ID = "deep-research";
const FULL_CORPUS_WORKSPACE_ID = "full-corpus";

const workspaceDir = (dataDir: string): string =>
  path.join(dataDir, "runtime-data", "ai-input-gateway", "web-chat-workspaces");

const workspaceUrlPath = (dataDir: string, providerKind: string, workspaceId: string): string =>
  path.join(workspaceDir(dataDir), `${providerKind}-${workspaceId}.url`);

const workspaceConversationLedgerPath = (dataDir: string, providerKind: string, workspaceId: string): string =>
  path.join(workspaceDir(dataDir), `${providerKind}-${workspaceId}-conversation-urls.json`);

const WORKSPACE_CONVERSATION_LEDGER_MAX_ENTRIES = 100;

export const normalizeWorkspaceUrl = (input: {
  workspaceId: string;
  url: string | null;
}): string | null => {
  return input.url?.startsWith("https://") ? input.url : null;
};

export const resolveWebChatWorkspaceId = (request: AiFeedInput): string | null =>
  request.promptContractId.includes("deep-research.")
    ? DEEP_RESEARCH_WORKSPACE_ID
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
  const next = [...existing, input.url].slice(-WORKSPACE_CONVERSATION_LEDGER_MAX_ENTRIES);
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
  return "exact_target_single_provider_no_stale_physical_tabs";
};

export const focusExistingWorkspaceTab = async (input: {
  browser: BrowserTargetSession;
  providerHost: string;
  workspaceId: string;
  savedUrl: string | null;
  allowAnyProviderTab: boolean;
  abortSignal?: AbortSignal;
}): Promise<boolean> => {
  const url = input.savedUrl ?? `https://${input.providerHost}/`;
  try {
    const result = await input.browser.open({
      url,
      title: `AI workspace ${input.workspaceId}`,
      reusePolicy: "reuse-exact-url",
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    });
    return result.ok;
  } catch {
    return false;
  }
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
  const browser = input.context.browser;
  if (!browser) throw new Error("review_required: exact provider target is unavailable.");
  const focused = await focusExistingWorkspaceTab({
    browser,
    providerHost: new URL(input.providerUrl).host,
    workspaceId,
    savedUrl,
    allowAnyProviderTab: workspaceId === "full-corpus" || input.allowAnyProviderTab === true,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  if (!focused) {
    throw new Error("review_required: provider workspace tab was not focused before web-chat action.");
  }
};
