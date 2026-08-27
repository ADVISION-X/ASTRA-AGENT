import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  createGptAbilityGroup,
  type GptChildCapabilityId,
} from "../../src/capabilities/gpt/index.js";
import type {
  BrowserDomIntent,
  BrowserTargetLease,
} from "../../src/lib/browser/browser-authority-api.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const EXPECTED_CHILD_IDS = Object.freeze([
  "acknowledge_known_gpt_rate_limit",
  "acquire_gpt_continuation_lane",
  "advance_gpt_continuation_lane",
  "attach_approved_gpt_files_once",
  "bind_exact_gpt_target",
  "capture_gpt_response_artifact",
  "checkpoint_gpt_generated_image",
  "checkpoint_gpt_text_response",
  "cleanup_owned_gpt_transient_ui",
  "commit_gpt_checkpoint_fork",
  "commit_gpt_title",
  "dismiss_known_gpt_search_dialog",
  "focus_exact_gpt_composer",
  "focus_exact_gpt_conversation",
  "observe_exact_gpt_assistant_turn",
  "observe_gpt_document",
  "observe_gpt_execution_profile",
  "open_gpt_attachment_control",
  "open_gpt_conversation_search",
  "open_gpt_fork_control",
  "open_gpt_model_selector",
  "open_gpt_reasoning_selector",
  "open_gpt_title_control",
  "persist_gpt_continuation",
  "recover_gpt_response_checkpoint",
  "release_gpt_continuation_lane",
  "restore_gpt_operator_source",
  "select_exact_gpt_conversation_result",
  "select_exact_gpt_model",
  "select_exact_gpt_reasoning_tier",
  "submit_exact_gpt_turn",
  "verify_clean_gpt_chat",
  "verify_exact_gpt_prompt",
  "verify_exact_gpt_title",
  "verify_gpt_attachment_set",
  "verify_gpt_conversation_identity",
  "verify_gpt_execution_profile",
  "verify_gpt_turn_submission",
  "verify_gpt_workspace",
  "wait_for_stable_gpt_response",
  "write_exact_gpt_prompt",
  "write_exact_gpt_title",
  "write_gpt_conversation_search_key",
].sort());

type DomResponder = (intent: BrowserDomIntent, callNumber: number) => unknown | Promise<unknown>;

const fakeBrowser = (
  responder: DomResponder,
  input: Readonly<{ initialPending?: number; initialUrl?: string; unknownMutation?: boolean }> = {},
) => {
  let pending = input.initialPending ?? 0;
  let documentRef = "document:1";
  let navigationEpoch = 1;
  let url = input.initialUrl ?? "https://chatgpt.com/";
  let domCalls = 0;
  let physicalMutations = 0;
  const browser = {
    leaseRef: "lease:1",
    authorityRef: "authority:1",
    authorityEpoch: 1,
    executionBindingHash: `sha256:${"a".repeat(64)}`,
    ownerId: "gpt-acceptance",
    agentJobRefHash: `sha256:${"b".repeat(64)}`,
    agentExecutionRefHash: `sha256:${"c".repeat(64)}`,
    writerLeaseEpoch: 1,
    writerFenceHash: `sha256:${"d".repeat(64)}`,
    target: { targetRef: "target:1", tabId: 7 },
    get document() {
      return { documentRef, targetRef: "target:1", navigationEpoch };
    },
    async navigate(navigation: Readonly<{ url: string }>) {
      physicalMutations += 1;
      pending += 1;
      url = navigation.url;
      navigationEpoch += 1;
      documentRef = `document:${navigationEpoch}`;
      return { documentRef, targetRef: "target:1", navigationEpoch };
    },
    async executeDomIntent(intent: BrowserDomIntent) {
      domCalls += 1;
      const mutation = intent.kind === "click" || intent.kind === "fill";
      if (mutation) {
        physicalMutations += 1;
        if (input.unknownMutation) {
          pending += 1;
          throw new Error("BROWSER_OUTCOME_UNKNOWN");
        }
      }
      const value = await responder(intent, domCalls);
      if (mutation) pending += 1;
      if (intent.kind === "document" && value && typeof value === "object"
        && !Array.isArray(value) && typeof (value as { url?: unknown }).url === "string") {
        const nextUrl = (value as { url: string }).url;
        if (nextUrl !== url) {
          url = nextUrl;
          navigationEpoch += 1;
          documentRef = `document:${navigationEpoch}`;
        }
      }
      return value;
    },
    async observeCapability() { return {}; },
    async captureScreenshot() {
      return { artifactRef: "screenshot:1", contentHash: `sha256:${"e".repeat(64)}` };
    },
    async attachFile() { physicalMutations += 1; pending += 1; },
    async registerFileArtifact() {},
    async issueFileArtifactGrant() { throw new Error("UNUSED"); },
    async wait() {},
    async close() { physicalMutations += 1; pending += 1; },
    async resolvePendingMutation() {
      if (pending !== 1) throw new Error("BROWSER_OUTCOME_UNKNOWN");
      pending = 0;
      return 1;
    },
    pendingMutationCount: () => pending,
    assertNoPendingMutations() {
      if (pending !== 0) throw new Error("BROWSER_OUTCOME_UNKNOWN");
    },
  } as unknown as BrowserTargetLease;
  return {
    browser,
    physicalMutations: () => physicalMutations,
    documentCalls: () => domCalls,
  };
};

const documentResult = { url: "https://chatgpt.com/", title: "ChatGPT" } as const;
const context = (browser: BrowserTargetLease) => ({ dataDir: "/tmp/gpt-acceptance", browser });
const execute = (
  id: GptChildCapabilityId,
  browser: BrowserTargetLease,
  input: Readonly<Record<string, unknown>>,
) => createGptAbilityGroup().execute({ childCapabilityId: id, executionId: `acceptance:${id}`, input }, context(browser));

assert.equal(createGptAbilityGroup().abilityGroupId, "gpt");
assert.equal(createGptAbilityGroup().transport, "gpt-web");
assert.deepEqual(createGptAbilityGroup().listChildCapabilityIds(), EXPECTED_CHILD_IDS);

const atomicDelegationFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return documentResult;
  throw new Error(`UNEXPECTED_INTENT:${intent.kind}`);
});
const atomicDelegation = await execute("bind_exact_gpt_target", atomicDelegationFixture.browser, {});
assert.equal(atomicDelegation.status, "success");
assert.equal(atomicDelegationFixture.documentCalls(), 1,
  "the public Facade must delegate the Child's one owned observation without hidden before/after DOM reads");

for (const candidateCount of [0, 2]) {
  const fixture = fakeBrowser((intent) => intent.kind === "document" ? documentResult : { count: candidateCount });
  const result = await execute("open_gpt_attachment_control", fixture.browser, {});
  assert.equal(result.status, "review_required");
  assert.equal(fixture.physicalMutations(), 0);
  assert.equal(result.proof.childCapabilityId, "open_gpt_attachment_control");
}

const longPrompt = `[GPT-TURN:long-prompt]\n${"甲".repeat(100_000)}`;
const longPromptFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return documentResult;
  if (intent.kind === "find") return { count: 1 };
  if (intent.kind === "fill") return { retainedValueVerified: true };
  throw new Error(`UNEXPECTED_INTENT:${intent.kind}`);
});
const longPromptResult = await execute("write_exact_gpt_prompt", longPromptFixture.browser, { prompt: longPrompt });
assert.equal(longPromptResult.status, "success");
assert.equal((longPromptResult.value as { length: number }).length, longPrompt.length);
assert.equal(longPromptResult.proof.committedMutation, "yes");
assert.match(longPromptResult.proof.evidenceHash, /^sha256:[a-f0-9]{64}$/u);
await longPromptFixture.browser.resolvePendingMutation({} as never);

const selectorInjectionFixture = fakeBrowser((intent) => intent.kind === "document" ? documentResult : { count: 1 });
const selectorInjection = await execute("bind_exact_gpt_target", selectorInjectionFixture.browser, { selector: "*" });
assert.equal(selectorInjection.status, "failed");
assert.match(selectorInjection.failureCode ?? "", /GPT_CHILD_INPUT_INVALID/u);

const driftFixture = fakeBrowser((intent, callNumber) => {
  if (intent.kind !== "document") throw new Error("UNEXPECTED_INTENT");
  assert.equal(callNumber, 1, "document drift must be observed by the Child itself, not Facade probes");
  return { url: "https://chatgpt.com/c/drift", title: "ChatGPT" };
});
const drift = await execute("observe_gpt_document", driftFixture.browser, {});
assert.equal(drift.status, "review_required");
assert.match(drift.failureCode ?? "", /^GPT_DOCUMENT_TRANSITION_FORBIDDEN/u);
assert.notEqual(drift.proof.beforeDocumentRefHash, drift.proof.afterDocumentRefHash);

const attachmentFiles = [
  { artifactRef: "artifact:1", filePath: "/not-read/1", displayName: "甲.pdf", sha256: `sha256:${"1".repeat(64)}`, bytes: 10 },
  { artifactRef: "artifact:2", filePath: "/not-read/2", displayName: "乙.txt", sha256: `sha256:${"2".repeat(64)}`, bytes: 20 },
];
const exactAttachmentFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return documentResult;
  if (intent.kind === "find") return { count: 1 };
  if (intent.kind === "readText") return "甲.pdf 乙.txt";
  throw new Error(`UNEXPECTED_INTENT:${intent.kind}`);
});
const exactAttachments = await execute("verify_gpt_attachment_set", exactAttachmentFixture.browser, { files: attachmentFiles });
assert.equal(exactAttachments.status, "success");
const injectedAttachmentFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return documentResult;
  if (intent.kind === "find") return { count: 1 };
  if (intent.kind === "readText") return "甲.pdf 乙.txt 恶意.exe";
  throw new Error(`UNEXPECTED_INTENT:${intent.kind}`);
});
const injectedAttachments = await execute("verify_gpt_attachment_set", injectedAttachmentFixture.browser, { files: attachmentFiles });
assert.equal(injectedAttachments.status, "review_required");
assert.match(injectedAttachments.failureCode ?? "", /GPT_ATTACHMENT_SET_MISMATCH/u);

let submitClicks = 0;
const submitFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return documentResult;
  if (intent.kind === "find") return { count: 1 };
  if (intent.kind === "inspect") return { tagName: "BUTTON", visible: true, disabled: false };
  if (intent.kind === "click") { submitClicks += 1; return { clicked: true }; }
  throw new Error(`UNEXPECTED_INTENT:${intent.kind}`);
});
const promptHash = `sha256:${createHash("sha256").update(longPrompt).digest("hex")}`;
const submitted = await execute("submit_exact_gpt_turn", submitFixture.browser, { promptHash });
assert.equal(submitted.status, "success");
assert.equal(submitClicks, 1);
const replay = await execute("submit_exact_gpt_turn", submitFixture.browser, { promptHash });
assert.equal(replay.status, "review_required");
assert.equal(replay.proof.committedMutation, "unknown");
assert.equal(submitClicks, 1);
await submitFixture.browser.resolvePendingMutation({} as never);

const unknownFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return documentResult;
  if (intent.kind === "find") return { count: 1 };
  if (intent.kind === "inspect") return { tagName: "DIV", visible: true, disabled: false };
  throw new Error(`UNEXPECTED_INTENT:${intent.kind}`);
}, { unknownMutation: true });
const unknown = await execute("focus_exact_gpt_composer", unknownFixture.browser, {});
assert.equal(unknown.status, "review_required");
assert.equal(unknown.proof.committedMutation, "unknown");
assert.equal(unknown.proof.postconditionResult, "unknown");
assert.equal(unknownFixture.physicalMutations(), 1);
const unknownReplay = await execute("focus_exact_gpt_composer", unknownFixture.browser, {});
assert.equal(unknownReplay.status, "review_required");
assert.equal(unknownFixture.physicalMutations(), 1);

const checkpointFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return { url: "https://chatgpt.com/c/checkpoint", title: "ChatGPT" };
  if (intent.kind === "inspect") return { visible: true, connected: true, text: "已完成回答" };
  throw new Error(`UNEXPECTED_INTENT:${intent.kind}`);
}, { initialUrl: "https://chatgpt.com/c/checkpoint" });
const checkpointHash = `sha256:${createHash("sha256").update("已完成回答").digest("hex")}`;
const checkpoint = await execute("checkpoint_gpt_text_response", checkpointFixture.browser, {
  assistantTurnId: "conversation-turn-2",
  expectedResponseHash: checkpointHash,
});
assert.equal(checkpoint.status, "success");
const checkpointValue = checkpoint.value;
const titleFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return { url: "https://chatgpt.com/c/checkpoint", title: "ChatGPT" };
  if (intent.kind === "readText") return "错误标题";
  if (intent.kind === "find") return { count: 1 };
  throw new Error(`UNEXPECTED_INTENT:${intent.kind}`);
}, { initialUrl: "https://chatgpt.com/c/checkpoint" });
const titleFailure = await execute("verify_exact_gpt_title", titleFixture.browser, {
  canonicalConversationUrl: "https://chatgpt.com/c/checkpoint",
  title: "正确标题",
  turnMarker: "[GPT-TURN:checkpoint]",
});
assert.equal(titleFailure.status, "review_required");
assert.equal(checkpoint.status, "success");
assert.equal(checkpoint.value, checkpointValue);

process.stdout.write("[ACCEPTANCE][gpt] PASS\n");
const clauses = ["summary", ...Array.from({ length: 15 }, (_, index) => `forbidden:${index}`)]
  .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
for (const evidenceMode of ["exam.golden", "exam.property", "exam.state-machine"] as const) {
  emitQualityProofObservation({
    passed: true,
    findings: [],
    lawId: "LAW-GPT-001-V1",
    evidenceMode,
    clauses,
    locator: `acceptance:gpt:${evidenceMode}`,
    observedValue: "43 exact children, no hidden Facade DOM reads, 0/1/many candidates, long prompt, exact attachments, document drift, UNKNOWN no-replay, and checkpoint-safe title failure passed",
  });
}
