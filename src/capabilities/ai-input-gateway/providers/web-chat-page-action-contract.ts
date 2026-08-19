import { createHash } from "node:crypto";

import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  WebChatPageActionProof,
  WebChatPageActionId,
} from "../contracts/ai-provider-adapter.contract.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const ref = (value: string | undefined): string | null =>
  value ? hash(value) : null;

export const recordWebChatPageAction = async (input: {
  browser: BrowserTargetSession;
  context: AiProviderAdapterContext;
  actionId: WebChatPageActionId;
  startedAt: string;
  beforeUrl: string | null;
  afterUrl: string | null;
  result: "committed" | "no_op" | "recovery_pending" | "review_required";
  candidateCount?: number;
  semantics?: readonly string[];
  allowDocumentChange?: boolean;
}): Promise<WebChatPageActionProof> => {
  const target = input.browser.getTarget?.() ?? null;
  const endedAt = new Date().toISOString();
  const proofPayload = {
    actionId: input.actionId,
    executionId: input.context.webChatExecution?.executionId ?? null,
    targetRefHash: ref(target?.targetRef),
    documentRefHash: ref(target?.documentRef),
    beforeUrl: input.beforeUrl,
    afterUrl: input.afterUrl,
    candidateCount: input.candidateCount ?? null,
    semantics: [...(input.semantics ?? [])].slice(0, 12),
    result: input.result,
    startedAt: input.startedAt,
    endedAt,
    allowDocumentChange: input.allowDocumentChange === true,
  };
  const evidenceHash = hash(JSON.stringify(proofPayload));
  const proof: WebChatPageActionProof = {
    ...proofPayload,
    evidenceRef: `web-chat-page-action:${evidenceHash.slice(7)}`,
    evidenceHash,
  };
  await input.context.webChatExecution?.onPageActionCommitted(proof);
  return proof;
};

export const assertStableWebChatDocument = (input: {
  browser: BrowserTargetSession;
  expectedDocumentRef: string | null;
  actionId: WebChatPageActionId;
}): void => {
  if (!input.expectedDocumentRef) return;
  const current = input.browser.getTarget?.()?.documentRef ?? null;
  if (current !== input.expectedDocumentRef) {
    throw new Error(`WEB_CHAT_DOCUMENT_CHANGED:${input.actionId}`);
  }
};
