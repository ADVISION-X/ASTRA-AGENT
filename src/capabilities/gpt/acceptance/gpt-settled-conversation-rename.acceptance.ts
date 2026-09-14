import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import routePolicy from "../../../lib/local-runtime/production/website-agent-route-policies.v1.json" with { type: "json" };
import { hashCanonical } from "../../../lib/local-runtime/production/contracts.js";
import { createGptAbilityGroup } from "../index.js";
import { ProductionGptChildTools } from "../production-child-tools.js";
import { ProductionGptBrowserLifecycle } from "../production-browser-lifecycle.js";
import { productionGptAtomicIdentity } from "../production-atomic-call.js";
import type { GptChildCapabilityIntent } from "../contract.js";
import {
  RENAME_PROJECT_TITLES,
  settledGptConversationTitle,
} from "../children/rename_settled_gpt_conversation/title.js";
import { fakeBrowser } from "./gpt-exact-target-browser-fixture.js";

const jobId = "aiprod_12345678-1234-4123-8123-123456789012";
const terminalAt = "2026-09-14T20:30:00.000Z";
const canonicalConversationUrl = "https://chatgpt.com/c/12345678-1234-4123-8123-123456789012";
const routeProductIds = [...new Set(routePolicy.routes.map((route) => route.product_id))].sort();
assert.deepEqual(Object.keys(RENAME_PROJECT_TITLES).sort(), routeProductIds,
  "the one rename Child must exhaustively own the current route product denominator");
assert.equal(settledGptConversationTitle({
  jobId, productId: "bazi_ai_full_analysis", terminalAt,
}), "0915·八字分析·aiprod_12345678");
assert.throws(() => settledGptConversationTitle({
  jobId, productId: "unknown", terminalAt,
}), /GPT_SETTLED_RENAME_PRODUCT_ID_INVALID/u);
assert.throws(() => settledGptConversationTitle({
  jobId: "job:wrong", productId: "bazi_ai_full_analysis", terminalAt,
}), /GPT_SETTLED_RENAME_JOB_ID_INVALID/u);

const executeRename = async (mutationCount: 0 | 4) => {
  let observedIntent: unknown = null;
  const fake = fakeBrowser((intent) => {
    observedIntent = intent;
    return mutationCount === 0
      ? { renameState: "already-exact", candidateCount: 1, identityRevalidated: true,
        mutationCount: 0, postconditionVerified: true }
      : { renameState: "renamed", candidateCount: 1, identityRevalidated: true,
        mutationCount: 4, postconditionVerified: true };
  }, { initialUrl: canonicalConversationUrl });
  const input = {
    canonicalConversationUrl, jobId, productId: "bazi_ai_full_analysis", terminalAt,
    timeoutMs: 2500 as const,
  };
  const intent = Object.freeze({
    childCapabilityId: "rename_settled_gpt_conversation",
    executionId: `acceptance:gpt-settled-rename:${mutationCount}`,
    jobId,
    attemptId: "attempt:gpt-settled-rename",
    resultRevision: 0,
    productStepId: "gpt-settled-conversation-cleanup",
    callId: "rename-current-conversation",
    inputHash: hashCanonical(input),
    actionOrdinal: 1,
    input,
  }) satisfies GptChildCapabilityIntent<"rename_settled_gpt_conversation">;
  const identity = productionGptAtomicIdentity(intent, 0);
  const result = await fake.browser.runAtomicStep(identity, () => createGptAbilityGroup().execute(intent, {
    dataDir: "/tmp/gpt-settled-rename",
    browser: fake.browser,
    browserAtomicIdentity: identity,
  }));
  assert.equal(result.status, "success");
  if (result.status !== "success") throw new Error("GPT_SETTLED_RENAME_ACCEPTANCE_FAILED");
  assert.equal(result.value.physicalInputCount, mutationCount);
  assert.equal(result.value.targetTitle, "0915·八字分析·aiprod_12345678");
  assert.deepEqual(observedIntent, {
    kind: "renameExactGptConversation",
    canonicalConversationUrl,
    targetTitle: "0915·八字分析·aiprod_12345678",
    timeoutMs: 2500,
  });
};

await executeRename(0);
await executeRename(4);

let cleanupAttempts = 0;
let parks = 0;
const nonBlockingTools = new ProductionGptChildTools(
  "/tmp/gpt-settled-rename-cleanup", hashCanonical("source"), {} as never, {} as never,
  {} as never, {} as never,
);
(nonBlockingTools as never as { executeOne: () => Promise<never> }).executeOne = async () => {
  cleanupAttempts += 1;
  throw new Error("BROWSER_POSTCONDITION_FAILED");
};
const cleanupInput = {
  jobId, attemptId: "attempt:gpt-settled-rename", resultRevision: 0,
  productId: "bazi_ai_full_analysis", ownerRef: "owner:rename", subjectRef: "subject:rename",
  authorizationRef: "authorization:rename", deviceId: "device:rename", leaseVersion: 1,
  executionFenceHash: hashCanonical("fence"), capabilityManifestHash: hashCanonical("manifest"),
  expiresAtMonotonic: performance.now() + 20_000, commandTtlMs: 20_000,
  abortSignal: new AbortController().signal, parentSpanId: "span:rename", maxProviderTurns: 1,
};
const cleanupLifecycle = {
  cleanupTaken: false,
  takeSettledConversationCleanup() {
    if (this.cleanupTaken) return null;
    this.cleanupTaken = true;
    return { sessionKey: "session:rename", canonicalConversationUrl, terminalAt };
  },
  recordSettledRenameTransportRevocation: () => undefined,
  settle: async () => { parks += 1; },
};
await (nonBlockingTools as never as {
  settleExecution(input: unknown, browsers: unknown, error: unknown | null): Promise<void>;
}).settleExecution(cleanupInput, cleanupLifecycle, null);
assert.deepEqual([cleanupAttempts, parks], [1, 1],
  "rename failure must be cleanup-only and the original Browser park must still execute");
await (nonBlockingTools as never as {
  settleExecution(input: unknown, browsers: unknown, error: unknown | null): Promise<void>;
}).settleExecution(cleanupInput, cleanupLifecycle, new Error("PRODUCT_FAILED"));
assert.deepEqual([cleanupAttempts, parks], [1, 2],
  "a later Product failure must not attempt the already-consumed rename Child again");

let revokedParkAttempts = 0;
const revokedLifecycle = new ProductionGptBrowserLifecycle(
  {} as never, {} as never, hashCanonical("source"), {
    jobId, attemptId: "attempt:gpt-settled-rename", resultRevision: 0,
    deviceId: "device:rename", leaseVersion: 1,
    executionFenceHash: hashCanonical("fence"),
    capabilityManifestHash: hashCanonical("manifest"),
    expiresAtMonotonic: performance.now() + 20_000, commandTtlMs: 20_000,
    abortSignal: new AbortController().signal,
  },
);
(revokedLifecycle as never as { activeBrowser: unknown }).activeBrowser = {
  sessionKey: "session:rename",
  call: {
    browser: {
      park: async () => {
        revokedParkAttempts += 1;
        throw new Error("BROWSER_TARGET_LIFECYCLE_UNSETTLED");
      },
      pendingMutationCount: () => 0,
    },
    settledConversationRenameTaken: true,
    settledRenameTransportRevoked: true,
  },
};
await revokedLifecycle.settle(null);
assert.equal(revokedParkAttempts, 1,
  "an exact rename missing-reply transport revocation must attempt the original park boundary once");
assert.equal((revokedLifecycle as never as { activeBrowser: unknown }).activeBrowser, null,
  "the already-revoked exact target must release the lifecycle without replacing Product success");
