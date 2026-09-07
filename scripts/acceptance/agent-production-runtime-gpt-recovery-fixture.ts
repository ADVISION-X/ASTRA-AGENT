import { createHash } from "node:crypto";

import type {
  BrowserAtomicStepIdentity,
  BrowserDomIntent,
  BrowserDomObservationQuery,
  BrowserTargetLease,
} from "../../src/lib/browser/browser-authority-api.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const recoveryConversationIdentityHash = (input: Readonly<{
  canonicalConversationUrl: string;
  turnMarker: string;
  userTurnId: string;
  promptHash: `sha256:${string}`;
}>): `sha256:${string}` => hash([
  input.canonicalConversationUrl,
  input.turnMarker,
  input.userTurnId,
  input.promptHash,
].join("\n"));

type ObservationFact = Readonly<{
  rawCount: number;
  eligibleCount: number;
  matches?: readonly Readonly<Record<string, unknown>>[];
}>;

export const recoveryObservationPacket = (
  intent: Readonly<{ queries: readonly BrowserDomObservationQuery[] }>,
  facts: Readonly<Record<string, ObservationFact>>,
  currentUrl: string,
) => Object.freeze({
  schemaVersion: "grasseye.browser.dom-observation.v2" as const,
  exactCallIdentityHash: `sha256:${"1".repeat(64)}` as `sha256:${string}`,
  targetRefHash: `sha256:${"2".repeat(64)}` as `sha256:${string}`,
  documentRefHash: `sha256:${"3".repeat(64)}` as `sha256:${string}`,
  observationRevisionHash: `sha256:${"4".repeat(64)}` as `sha256:${string}`,
  currentUrl,
  observedAt: "2026-09-03T00:00:00.004Z",
  queries: intent.queries.map((query) => {
    const fact = facts[query.queryId] ?? { rawCount: 0, eligibleCount: 0 };
    return Object.freeze({
      queryId: query.queryId,
      scopeRawCount: query.scope ? 1 : 0,
      scopeEligibleCount: query.scope ? 1 : 0,
      rawCount: fact.rawCount,
      eligibleCount: fact.eligibleCount,
      matches: Object.freeze([...(fact.matches ?? [])]),
      scopeRejections: Object.freeze([]),
      rejections: Object.freeze([]),
      nativeCauseCode: null,
      nativeCauseCount: 0,
      nativeStage: "runtime-call-function-on" as const,
    });
  }),
});

export const recoveryAssistantTurnReply = (
  intent: Extract<BrowserDomIntent, { kind: "readExactAssistantTurn" }>,
  semanticText: string,
) => {
  const rawDomHtml = `<section data-testid="${intent.assistantTurnId}"><div data-message-author-role="assistant">${semanticText}</div></section>`;
  return Object.freeze({
    schemaVersion: "grasseye.browser.exact-assistant-turn.v2" as const,
    exactCallIdentityHash: `sha256:${"5".repeat(64)}` as `sha256:${string}`,
    targetRefHash: `sha256:${"2".repeat(64)}` as `sha256:${string}`,
    documentRefHash: `sha256:${"3".repeat(64)}` as `sha256:${string}`,
    observationRevisionHash: `sha256:${"6".repeat(64)}` as `sha256:${string}`,
    assistantTurnId: intent.assistantTurnId,
    currentUrl: intent.sourceCheckpoint.canonicalConversationUrl,
    precedingUserTurnId: "conversation-turn-1",
    precedingPromptHash: intent.sourceCheckpoint.expectedPromptHash,
    turnMarkerMatched: true as const,
    generatingRaw: 0,
    rawDomHtml,
    rawDomHash: hash(rawDomHtml),
    semanticText,
    semanticTextHash: hash(semanticText),
    observedAt: "2026-09-03T00:00:00.004Z",
  });
};

export const recoveryBrowserLease = (
  responder: (intent: BrowserDomIntent) => unknown,
): BrowserTargetLease => {
  let atomicIdentity: BrowserAtomicStepIdentity | null = null;
  return {
    leaseRef: "lease:runtime-task-exact-effect",
    authorityRef: "authority:runtime-task-exact-effect",
    authorityEpoch: 1,
    executionBindingHash: `sha256:${"a".repeat(64)}`,
    ownerId: "agent-production-runtime-acceptance",
    agentJobRefHash: `sha256:${"b".repeat(64)}`,
    agentExecutionRefHash: `sha256:${"c".repeat(64)}`,
    writerLeaseEpoch: 1,
    writerFenceHash: `sha256:${"d".repeat(64)}`,
    target: { targetRef: "target:1", authorityEpoch: 1, executionBindingHash: `sha256:${"a".repeat(64)}` },
    document: { documentRef: "document:1", targetRef: "target:1", navigationEpoch: 1 },
    async runAtomicStep(identity, action) {
      atomicIdentity = identity;
      try { return await action(); } finally { atomicIdentity = null; }
    },
    readAtomicStepRecovery: () => null,
    requiresMutationRecovery: () => false,
    async navigate() { throw new Error("UNEXPECTED_RECOVERY_NAVIGATION"); },
    async executeDomIntent(intent) { return responder(intent); },
    async observeCapability() { return {}; },
    async captureScreenshot() { throw new Error("UNEXPECTED_RECOVERY_SCREENSHOT"); },
    async attachFile() { throw new Error("UNEXPECTED_RECOVERY_ATTACHMENT"); },
    async downloadAuthenticatedMedia() { throw new Error("UNEXPECTED_RECOVERY_MEDIA_DOWNLOAD"); },
    async wait() {},
    async park() {},
    async close() {},
    async resolvePendingMutation() { throw new Error("UNEXPECTED_RECOVERY_MUTATION_RESOLUTION"); },
    pendingMutationCount: () => 0,
    assertNoPendingMutations() { if (atomicIdentity) return; },
  };
};
