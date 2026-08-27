import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

import {
  buildGptExecutionProfile,
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
type FakeBrowserOptions = Readonly<{ initialPending?: number; initialUrl?: string; unknownMutation?: boolean }>;
type FakeBrowserState = {
  pending: number;
  documentRef: string;
  navigationEpoch: number;
  url: string;
  domCalls: number;
  physicalMutations: number;
};

const createFakeBrowserLease = (
  responder: DomResponder,
  input: FakeBrowserOptions,
  state: FakeBrowserState,
): BrowserTargetLease => ({
    leaseRef: "lease:1",
    authorityRef: "authority:1",
    authorityEpoch: 1,
    executionBindingHash: `sha256:${"a".repeat(64)}`,
    ownerId: "gpt-acceptance",
    agentJobRefHash: `sha256:${"b".repeat(64)}`,
    agentExecutionRefHash: `sha256:${"c".repeat(64)}`,
    writerLeaseEpoch: 1,
    writerFenceHash: `sha256:${"d".repeat(64)}`,
    target: { targetRef: "target:1", authorityEpoch: 1, executionBindingHash: `sha256:${"a".repeat(64)}` },
    get document() {
      return { documentRef: state.documentRef, targetRef: "target:1", navigationEpoch: state.navigationEpoch };
    },
    async navigate(navigation: Readonly<{ url: string }>) {
      state.physicalMutations += 1;
      state.pending += 1;
      state.url = navigation.url;
      state.navigationEpoch += 1;
      state.documentRef = `document:${state.navigationEpoch}`;
      return { documentRef: state.documentRef, targetRef: "target:1", navigationEpoch: state.navigationEpoch };
    },
    async executeDomIntent(intent: BrowserDomIntent) {
      state.domCalls += 1;
      const mutation = intent.kind === "click" || intent.kind === "hover" || intent.kind === "doubleClick"
        || intent.kind === "keypress" || intent.kind === "fill";
      if (mutation) {
        state.physicalMutations += 1;
        if (input.unknownMutation) {
          state.pending += 1;
          throw new Error("BROWSER_OUTCOME_UNKNOWN");
        }
      }
      const value = await responder(intent, state.domCalls);
      if (mutation) state.pending += 1;
      if (intent.kind === "document" && value && typeof value === "object"
        && !Array.isArray(value) && typeof (value as { url?: unknown }).url === "string") {
        const nextUrl = (value as { url: string }).url;
        if (nextUrl !== state.url) {
          state.url = nextUrl;
          state.navigationEpoch += 1;
          state.documentRef = `document:${state.navigationEpoch}`;
        }
      }
      return value;
    },
    async observeCapability() { return {}; },
    async captureScreenshot() {
      return { artifactRef: "screenshot:1", contentHash: `sha256:${"e".repeat(64)}` };
    },
    async attachFile() { state.physicalMutations += 1; state.pending += 1; },
    async registerFileArtifact() {},
    async issueFileArtifactGrant() { throw new Error("UNUSED"); },
    async wait() {},
    async close() { state.physicalMutations += 1; state.pending += 1; },
    async resolvePendingMutation() {
      if (state.pending !== 1) throw new Error("BROWSER_OUTCOME_UNKNOWN");
      state.pending = 0;
      return 1;
    },
    pendingMutationCount: () => state.pending,
    assertNoPendingMutations() {
      if (state.pending !== 0) throw new Error("BROWSER_OUTCOME_UNKNOWN");
    },
  });

const fakeBrowser = (responder: DomResponder, input: FakeBrowserOptions = {}) => {
  const state: FakeBrowserState = {
    pending: input.initialPending ?? 0, documentRef: "document:1", navigationEpoch: 1,
    url: input.initialUrl ?? "https://chatgpt.com/", domCalls: 0, physicalMutations: 0,
  };
  const browser = createFakeBrowserLease(responder, input, state);
  return {
    browser,
    physicalMutations: () => state.physicalMutations,
    documentCalls: () => state.domCalls,
  };
};

const documentResult = { url: "https://chatgpt.com/", title: "ChatGPT" } as const;
const context = (browser: BrowserTargetLease, dataDir = "/tmp/gpt-acceptance") => ({ dataDir, browser });
const execute = (
  id: GptChildCapabilityId,
  browser: BrowserTargetLease,
  input: Readonly<Record<string, unknown>>,
  dataDir?: string,
) => createGptAbilityGroup().execute({ childCapabilityId: id, executionId: `acceptance:${id}`, input }, context(browser, dataDir));

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

let cleanChatFindCall = 0;
const cleanChatFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return documentResult;
  if (intent.kind !== "find") throw new Error(`UNEXPECTED_INTENT:${intent.kind}`);
  cleanChatFindCall += 1;
  if (cleanChatFindCall === 1) {
    assert.deepEqual(intent.waitFor, { minimumMatches: 1, timeoutMs: 5_000 },
      "clean-chat verification must issue one bounded composer-readiness observation");
    return { count: 1 };
  }
  assert.equal(intent.waitFor, undefined, "zero-state assertions must remain immediate after composer readiness");
  return { count: 0 };
});
const cleanChat = await execute("verify_clean_gpt_chat", cleanChatFixture.browser, {});
assert.equal(cleanChat.status, "success");

const profile = buildGptExecutionProfile({
  profileRef: "acceptance:gpt-profile",
  accountCapabilityRef: "acceptance:account-capability",
  modelDisplayName: "GPT-5.6 Sol",
  modelFamily: "gpt-5.6",
  reasoningTier: "pro_standard",
  executorIdentityRef: "acceptance:executor",
  acceptanceRef: "acceptance:gpt-exact-target",
  acceptanceVersion: "v1",
});
let profileFindCall = 0;
const profileDiagnosticFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return documentResult;
  if (intent.kind !== "find") throw new Error(`UNEXPECTED_INTENT:${intent.kind}`);
  profileFindCall += 1;
  if (profileFindCall === 1) return { count: 0, matches: [] };
  if (profileFindCall === 2) return { count: 0 };
  if (profileFindCall === 3) {
    assert.deepEqual(intent.waitFor, { minimumMatches: 1, timeoutMs: 5_000 },
      "profile selection must wait for the independently hydrated model trigger");
    return { count: 0 };
  }
  if (profileFindCall === 4) return { count: 0 };
  assert.deepEqual(intent.fields, ["id", "tagName", "role", "ariaLabel", "ariaExpanded", "testId", "text"]);
  return {
    count: 1,
    matches: [{
      id: "model-switcher",
      tagName: "BUTTON",
      role: "button",
      ariaLabel: "模型选择器",
      ariaExpanded: "false",
      testId: "model-switcher-dropdown-button",
      text: "GPT-5.6",
    }],
  };
});
const profileDiagnostic = await execute("open_gpt_model_selector", profileDiagnosticFixture.browser, { profile });
assert.equal(profileDiagnostic.status, "review_required");
assert.match(profileDiagnostic.failureCode ?? "", /visible=model-switcher~model-switcher-dropdown-button~BUTTON~button~/u);
assert.equal(profileDiagnosticFixture.physicalMutations(), 0,
  "profile drift diagnostics must stay observation-only");

let profileOpenCall = 0;
const profileOpenProofFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return documentResult;
  profileOpenCall += 1;
  if (profileOpenCall === 1 && intent.kind === "find") {
    return { count: 1, matches: [{ role: "", ariaChecked: "", ariaExpanded: "false", text: "Pro" }] };
  }
  if (profileOpenCall === 2 && intent.kind === "find") return { count: 0 };
  if (profileOpenCall === 3 && intent.kind === "find") return { count: 1 };
  if (profileOpenCall === 4 && intent.kind === "click") {
    assert.deepEqual(intent.postClickAttribute, {
      name: "aria-expanded", equals: "true", timeoutMs: 5_000,
    }, "the profile-menu mutation must directly prove the trigger's expanded state");
    return { clicked: true, postconditionVerified: true };
  }
  throw new Error(`UNEXPECTED_PROFILE_OPEN_INTENT:${intent.kind}:${profileOpenCall}`);
});
const profileOpenProof = await execute("open_gpt_model_selector", profileOpenProofFixture.browser, { profile });
assert.equal(profileOpenProof.status, "success");
assert.equal(profileOpenProofFixture.physicalMutations(), 1,
  "opening the profile menu must remain one physical mutation");

let profileAdvancedCall = 0;
const profileAdvancedFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return documentResult;
  profileAdvancedCall += 1;
  if (profileAdvancedCall === 1 && intent.kind === "find") return {
    count: 2,
    matches: [
      { role: "menuitem", ariaChecked: "", ariaExpanded: "false", text: "高级" },
      { role: "menuitem", ariaChecked: "", ariaExpanded: "false", text: "模型 GPT-5.6 Sol" },
    ],
  };
  if (profileAdvancedCall === 2 && intent.kind === "find") return { count: 1 };
  if (profileAdvancedCall === 3 && intent.kind === "find") return { count: 1 };
  if (profileAdvancedCall === 4 && intent.kind === "find") return { count: 1 };
  if (profileAdvancedCall === 5 && intent.kind === "click") {
    assert.equal(intent.selector, "[role='menuitem'][aria-label='显示高级选项']");
    assert.deepEqual(intent.postClickAttribute, {
      name: "aria-expanded", equals: "true", timeoutMs: 5_000,
    });
    return { clicked: true, postconditionVerified: true };
  }
  throw new Error(`UNEXPECTED_PROFILE_ADVANCED_INTENT:${intent.kind}:${profileAdvancedCall}`);
});
const profileAdvanced = await execute("open_gpt_model_selector", profileAdvancedFixture.browser, { profile });
assert.equal(profileAdvanced.status, "success");
assert.equal(profileAdvancedFixture.physicalMutations(), 1,
  "opening advanced options must remain one directly proven mutation");

let profileHoverCall = 0;
const profileHoverFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return documentResult;
  profileHoverCall += 1;
  if (profileHoverCall === 1 && intent.kind === "find") return {
    count: 1,
    matches: [{ role: "menuitem", ariaChecked: "", ariaExpanded: "false", text: "模型 GPT-5.6 Sol" }],
  };
  if (profileHoverCall === 2 && intent.kind === "find") return { count: 1 };
  if (profileHoverCall === 3 && intent.kind === "find") return { count: 1 };
  if (profileHoverCall === 4 && intent.kind === "find") return { count: 0 };
  if (profileHoverCall === 5 && intent.kind === "hover") {
    assert.equal(intent.selector, "[role='menuitem'][aria-haspopup='menu']");
    assert.equal(intent.expectedText, "模型");
    assert.deepEqual(intent.postHoverAttribute, {
      name: "aria-expanded", equals: "true", timeoutMs: 5_000,
    });
    return { hovered: true, postconditionVerified: true };
  }
  throw new Error(`UNEXPECTED_PROFILE_HOVER_INTENT:${intent.kind}:${profileHoverCall}`);
});
const profileHovered = await execute("open_gpt_model_selector", profileHoverFixture.browser, { profile });
assert.equal(profileHovered.status, "success");
assert.equal(profileHoverFixture.physicalMutations(), 1,
  "opening the current model submenu must use one directly proven hover mutation");

let profileOpenReadbackCall = 0;
const profileOpenReadbackFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return documentResult;
  profileOpenReadbackCall += 1;
  if (profileOpenReadbackCall === 1 && intent.kind === "find") return {
    count: 1,
    matches: [{ role: "menuitem", ariaChecked: "", ariaExpanded: "true", text: "模型 GPT-5.6 Sol" }],
  };
  if (profileOpenReadbackCall === 2 && intent.kind === "find") return { count: 2 };
  throw new Error(`UNEXPECTED_PROFILE_READBACK_INTENT:${intent.kind}:${profileOpenReadbackCall}`);
});
const profileOpenReadback = await execute("open_gpt_model_selector", profileOpenReadbackFixture.browser, { profile });
assert.equal(profileOpenReadback.status, "success");
assert.equal(profileOpenReadbackFixture.physicalMutations(), 0,
  "an already expanded exact submenu must be observation-only");

let profileChoiceFindCall = 0;
const profileChoiceDriftFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return documentResult;
  if (intent.kind !== "find") throw new Error(`UNEXPECTED_INTENT:${intent.kind}`);
  profileChoiceFindCall += 1;
  if (profileChoiceFindCall === 2) {
    assert.equal(intent.selector, "[role],button");
    assert.equal(intent.textContains, "GPT-5.6");
    return { count: 0, matches: [] };
  }
  if (profileChoiceFindCall === 3) {
    assert.equal(intent.selector, "[role='menuitem'],[role='menuitemradio'],[role='option'],[role='radio']");
    return {
      count: 1,
      matches: [{
        id: "radix-model-pro",
        tagName: "DIV",
        role: "menuitem",
        ariaLabel: "",
        ariaExpanded: "",
        testId: "model-switcher-gpt-5-6-pro",
        text: "GPT-5.6 Pro",
      }],
    };
  }
  return {
    count: 2,
    matches: [
      { role: "menuitem", ariaChecked: "", ariaExpanded: "", text: "GPT-5.6" },
      { role: "menuitem", ariaChecked: "", ariaExpanded: "", text: "GPT-5.6 Thinking" },
    ],
  };
});
const profileChoiceDrift = await execute("select_exact_gpt_model", profileChoiceDriftFixture.browser, { profile });
assert.equal(profileChoiceDrift.status, "review_required");
assert.match(profileChoiceDrift.failureCode ?? "", /visible=radix-model-pro~model-switcher-gpt-5-6-pro~DIV~menuitem/u);
assert.match(profileChoiceDrift.failureCode ?? "", /surface=menuitem~~~GPT-5.6\|menuitem~~~GPT-5.6%20Thinking/u);
assert.equal(profileChoiceDriftFixture.physicalMutations(), 0,
  "choice-role drift must remain observation-only");

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

const titleUrl = "https://chatgpt.com/c/title-acceptance";
const titleRow = 'a[href="/c/title-acceptance"]';
const titleInput = 'input[aria-label="聊天标题"][name="title-editor"]';
const exactTitle = "八字报告分析";

let titleOpenCall = 0;
const titleOpenFixture = fakeBrowser((intent) => {
  titleOpenCall += 1;
  if (titleOpenCall === 1 && intent.kind === "find") {
    assert.equal(intent.selector, titleInput);
    return { count: 0 };
  }
  if (titleOpenCall === 2 && intent.kind === "find") {
    assert.equal(intent.selector, titleRow);
    return { count: 1 };
  }
  if (titleOpenCall === 3 && intent.kind === "doubleClick") {
    assert.equal(intent.selector, titleRow);
    assert.equal(intent.expectedMatches, 1);
    assert.deepEqual(intent.postDoubleClickMatch, {
      selector: titleInput, expectedMatches: 1, timeoutMs: 5_000,
    });
    return { doubleClicked: true, postconditionVerified: true };
  }
  throw new Error(`UNEXPECTED_TITLE_OPEN_INTENT:${intent.kind}:${titleOpenCall}`);
});
const titleOpened = await execute("open_gpt_title_control", titleOpenFixture.browser, {
  canonicalConversationUrl: titleUrl,
});
assert.equal(titleOpened.status, "success");
assert.equal(titleOpenFixture.physicalMutations(), 1,
  "the real Chrome double-click title editor entry must remain one physical mutation");

let titleWriteCall = 0;
const titleWriteFixture = fakeBrowser((intent) => {
  titleWriteCall += 1;
  if (titleWriteCall === 1 && intent.kind === "find") return { count: 1 };
  if (titleWriteCall === 2 && intent.kind === "fill") {
    assert.equal(intent.selector, titleInput);
    assert.equal(intent.approvedText, exactTitle);
    return { retainedValueVerified: true };
  }
  throw new Error(`UNEXPECTED_TITLE_WRITE_INTENT:${intent.kind}:${titleWriteCall}`);
});
const titleWritten = await execute("write_exact_gpt_title", titleWriteFixture.browser, { title: exactTitle });
assert.equal(titleWritten.status, "success");
assert.equal(titleWriteFixture.physicalMutations(), 1);

let titleCommitCall = 0;
const titleCommitFixture = fakeBrowser((intent) => {
  titleCommitCall += 1;
  if (titleCommitCall === 1 && intent.kind === "find") return { count: 1 };
  if (titleCommitCall === 2 && intent.kind === "keypress") {
    assert.equal(intent.selector, titleInput);
    assert.equal(intent.key, "Enter");
    assert.deepEqual(intent.postKeypressMatch, {
      selector: titleRow, expectedMatches: 1, timeoutMs: 5_000,
    });
    return { keyPressed: "Enter", postconditionVerified: true };
  }
  if (titleCommitCall === 3 && intent.kind === "readText") return exactTitle;
  throw new Error(`UNEXPECTED_TITLE_COMMIT_INTENT:${intent.kind}:${titleCommitCall}`);
});
const titleCommitted = await execute("commit_gpt_title", titleCommitFixture.browser, {
  canonicalConversationUrl: titleUrl,
  title: exactTitle,
  timeoutMs: 5_000,
});
assert.equal(titleCommitted.status, "success");
assert.equal(titleCommitFixture.physicalMutations(), 1,
  "the real Chrome Enter commit must remain one physical mutation");

const titleReadbackFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return { url: titleUrl, title: "ChatGPT" };
  if (intent.kind === "readText") return exactTitle;
  if (intent.kind === "find") return { count: 1 };
  throw new Error(`UNEXPECTED_TITLE_READBACK_INTENT:${intent.kind}`);
}, { initialUrl: titleUrl });
const titleReadback = await execute("verify_exact_gpt_title", titleReadbackFixture.browser, {
  canonicalConversationUrl: titleUrl,
  title: exactTitle,
  turnMarker: "[GPT-TURN:title-acceptance]",
});
assert.equal(titleReadback.status, "success");
assert.equal(titleReadbackFixture.physicalMutations(), 0);

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

const imageDirectory = await mkdtemp(join(tmpdir(), "gpt-image-acceptance-"));
try {
  const originalImage = await sharp({
    create: { width: 16, height: 9, channels: 4, background: { r: 20, g: 80, b: 160, alpha: 1 } },
  }).png().withMetadata({ orientation: 6 }).toBuffer();
  const source = `data:image/png;base64,${originalImage.toString("base64")}`;
  const imageFixture = fakeBrowser((intent) => {
    if (intent.kind === "document") return documentResult;
    if (intent.kind === "find") return { count: 1 };
    if (intent.kind === "readAttribute") return source;
    throw new Error(`UNEXPECTED_IMAGE_INTENT:${intent.kind}`);
  });
  const imageResult = await execute("checkpoint_gpt_generated_image", imageFixture.browser, {
    assistantTurnId: "conversation-turn-2",
  }, imageDirectory);
  assert.equal(imageResult.status, "success", imageResult.failureCode ?? "image checkpoint failed");
  const artifact = imageResult.value as Readonly<{
    localPath: string; originalLocalPath: string; sha256: string; originalSha256: string; bytes: number;
    mediaType: string; width: number; height: number;
  }>;
  const bytes = await readFile(artifact.localPath);
  const originalReadback = await readFile(artifact.originalLocalPath);
  const metadata = await sharp(bytes).metadata();
  assert.equal(artifact.originalSha256, `sha256:${createHash("sha256").update(originalImage).digest("hex")}`);
  assert.deepEqual(originalReadback, originalImage, "the exact Provider bytes must remain in the task-owned private directory");
  assert.equal(artifact.sha256, `sha256:${createHash("sha256").update(bytes).digest("hex")}`);
  assert.equal(artifact.bytes, bytes.byteLength);
  assert.deepEqual([artifact.mediaType, artifact.width, artifact.height], ["image/webp", 1200, 630]);
  assert.deepEqual([metadata.format, metadata.width, metadata.height], ["webp", 1200, 630]);
  assert.equal(Boolean(metadata.exif || metadata.icc || metadata.iptc || metadata.xmp), false);
} finally {
  await rm(imageDirectory, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE][gpt] PASS\n");
const clauses = ["summary", ...Array.from({ length: 15 }, (_, index) => `forbidden:${index}`)]
  .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
for (const evidenceMode of ["exam.golden", "exam.property", "exam.state-machine"] as const) {
  emitQualityProofObservation({
    passed: true,
    findings: [],
    lawId: "LAW-GPT-001-V2",
    evidenceMode,
    clauses,
    locator: `acceptance:gpt:${evidenceMode}`,
    observedValue: "43 exact children, bounded clean-chat composer readiness, no hidden Facade DOM reads, 0/1/many candidates, long prompt, exact attachments, document drift, UNKNOWN no-replay, and checkpoint-safe title failure passed",
  });
}
