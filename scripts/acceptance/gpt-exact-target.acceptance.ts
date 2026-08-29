import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

import {
  GPT_MODEL_SELECTION_VERSION,
  GPT_TURN_FLOW_VERSION,
  buildGptExecutionProfile,
  createGptAbilityGroup,
  GptTurnExecutor,
  type GptChildCapabilityId,
} from "../../src/capabilities/gpt/index.js";
import type { BrowserDomIntent, BrowserTargetLease } from "../../src/lib/browser/browser-authority-api.js";
import { closeSettledGptBrowser } from "../../src/lib/local-runtime/production/production-gpt-turn-flow.js";
import { executionFailure } from "../../src/lib/typed-failure.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { EXPECTED_GPT_CHILD_IDS, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";

const INPUT_HASH = `sha256:${"a".repeat(64)}` as const;
const GPT_PROFILE_TRIGGER_SELECTOR = "main button[aria-haspopup='menu'][data-tone='neutral']:not([aria-label])";
const GPT_PROFILE_POPUP_SELECTOR = "[role='menu']:has([data-testid='composer-model-picker-slider-simple-view'])";
const GPT_PROFILE_SIMPLE_PANEL_SELECTOR = "[data-testid='composer-model-picker-slider-simple-view'][data-active='true']:not([inert])";
const GPT_MODEL_SELECTION_V2_ENTRY_SELECTOR = `${GPT_PROFILE_POPUP_SELECTOR} [role='menuitem'][aria-label='选择模型']`;
const GPT_MODEL_SELECTION_V2_PANEL_SELECTOR = "[data-testid='composer-model-picker-slider-advanced-view'][data-active='true']:not([inert])";
const GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR = `${GPT_MODEL_SELECTION_V2_PANEL_SELECTOR} [role='menuitemradio']`;
const GPT_PROFILE_REASONING_CONTROL_SELECTOR = `${GPT_PROFILE_SIMPLE_PANEL_SELECTOR} [role='menuitem'][aria-label='能力']`;
const GPT_PROFILE_REASONING_VALUE_SELECTOR = `${GPT_PROFILE_REASONING_CONTROL_SELECTOR} [data-model-reasoning-effort-slider] [role='slider']`;
const GPT_PROFILE_DISMISS_SELECTOR = "#prompt-textarea";
const GPT_ATTACHMENT_CONTROL_SELECTOR =
  "button#composer-plus-btn[data-testid='composer-plus-btn'][aria-haspopup='menu']";
const GPT_UPLOAD_FROM_COMPUTER_SELECTOR = "div.__menu-item[tabindex='0'] span";
const GPT_UPLOAD_FROM_COMPUTER_LABEL = "从电脑上传";
const GPT_ATTACHMENT_REGION_SELECTOR = "form:has(#prompt-textarea) [class*='grid-area:header']";
const GPT_COMPOSER_SELECTOR = "#prompt-textarea";
const GPT_SEND_SELECTOR = "#composer-submit-button[data-testid='send-button']";
const GPT_USER_TURN_SELECTOR = "[data-testid^='conversation-turn-'][data-turn='user']";
const context = (browser: BrowserTargetLease, dataDir = "/tmp/gpt-acceptance") => ({ dataDir, browser });
const execute = (
  id: GptChildCapabilityId,
  browser: BrowserTargetLease,
  input: Readonly<Record<string, unknown>>,
  dataDir?: string,
) => createGptAbilityGroup().execute({
  childCapabilityId: id,
  executionId: `acceptance:${id}`,
  flowVersion: GPT_TURN_FLOW_VERSION,
  stepIndex: Math.max(0, EXPECTED_GPT_CHILD_IDS.indexOf(id)),
  inputHash: INPUT_HASH,
  pluginStepId: "acceptance-step",
  actionOrdinal: Math.max(1, EXPECTED_GPT_CHILD_IDS.indexOf(id) + 1),
  input,
  }, context(browser, dataDir));

type ProfileFixtureState = {
  popupOpen: boolean;
  modelPanelOpen: boolean;
  modelSelected: boolean;
  reasoningValue: number;
};

const profileFindResult = (
  intent: Extract<BrowserDomIntent, { kind: "find" }>,
  state: ProfileFixtureState,
): unknown => {
  switch (intent.selector) {
    case GPT_PROFILE_POPUP_SELECTOR: return { count: state.popupOpen ? 1 : 0 };
    case GPT_PROFILE_TRIGGER_SELECTOR: return { count: 1 };
    case GPT_PROFILE_SIMPLE_PANEL_SELECTOR: return { count: state.popupOpen && !state.modelPanelOpen ? 1 : 0 };
    case GPT_PROFILE_REASONING_CONTROL_SELECTOR:
    case GPT_PROFILE_REASONING_VALUE_SELECTOR:
    case GPT_MODEL_SELECTION_V2_ENTRY_SELECTOR:
      return { count: state.popupOpen && !state.modelPanelOpen ? 1 : 0 };
    case GPT_MODEL_SELECTION_V2_PANEL_SELECTOR:
      return { count: state.popupOpen && state.modelPanelOpen ? 1 : 0 };
    case GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR:
      return state.popupOpen && state.modelPanelOpen
        ? { count: 1, matches: [{ ariaChecked: state.modelSelected ? "true" : "false" }] }
        : { count: 0, matches: [] };
    default: throw new Error(`UNEXPECTED_PROFILE_FIND:${intent.selector ?? "semantic"}`);
  }
};

const respondToProfileIntent = (intent: BrowserDomIntent, state: ProfileFixtureState): unknown => {
  if (intent.kind === "find") return profileFindResult(intent, state);
  if (intent.kind === "click" && intent.selector === GPT_PROFILE_TRIGGER_SELECTOR) state.popupOpen = true;
  else if (intent.kind === "click" && intent.selector === GPT_MODEL_SELECTION_V2_ENTRY_SELECTOR) {
    state.modelPanelOpen = true;
  } else if (intent.kind === "click" && intent.selector === GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR) {
    assert.equal(intent.expectedTextEquals, "GPT-5.6 Sol");
    state.modelSelected = true;
    state.modelPanelOpen = false;
  } else if (intent.kind === "readAttribute" && intent.selector === GPT_PROFILE_REASONING_VALUE_SELECTOR) {
    return String(state.reasoningValue);
  } else if (intent.kind === "keypress" && intent.selector === GPT_PROFILE_REASONING_CONTROL_SELECTOR) {
    assert.equal(intent.key, "ArrowRight");
    state.reasoningValue += intent.repeat ?? 1;
  } else if (intent.kind === "click" && intent.selector === GPT_PROFILE_DISMISS_SELECTOR) state.popupOpen = false;
  else throw new Error(`UNEXPECTED_PROFILE_INTENT:${intent.kind}`);
  return { postconditionVerified: true };
};

type TurnFixtureState = { composerText: string; userTurnVisible: boolean };

const turnFindResult = (
  intent: Extract<BrowserDomIntent, { kind: "find" }>,
  state: TurnFixtureState,
): unknown => {
  switch (intent.selector) {
    case GPT_COMPOSER_SELECTOR:
    case GPT_SEND_SELECTOR: return { count: 1 };
    case GPT_USER_TURN_SELECTOR: return { count: state.userTurnVisible ? 1 : 0 };
    case GPT_ATTACHMENT_REGION_SELECTOR: return { count: 0 };
    default: throw new Error(`UNEXPECTED_TURN_FIND:${intent.selector ?? "semantic"}`);
  }
};

const respondToTurnIntent = (intent: BrowserDomIntent, state: TurnFixtureState): unknown => {
  if (intent.kind === "find") return turnFindResult(intent, state);
  if (intent.kind === "readText" && intent.selector === GPT_COMPOSER_SELECTOR) return state.composerText;
  if (intent.kind === "fill") {
    state.composerText = intent.approvedText;
    return { retainedValueVerified: true };
  }
  if (intent.kind === "inspect" && intent.selector === GPT_SEND_SELECTOR) {
    return { tagName: "BUTTON", visible: true, disabled: false };
  }
  if (intent.kind === "click" && intent.selector === GPT_SEND_SELECTOR) {
    state.userTurnVisible = true;
    state.composerText = "";
    return { postconditionVerified: true };
  }
  if (intent.kind === "readAttribute" && intent.selector === GPT_USER_TURN_SELECTOR) return "conversation-turn-1";
  if (intent.kind === "document") return { url: "https://chatgpt.com/c/acceptance-turn", title: "ChatGPT" };
  throw new Error(`UNEXPECTED_TURN_INTENT:${intent.kind}`);
};

assert.equal(createGptAbilityGroup().abilityGroupId, "gpt");
assert.equal(createGptAbilityGroup().transport, "gpt-web");
assert.equal(GPT_MODEL_SELECTION_VERSION, "gpt-model-selection.v2");
assert.deepEqual(createGptAbilityGroup().listChildCapabilityIds(), EXPECTED_GPT_CHILD_IDS);
assert.equal(EXPECTED_GPT_CHILD_IDS.length, 23);
for (const retired of [
  "ensure_exact_gpt_model", "recover_gpt_response_checkpoint", "open_gpt_title_control", "open_gpt_conversation_search",
]) {
  assert.equal(EXPECTED_GPT_CHILD_IDS.includes(retired as never), false);
}
const resumedCalls: Array<{ id: string; reconcileOnly: boolean }> = [];
const resumedExecutorBrowser = fakeBrowser(() => { throw new Error("UNEXPECTED_RESUME_BROWSER_INTENT"); });
await new GptTurnExecutor().execute({
  executionId: "acceptance:resume",
  inputHash: INPUT_HASH,
  pluginStepId: "resume-step",
  mode: "fresh",
  hasAttachments: false,
  outputKind: "text",
  resume: {
    stepIndex: 13,
    childCapabilityId: "submit_exact_gpt_turn_once",
    status: "failed",
    mutationState: "dispatched",
  },
  context: { dataDir: "/tmp/gpt-resume", browser: resumedExecutorBrowser.browser },
  inputFor: (step, reconcileOnly) => {
    resumedCalls.push({ id: step.childCapabilityId, reconcileOnly });
    return reconcileOnly ? { reconcileOnly: true } : {};
  },
  dispatch: async (intent) => ({
    status: "success",
    value: {},
    failureCode: null,
    proof: {
      schemaVersion: "gpt-child-capability-proof.v2",
      childCapabilityId: intent.childCapabilityId,
      executionId: intent.executionId,
      flowVersion: intent.flowVersion,
      stepIndex: intent.stepIndex,
      inputHash: intent.inputHash,
      pluginStepId: intent.pluginStepId,
      actionOrdinal: intent.actionOrdinal,
      targetRefHash: null,
      beforeDocumentRefHash: null,
      afterDocumentRefHash: null,
      candidateCount: 1,
      observedSemantics: ["acceptance"],
      committedMutation: "no",
      postconditionResult: "passed",
      startedAt: "2026-08-28T00:00:00.000Z",
      endedAt: "2026-08-28T00:00:00.001Z",
      evidenceRef: `evidence:${intent.stepIndex}`,
      evidenceHash: INPUT_HASH,
    },
  }),
  checkpoint: () => {},
});
assert.deepEqual(resumedCalls.map((call) => call.id), [
  "submit_exact_gpt_turn_once",
  "reconcile_gpt_turn_submission",
  "wait_for_stable_gpt_text",
  "checkpoint_gpt_text_response",
]);
assert.equal(resumedCalls[0]?.reconcileOnly, true,
  "a dispatched failed mutation must resume with read-only reconciliation, never redispatch");
assert.deepEqual(resumedExecutorBrowser.waitDurations(), [5_000, 5_000, 5_000, 5_000],
  "a claimed execution must wait before its first child and after each successful checkpoint except the final child");
const walAheadDispatches: string[] = [];
const walAheadInputs: Array<{ id: string; reconcileOnly: boolean }> = [];
const walAheadBrowser = fakeBrowser(() => { throw new Error("UNEXPECTED_WAL_AHEAD_BROWSER_INTENT"); });
const recoveredSubmit = {
  status: "success" as const,
  value: {},
  failureCode: null,
  proof: {
    schemaVersion: "gpt-child-capability-proof.v2" as const,
    childCapabilityId: "submit_exact_gpt_turn_once" as const,
    executionId: "acceptance:wal-ahead:12:submit_exact_gpt_turn_once",
    flowVersion: GPT_TURN_FLOW_VERSION,
    stepIndex: 13,
    inputHash: INPUT_HASH,
    pluginStepId: "wal-ahead-step",
    actionOrdinal: 14,
    targetRefHash: null,
    beforeDocumentRefHash: null,
    afterDocumentRefHash: null,
    candidateCount: 1,
    observedSemantics: ["browser-wal-dispatched"],
    committedMutation: "confirmed" as const,
    postconditionResult: "passed" as const,
    startedAt: "2026-08-28T00:00:00.000Z",
    endedAt: "2026-08-28T00:00:00.001Z",
    evidenceRef: "browser-mutation:submit",
    evidenceHash: INPUT_HASH,
  },
};
await new GptTurnExecutor().execute({
  executionId: "acceptance:wal-ahead",
  inputHash: INPUT_HASH,
  pluginStepId: "wal-ahead-step",
  mode: "fresh",
  hasAttachments: false,
  outputKind: "text",
  resume: { stepIndex: 13, childCapabilityId: "submit_exact_gpt_turn_once", status: "failed", mutationState: "no" },
  context: { dataDir: "/tmp/gpt-wal-ahead", browser: walAheadBrowser.browser },
  recoverMutation: async (step) => step.childCapabilityId === "submit_exact_gpt_turn_once"
    ? { state: "dispatched", result: recoveredSubmit } : null,
  inputFor: (step, reconcileOnly) => {
    walAheadInputs.push({ id: step.childCapabilityId, reconcileOnly });
    return reconcileOnly ? { reconcileOnly: true } : {};
  },
  dispatch: async (intent) => {
    walAheadDispatches.push(intent.childCapabilityId);
    return { ...recoveredSubmit, proof: { ...recoveredSubmit.proof,
      childCapabilityId: intent.childCapabilityId, executionId: intent.executionId,
      stepIndex: intent.stepIndex, actionOrdinal: intent.actionOrdinal } };
  },
  checkpoint: () => {},
});
assert.equal(walAheadDispatches.includes("submit_exact_gpt_turn_once"), false,
  "a WAL DISPATCHED provider effect must skip physical replay even when the shared checkpoint still says no");
assert.deepEqual(walAheadInputs[0], { id: "reconcile_gpt_turn_submission", reconcileOnly: true });
assert.deepEqual(walAheadBrowser.waitDurations(), [5_000, 5_000, 5_000],
  "WAL recovery must wait before its first resumed child while later successful checkpoints remain paced");
const failedPacingBrowser = fakeBrowser(() => { throw new Error("UNEXPECTED_FAILED_PACING_BROWSER_INTENT"); });
const failedPacing = await new GptTurnExecutor().execute({
  executionId: "acceptance:failed-pacing",
  inputHash: INPUT_HASH,
  pluginStepId: "failed-pacing-step",
  mode: "fresh",
  hasAttachments: false,
  outputKind: "text",
  resume: { stepIndex: 13, childCapabilityId: "submit_exact_gpt_turn_once", status: "failed", mutationState: "no" },
  context: { dataDir: "/tmp/gpt-failed-pacing", browser: failedPacingBrowser.browser },
  inputFor: () => ({}),
  dispatch: async (intent) => ({
    ...recoveredSubmit,
    status: "failed",
    failureCode: "ACCEPTANCE_FAILED_STEP",
    proof: { ...recoveredSubmit.proof, childCapabilityId: intent.childCapabilityId,
      executionId: intent.executionId, stepIndex: intent.stepIndex, actionOrdinal: intent.actionOrdinal,
      committedMutation: "no", postconditionResult: "failed" },
  }),
  checkpoint: () => {},
});
assert.equal(failedPacing.completed, false);
assert.deepEqual(failedPacingBrowser.waitDurations(), [5_000],
  "the first child must be delayed after Target binding even when that child later fails");
assert.equal(GPT_PROFILE_TRIGGER_SELECTOR, "main button[aria-haspopup='menu'][data-tone='neutral']:not([aria-label])");
assert.match(GPT_PROFILE_SIMPLE_PANEL_SELECTOR, /data-active='true'.*:not\(\[inert\]\)/u);
assert.equal(GPT_MODEL_SELECTION_V2_ENTRY_SELECTOR.startsWith(GPT_PROFILE_POPUP_SELECTOR), true,
  "the model entry belongs to the active profile menu, not the sibling reasoning panel");
assert.equal(GPT_MODEL_SELECTION_V2_ENTRY_SELECTOR.startsWith(`${GPT_PROFILE_SIMPLE_PANEL_SELECTOR} `), false,
  "the real model entry is not a descendant of composer-model-picker-slider-simple-view");
assert.match(GPT_MODEL_SELECTION_V2_ENTRY_SELECTOR, /aria-label='选择模型'/u);
assert.match(GPT_MODEL_SELECTION_V2_PANEL_SELECTOR, /advanced-view.*data-active='true'.*:not\(\[inert\]\)/u);
assert.equal(GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR.startsWith(GPT_MODEL_SELECTION_V2_PANEL_SELECTOR), true);
assert.equal(GPT_PROFILE_REASONING_CONTROL_SELECTOR.endsWith("[role='menuitem'][aria-label='能力']"), true);
assert.equal(GPT_PROFILE_DISMISS_SELECTOR, GPT_COMPOSER_SELECTOR,
  "closing the profile must target the exact composer surface, never the geometric center of main");
assert.equal(GPT_ATTACHMENT_CONTROL_SELECTOR.includes("aria-label"), false,
  "the Chrome-proven attachment identity must not depend on localized copy");
assert.equal(GPT_UPLOAD_FROM_COMPUTER_SELECTOR, "div.__menu-item[tabindex='0'] span",
  "the Chrome-proven exact label is the unique leaf under the interaction node, not the parent text");

const cleanFixture = fakeBrowser((intent) => {
  if (intent.kind !== "find") throw new Error(`UNEXPECTED_CLEAN_INTENT:${intent.kind}`);
  if (intent.selector === GPT_COMPOSER_SELECTOR) return { count: 1 };
  return { count: 0 };
});
const clean = await execute("prepare_clean_gpt_chat", cleanFixture.browser, { timeoutMs: 5_000 });
assert.equal(clean.status, "success");
assert.equal(clean.proof.flowVersion, GPT_TURN_FLOW_VERSION);
assert.equal(clean.proof.inputHash, INPUT_HASH);

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
const profileState: ProfileFixtureState = {
  popupOpen: false, modelPanelOpen: false, modelSelected: false, reasoningValue: 2,
};
const profileFixture = fakeBrowser((intent) => respondToProfileIntent(intent, profileState));
assert.equal((await execute("open_gpt_execution_profile", profileFixture.browser, { profile })).status, "success");
assert.equal((await execute("open_gpt_model_selector_v2", profileFixture.browser, { profile })).status, "success");
assert.equal(profileState.modelPanelOpen, true, "model selection v2 must enter the active non-inert model panel");
assert.equal((await execute("select_exact_gpt_model_v2", profileFixture.browser, { profile })).status, "success");
assert.equal(profileState.modelSelected, true, "model selection v2 must click the exact visible model candidate");
assert.equal(profileState.modelPanelOpen, false, "exact selection must restore the active execution profile");
assert.equal((await execute("ensure_exact_gpt_reasoning_tier", profileFixture.browser, { profile })).status, "success");
assert.equal(profileState.reasoningValue, 4);
assert.equal((await execute("close_gpt_execution_profile", profileFixture.browser, { profile })).status, "success");
assert.equal(profileState.popupOpen, false);
assert.equal(profileFixture.physicalMutations(), 5);

let profileObservationInFlight = 0;
let profileObservationMaxInFlight = 0;
const serialProfileState: ProfileFixtureState = {
  popupOpen: false, modelPanelOpen: false, modelSelected: true, reasoningValue: 4,
};
const serialProfileFixture = fakeBrowser(async (intent) => {
  profileObservationInFlight += 1;
  profileObservationMaxInFlight = Math.max(profileObservationMaxInFlight, profileObservationInFlight);
  await new Promise<void>((resolve) => setImmediate(resolve));
  try { return respondToProfileIntent(intent, serialProfileState); }
  finally { profileObservationInFlight -= 1; }
});
assert.equal((await execute("open_gpt_execution_profile", serialProfileFixture.browser, { profile })).status, "success");
assert.equal(profileObservationMaxInFlight, 1,
  "one GPT child must serialize browser observations through the atomic browser command lane");

const profileRecoveryFixture = fakeBrowser((intent) => {
  if (intent.kind === "find" && intent.selector === GPT_PROFILE_POPUP_SELECTOR) return { count: 0 };
  throw new Error(`UNEXPECTED_PROFILE_RECOVERY_INTENT:${intent.kind}`);
});
const profileRecovery = await execute("open_gpt_execution_profile", profileRecoveryFixture.browser, {
  profile,
  reconcileOnly: true,
});
assert.equal(profileRecovery.status, "failed");
assert.equal(profileRecoveryFixture.physicalMutations(), 0);

const rejectedTurnBrowser = fakeBrowser(() => { throw new Error("UNUSED"); });
await closeSettledGptBrowser(
  rejectedTurnBrowser.browser,
  executionFailure("failed", "BROWSER_POSTCONDITION_FAILED", { mutationOutcome: "confirmed" }),
);
assert.equal(rejectedTurnBrowser.physicalMutations(), 1,
  "a terminal REJECTED postcondition must close its Target and release the browser lane");

const dispatchedTurnBrowser = fakeBrowser(() => { throw new Error("UNUSED"); }, { initialPending: 1 });
await closeSettledGptBrowser(
  dispatchedTurnBrowser.browser,
  executionFailure("failed", "BROWSER_COMMAND_RECEIPT_MISSING", { mutationOutcome: "dispatched" }),
);
assert.equal(dispatchedTurnBrowser.physicalMutations(), 1,
  "an unresolved DISPATCHED mutation must park its exact Target and release lane capacity");

let attachmentMenuOpen = false;
const attachmentOpenFixture = fakeBrowser((intent) => {
  if (intent.kind === "find") {
    if (intent.selector === GPT_UPLOAD_FROM_COMPUTER_SELECTOR) return { count: attachmentMenuOpen ? 1 : 0 };
    if (intent.selector === GPT_ATTACHMENT_CONTROL_SELECTOR) {
      assert.deepEqual(intent.waitFor, { minimumMatches: 1, timeoutMs: 5_000 });
      return { count: 1 };
    }
  }
  if (intent.kind === "click" && intent.selector === GPT_ATTACHMENT_CONTROL_SELECTOR) {
    assert.equal(intent.postClickMatch?.selector, GPT_UPLOAD_FROM_COMPUTER_SELECTOR);
    assert.equal(intent.postClickMatch?.textEquals, GPT_UPLOAD_FROM_COMPUTER_LABEL);
    attachmentMenuOpen = true;
    return { postconditionVerified: true };
  }
  throw new Error(`UNEXPECTED_ATTACHMENT_OPEN_INTENT:${intent.kind}`);
});
const attachmentOpened = await execute("open_gpt_attachment_control", attachmentOpenFixture.browser, {});
assert.equal(attachmentOpened.status, "success");
assert.equal(attachmentMenuOpen, true);
assert.equal(attachmentOpenFixture.physicalMutations(), 1);

for (const candidateCount of [0, 2]) {
  const rejectedAttachmentFixture = fakeBrowser((intent) => {
    if (intent.kind === "find" && intent.selector === GPT_UPLOAD_FROM_COMPUTER_SELECTOR) return { count: 0 };
    if (intent.kind === "find" && intent.selector === GPT_ATTACHMENT_CONTROL_SELECTOR) {
      assert.deepEqual(intent.waitFor, { minimumMatches: 1, timeoutMs: 5_000 });
      return { count: candidateCount };
    }
    throw new Error(`UNEXPECTED_REJECTED_ATTACHMENT_INTENT:${intent.kind}`);
  });
  const rejectedAttachment = await execute("open_gpt_attachment_control", rejectedAttachmentFixture.browser, {});
  assert.equal(rejectedAttachment.status, "failed");
  assert.equal(rejectedAttachment.failureCode, `GPT_PAGE_CANDIDATE_COUNT_${candidateCount}`);
  assert.equal(rejectedAttachmentFixture.physicalMutations(), 0,
    "zero or multiple attachment controls must never dispatch a click");
}

const attachmentFiles = [
  { artifactRef: "artifact:1", filePath: "/not-read/1", displayName: "甲.pdf", sha256: `sha256:${"1".repeat(64)}`, bytes: 10 },
  { artifactRef: "artifact:2", filePath: "/not-read/2", displayName: "乙.txt", sha256: `sha256:${"2".repeat(64)}`, bytes: 20 },
];
const attachmentFixture = fakeBrowser((intent) => {
  if (intent.kind === "find" && intent.selector === GPT_ATTACHMENT_REGION_SELECTOR) return { count: 1 };
  if (intent.kind === "readText") return "甲.pdf 乙.txt";
  throw new Error(`UNEXPECTED_ATTACHMENT_INTENT:${intent.kind}`);
});
assert.equal((await execute("reconcile_gpt_attachment_set", attachmentFixture.browser, {
  files: attachmentFiles,
})).status, "success");

const marker = "[GPT-TURN:acceptance]";
const prompt = `${marker}\n${"甲".repeat(90_000)}`;
const turnState: TurnFixtureState = { composerText: "", userTurnVisible: false };
const turnFixture = fakeBrowser((intent) => respondToTurnIntent(intent, turnState));
const written = await execute("write_exact_gpt_prompt", turnFixture.browser, { prompt });
assert.equal(written.status, "success");
assert.equal((written.value as { length: number }).length, prompt.length);
assert.equal((await execute("reconcile_gpt_draft", turnFixture.browser, {
  files: [], prompt, turnMarker: marker,
})).status, "success");
const promptHash = `sha256:${createHash("sha256").update(prompt).digest("hex")}`;
assert.equal((await execute("submit_exact_gpt_turn_once", turnFixture.browser, {
  promptHash, turnMarker: marker,
})).status, "success");
assert.equal((await execute("reconcile_gpt_turn_submission", turnFixture.browser, {
  timeoutMs: 5_000, turnMarker: marker,
})).status, "success");
const duplicateSafe = await execute("submit_exact_gpt_turn_once", turnFixture.browser, {
  promptHash, turnMarker: marker,
});
assert.equal(duplicateSafe.status, "success");
assert.equal(duplicateSafe.proof.committedMutation, "no");

const checkpointFixture = fakeBrowser((intent) => {
  if (intent.kind === "inspect") return { visible: true, connected: true, text: "已完成回答" };
  throw new Error(`UNEXPECTED_CHECKPOINT_INTENT:${intent.kind}`);
});
const responseHash = `sha256:${createHash("sha256").update("已完成回答").digest("hex")}`;
assert.equal((await execute("checkpoint_gpt_text_response", checkpointFixture.browser, {
  assistantTurnId: "conversation-turn-2",
  expectedResponseHash: responseHash,
})).status, "success");

const imageDirectory = await mkdtemp(join(tmpdir(), "gpt-image-acceptance-"));
try {
  const originalImage = await sharp({
    create: { width: 256, height: 256, channels: 4, background: { r: 20, g: 80, b: 160, alpha: 1 } },
  }).png().toBuffer();
  const originalHash = `sha256:${createHash("sha256").update(originalImage).digest("hex")}` as const;
  const imageFixture = fakeBrowser(() => { throw new Error("IMAGE_CHECKPOINT_MUST_USE_AUTHENTICATED_MEDIA"); }, {
    authenticatedMedia: {
      bytesBase64: originalImage.toString("base64"),
      sha256: originalHash,
      sizeBytes: originalImage.byteLength,
      mediaType: "image/png",
      width: 256,
      height: 256,
    },
  });
  const imageResult = await execute("checkpoint_gpt_generated_image", imageFixture.browser, {
    assistantTurnId: "conversation-turn-2",
  }, imageDirectory);
  assert.equal(imageResult.status, "success", imageResult.failureCode ?? "image checkpoint failed");
  const artifact = imageResult.value as Readonly<{
    localPath: string; originalLocalPath: string; sha256: string; originalSha256: string; bytes: number;
    mediaType: string; width: number; height: number;
  }>;
  const [bytes, originalReadback] = await Promise.all([
    readFile(artifact.localPath), readFile(artifact.originalLocalPath),
  ]);
  assert.deepEqual(originalReadback, originalImage);
  assert.equal(artifact.originalSha256, originalHash);
  assert.equal(artifact.sha256, `sha256:${createHash("sha256").update(bytes).digest("hex")}`);
  assert.deepEqual([artifact.mediaType, artifact.width, artifact.height], ["image/webp", 1200, 630]);
} finally {
  await rm(imageDirectory, { recursive: true, force: true });
}

const pluginIds = [
  "bazi-chart-interpretation", "hehun-report-followup", "localization-production",
  "public-knowledge-article-pipeline", "naming-bazi-analysis-and-naming",
  "naming-from-existing-bazi-report", "payment-screenshot-observation",
  "bazi-report-followup", "qimen-report-followup", "qimen-professional-answer",
  "hehun-ai-analysis", "bazi-ai-full-analysis",
];
for (const pluginId of pluginIds) {
  await assert.rejects(
    access(new URL(`../../src/plugins/${pluginId}/gpt-flow.ts`, import.meta.url)),
    /ENOENT/u,
  );
  const source = await readFile(new URL(`../../src/plugins/${pluginId}/index.ts`, import.meta.url), "utf8");
  assert.doesNotMatch(source, /gpt_flow|gpt-flow/u, `${pluginId} must not own provider-page step order`);
  assert.match(source, /checkpointSchemaVersion: 2/u);
}

process.stdout.write("[ACCEPTANCE][gpt] PASS\n");
const clauses = ["summary", ...Array.from({ length: 15 }, (_, index) => `forbidden:${index}`)]
  .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
for (const evidenceMode of ["exam.golden", "exam.property", "exam.state-machine"] as const) {
  emitQualityProofObservation({
    passed: true,
    findings: [],
    lawId: "LAW-GPT-001-V5",
    evidenceMode,
    clauses,
    locator: `acceptance:gpt:${evidenceMode}`,
    observedValue: "23 exact public children, one shared flow, independent active non-inert model selection v2, dynamic reasoning entry, visible attachment entry, idempotent submit reconciliation, authenticated image bytes, and no Product Plugin page arrays passed",
  });
}
