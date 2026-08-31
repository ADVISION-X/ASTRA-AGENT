import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import {
  createGptAbilityGroup,
  buildGptExecutionProfile,
  GPT_CHILD_CAPABILITY_CONTRACTS,
  type GptAbilityGroup,
  type GptChildCapabilityId,
} from "../index.js";
import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import { hashCanonical } from "../../../lib/local-runtime/production/contracts.js";
import { emitQualityProofObservation } from "../../../../scripts/audit/shared/proof-observation.js";
import {
  GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR,
  GPT_MODEL_SELECTION_V2_ENTRY_SELECTOR,
  GPT_MODEL_SELECTION_V2_EXPANDED_ENTRY_SELECTOR,
  GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR,
  GPT_MODEL_SELECTION_V2_PANEL_SELECTOR,
} from "../web/contracts/model-selection-v2.contract.js";
import {
  GPT_PROFILE_POPUP_SELECTOR,
  GPT_PROFILE_REASONING_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_VALUE_SELECTOR,
  GPT_PROFILE_SIMPLE_PANEL_SELECTOR,
  GPT_PROFILE_TRIGGER_SELECTOR,
  reasoningTierUiLabel,
  reasoningTierUiValue,
} from "../web/contracts/execution-profile.contract.js";
import {
  GPT_ATTACHMENT_ITEM_SELECTOR,
  GPT_ATTACHMENT_READY_ICON_SELECTOR,
  GPT_ATTACHMENT_REGION_SELECTOR,
  GPT_ATTACHMENT_UPLOAD_SPINNER_SELECTOR,
} from "../web/contracts/attachment.contract.js";
import { GPT_COMPOSER_SELECTOR } from "../web/contracts/composer.contract.js";
import {
  GPT_GENERATING_STOP_SELECTOR,
  GPT_USER_TURN_SELECTOR,
} from "../web/contracts/conversation.contract.js";
import { EXPECTED_GPT_CHILD_IDS, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";
import "./gpt-conversation.acceptance.js";

const gpt = createGptAbilityGroup();
type GptExecutionContext = Parameters<GptAbilityGroup["execute"]>[1];
assert.deepEqual(gpt.listChildCapabilityIds(), EXPECTED_GPT_CHILD_IDS);
assert.equal(Object.keys(GPT_CHILD_CAPABILITY_CONTRACTS).length, 23);

const providerAttachmentName = (displayName: string, artifactRef: string): string => {
  const dot = displayName.lastIndexOf(".");
  const stem = dot > 0 ? displayName.slice(0, dot) : displayName;
  const extension = dot > 0 ? displayName.slice(dot) : "";
  const token = createHash("sha256")
    .update(`attempt:gpt-exact-target\u0000${artifactRef}`)
    .digest("hex")
    .slice(0, 12);
  return `${stem}-${token}${extension}`;
};

for (const retired of [
  "../gpt-turn-executor.ts",
  "../../../lib/local-runtime/production/gpt-turn-state.ts",
  "../../../lib/local-runtime/production/production-gpt-executor.ts",
  "../../../lib/local-runtime/production/production-gpt-turn-flow.ts",
]) assert.equal(existsSync(new URL(retired, import.meta.url)), false, `${retired} must be physically absent`);

for (const active of [
  "../contract.ts",
  "../ability-group.ts",
  "../../../lib/local-runtime/production/production-gpt-child-tools.ts",
  "../../../lib/local-runtime/production/production-gpt-browser-lifecycle.ts",
  "../../../lib/local-runtime/production/plugin.ts",
]) {
  const source = readFileSync(new URL(active, import.meta.url), "utf8");
  assert.doesNotMatch(source, /GptTurnExecutor|GPT_TURN_FLOW|runTurn|stepIndex|flowVersion|resumePoint|reconcileOnly/u);
}

let ordinal = 0;
const execute = (
  childCapabilityId: GptChildCapabilityId,
  browser: BrowserTargetLease,
  input: Readonly<Record<string, unknown>>,
  mutationMode?: "normal" | "readback",
  contextOverrides?: Partial<GptExecutionContext>,
) => {
  ordinal += 1;
  return gpt.execute({
    childCapabilityId,
    executionId: `acceptance:${childCapabilityId}:${ordinal}`,
    jobId: "job:gpt-exact-target",
    attemptId: "attempt:gpt-exact-target",
    pluginId: "acceptance-product",
    pluginVersion: 1,
    productStepId: "acceptance-step",
    callId: "acceptance-call",
    inputHash: hashCanonical(input),
    actionOrdinal: ordinal,
    input,
  }, {
    dataDir: "/tmp/gpt-exact-target", browser,
    ...(mutationMode ? { mutationMode } : {}),
    ...contextOverrides,
  });
};

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

let profileOpen = false;
const profileOpenFixture = fakeBrowser((intent) => {
  if (intent.kind === "find") {
    if (intent.selector === GPT_PROFILE_TRIGGER_SELECTOR) return { count: 1 };
    if ([
      GPT_PROFILE_POPUP_SELECTOR,
      GPT_PROFILE_SIMPLE_PANEL_SELECTOR,
      GPT_PROFILE_REASONING_CONTROL_SELECTOR,
      GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
      GPT_PROFILE_REASONING_VALUE_SELECTOR,
    ].includes(String(intent.selector))) return { count: profileOpen ? 1 : 0 };
  }
  if (intent.kind === "click" && intent.selector === GPT_PROFILE_TRIGGER_SELECTOR) {
    assert.deepEqual(intent.postClickMatch, {
      selector: GPT_PROFILE_POPUP_SELECTOR,
      expectedMatches: 1,
      timeoutMs: 5_000,
    });
    assert.equal(intent.postClickAttribute, undefined);
    profileOpen = true;
    return { postconditionVerified: true };
  }
  throw new Error(`UNEXPECTED_PROFILE_OPEN_INTENT:${intent.kind}`);
});
const openedProfile = await execute("open_gpt_execution_profile", profileOpenFixture.browser, { profile });
assert.equal(openedProfile.status, "success", openedProfile.failureCode ?? "profile open failed");
assert.equal(profileOpenFixture.physicalMutations(), 1);

const incompleteOpenProfileFixture = fakeBrowser((intent) => {
  if (intent.kind === "find" && intent.selector === GPT_PROFILE_POPUP_SELECTOR) return { count: 1 };
  if (intent.kind === "find") return { count: 0 };
  throw new Error(`UNEXPECTED_INCOMPLETE_PROFILE_INTENT:${intent.kind}`);
});
const incompleteOpenProfile = await execute(
  "open_gpt_execution_profile", incompleteOpenProfileFixture.browser, { profile },
);
assert.equal(incompleteOpenProfile.status, "failed");
assert.match(incompleteOpenProfile.failureCode ?? "", /^GPT_EXECUTION_PROFILE_POPUP_INVALID:/u);
assert.equal(incompleteOpenProfileFixture.physicalMutations(), 0,
  "an existing popup without its active topology must fail without another click");

const modelCount = (selector: string, open: boolean): number => {
  if (selector === GPT_PROFILE_POPUP_SELECTOR || selector === GPT_MODEL_SELECTION_V2_ENTRY_SELECTOR) return 1;
  if (selector === GPT_MODEL_SELECTION_V2_EXPANDED_ENTRY_SELECTOR) return open ? 1 : 0;
  if (selector === GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR) return open ? 0 : 1;
  if (selector === GPT_PROFILE_SIMPLE_PANEL_SELECTOR) return open ? 0 : 1;
  if (selector === GPT_MODEL_SELECTION_V2_PANEL_SELECTOR) return open ? 1 : 0;
  return 0;
};

for (const initialOpen of [true, false]) {
  let open = initialOpen;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "find") return { count: modelCount(String(intent.selector), open) };
    if (intent.kind === "click" && intent.selector === GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR) {
      open = true;
      return { postconditionVerified: true };
    }
    throw new Error(`UNEXPECTED_MODEL_INTENT:${intent.kind}`);
  });
  const result = await execute("open_gpt_model_selector_v2", fixture.browser, { profile });
  assert.equal(result.status, "success", result.failureCode ?? "model selector failed");
  assert.equal(open, true);
  assert.equal(fixture.physicalMutations(), initialOpen ? 0 : 1,
    "ALREADY_OPEN must not click; OPENABLE must click exactly once");
}

for (const candidateCount of [0, 2]) {
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "find") {
      if (intent.selector === GPT_PROFILE_POPUP_SELECTOR) return { count: 1 };
      if (intent.selector === GPT_MODEL_SELECTION_V2_ENTRY_SELECTOR) return { count: candidateCount };
      return { count: 0 };
    }
    throw new Error(`UNEXPECTED_AMBIGUOUS_MODEL_INTENT:${intent.kind}`);
  });
  const result = await execute("open_gpt_model_selector_v2", fixture.browser, { profile });
  assert.equal(result.status, "failed");
  assert.equal(fixture.physicalMutations(), 0, "zero or multiple candidates must never click");
}

for (const alreadySelected of [true, false]) {
  let open = true;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "find") {
      if (intent.selector === GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR) {
        return { count: 1, matches: [{ ariaChecked: alreadySelected ? "true" : "false" }] };
      }
      return { count: modelCount(String(intent.selector), open) };
    }
    if (intent.kind === "click" && intent.selector === GPT_MODEL_SELECTION_V2_EXPANDED_ENTRY_SELECTOR) {
      assert.equal(alreadySelected, true);
      open = false;
      return { postconditionVerified: true };
    }
    if (intent.kind === "click" && intent.selector === GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR) {
      assert.equal(alreadySelected, false);
      assert.equal(intent.expectedTextEquals, profile.modelDisplayName);
      open = false;
      return { postconditionVerified: true };
    }
    throw new Error(`UNEXPECTED_EXACT_MODEL_INTENT:${intent.kind}`);
  });
  const result = await execute("select_exact_gpt_model_v2", fixture.browser, { profile });
  assert.equal(result.status, "success", result.failureCode ?? "exact model selection failed");
  assert.equal(open, false, "exact model selection must restore the active simple profile panel");
  assert.equal(fixture.physicalMutations(), 1,
    "selected and unselected exact-model branches must each use one bounded mutation to restore the simple panel");
}

assert.deepEqual(reasoningTierUiValue, {
  fast: 0, medium: 1, high: 2, extra_high: 3, pro_standard: 4, pro_extended: 4,
});
assert.equal(reasoningTierUiLabel.fast, "极速");
assert.equal(GPT_PROFILE_REASONING_CONTROL_SELECTOR, "[role='menuitem'][aria-label='能力']");

for (const [tier, target] of Object.entries({ fast: 0, medium: 1, high: 2, extra_high: 3, pro_standard: 4 }) as Array<[
  "fast" | "medium" | "high" | "extra_high" | "pro_standard", number,
]>) {
  let current = target;
  const tierProfile = buildGptExecutionProfile({ ...profile, profileRef: `acceptance:${tier}`, reasoningTier: tier });
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "find") return { count: 1 };
    if (intent.kind === "readAttribute") {
      if (intent.name === "aria-valuemin") return "0";
      if (intent.name === "aria-valuemax") return "4";
      if (intent.name === "aria-valuenow") return String(current);
    }
    throw new Error(`UNEXPECTED_REASONING_INTENT:${intent.kind}`);
  });
  const result = await execute("ensure_exact_gpt_reasoning_tier", fixture.browser, { profile: tierProfile });
  assert.equal(result.status, "success", result.failureCode ?? `${tier} failed`);
  assert.equal(fixture.physicalMutations(), 0);
}

let current = 0;
const moveFixture = fakeBrowser((intent) => {
  if (intent.kind === "find") return { count: 1 };
  if (intent.kind === "readAttribute") {
    if (intent.name === "aria-valuemin") return "0";
    if (intent.name === "aria-valuemax") return "4";
    if (intent.name === "aria-valuenow") return String(current);
  }
  if (intent.kind === "keypress" && intent.selector === GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR) {
    assert.equal(intent.key, "ArrowRight");
    assert.equal(intent.repeat, 4);
    current = 4;
    return { postconditionVerified: true };
  }
  throw new Error(`UNEXPECTED_REASONING_MOVE_INTENT:${intent.kind}`);
});
const moved = await execute("ensure_exact_gpt_reasoning_tier", moveFixture.browser, { profile });
assert.equal(moved.status, "success", moved.failureCode ?? "reasoning move failed");
assert.equal(current, 4);
assert.equal(moveFixture.physicalMutations(), 1);
assert.equal(GPT_PROFILE_REASONING_VALUE_SELECTOR, "[data-model-reasoning-effort-slider] [role='slider']");

for (const draft of ["", "stale SEO prompt"] as const) {
  let currentDraft: string = draft;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "find") {
      if (intent.selector === GPT_COMPOSER_SELECTOR) return { count: 1 };
      if ([GPT_USER_TURN_SELECTOR, GPT_ATTACHMENT_REGION_SELECTOR, GPT_GENERATING_STOP_SELECTOR]
        .includes(String(intent.selector))) return { count: 0 };
    }
    if (intent.kind === "readText" && intent.selector === GPT_COMPOSER_SELECTOR) return currentDraft;
    if (intent.kind === "fill" && intent.selector === GPT_COMPOSER_SELECTOR) {
      assert.equal(intent.approvedText, "");
      assert.equal(intent.clearBeforeType, true);
      currentDraft = "";
      return { postconditionVerified: true };
    }
    throw new Error(`UNEXPECTED_CLEAN_CHAT_INTENT:${intent.kind}`);
  });
  const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 1_000 });
  assert.equal(result.status, "success", result.failureCode ?? "clean chat failed");
  assert.equal(currentDraft, "");
  assert.equal(fixture.physicalMutations(), draft === "" ? 0 : 1,
    "clean-chat must preserve an empty draft or clear one stale draft exactly once");
}

for (const initialOpen of [true, false]) {
  let open = initialOpen;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "find" && intent.selector === GPT_PROFILE_POPUP_SELECTOR) return { count: open ? 1 : 0 };
    if (intent.kind === "readAttribute" && intent.selector === GPT_PROFILE_TRIGGER_SELECTOR
      && intent.name === "aria-expanded") return open ? "true" : "false";
    if (intent.kind === "click" && intent.selector === GPT_PROFILE_TRIGGER_SELECTOR) {
      open = false;
      return { postconditionVerified: true };
    }
    throw new Error(`UNEXPECTED_PROFILE_CLOSE_INTENT:${intent.kind}`);
  });
  const result = await execute("close_gpt_execution_profile", fixture.browser, { profile });
  assert.equal(result.status, "success", result.failureCode ?? "profile close failed");
  assert.equal(open, false);
  assert.equal(fixture.physicalMutations(), initialOpen ? 1 : 0,
    "profile close must toggle its exact trigger once and must not click composer");
}

const attachmentFixture = fakeBrowser((intent) => {
  if (intent.kind === "find" && intent.selector === GPT_ATTACHMENT_REGION_SELECTOR) return { count: 1 };
  if (intent.kind === "find" && intent.selector === GPT_ATTACHMENT_ITEM_SELECTOR) {
    return { count: 1, matches: [{ ariaLabel: providerAttachmentName("甲.pdf", "artifact:1") }] };
  }
  throw new Error(`UNEXPECTED_ATTACHMENT_READBACK_INTENT:${intent.kind}`);
});
const attachmentReadback = await execute("attach_approved_gpt_files_once", attachmentFixture.browser, {
  files: [{
    artifactRef: "artifact:1", filePath: "/must-not-be-read", displayName: "甲.pdf",
    sha256: `sha256:${"1".repeat(64)}`, bytes: 10,
  }],
}, "readback");
assert.equal(attachmentReadback.status, "success", attachmentReadback.failureCode ?? "attachment readback failed");
assert.equal(attachmentFixture.physicalMutations(), 0, "DISPATCHED attachment recovery must only read exact postcondition");

const approvedAttachment = Object.freeze({
  artifactRef: "artifact:1", filePath: "/must-not-be-read", displayName: "甲.pdf",
  sha256: `sha256:${"1".repeat(64)}`, bytes: 10,
});
let uploadObservations = 0;
const uploadingFixture = fakeBrowser((intent) => {
  if (intent.kind === "find" && intent.selector === GPT_ATTACHMENT_REGION_SELECTOR) return { count: 1 };
  if (intent.kind === "find" && intent.selector === GPT_ATTACHMENT_ITEM_SELECTOR) {
    return { count: 1, matches: [{ ariaLabel: providerAttachmentName("甲.pdf", "artifact:1") }] };
  }
  if (intent.kind === "find" && intent.selector === GPT_ATTACHMENT_READY_ICON_SELECTOR) {
    uploadObservations += 1;
    return { count: uploadObservations >= 3 ? 1 : 0 };
  }
  if (intent.kind === "find" && intent.selector === GPT_ATTACHMENT_UPLOAD_SPINNER_SELECTOR) {
    return { count: uploadObservations >= 3 ? 0 : 1 };
  }
  throw new Error(`UNEXPECTED_ATTACHMENT_UPLOAD_INTENT:${intent.kind}`);
});
const uploaded = await execute("reconcile_gpt_attachment_set", uploadingFixture.browser, {
  files: [approvedAttachment], timeoutMs: 2_000,
});
assert.equal(uploaded.status, "success", uploaded.failureCode ?? "uploaded attachment reconciliation failed");
assert.equal(
  (uploaded.value as { files: Array<{ providerDisplayName: string }> }).files[0]?.providerDisplayName,
  providerAttachmentName("甲.pdf", "artifact:1"),
);
assert.equal(uploadObservations, 3, "attachment name alone must not complete reconciliation");
assert.equal(uploadingFixture.waitDurations().length, 2, "pending upload must wait only between fresh observations");
assert.equal(uploadingFixture.physicalMutations(), 0, "attachment reconciliation must remain read-only");

let simulatedNow = 0;
const delayedUploadFixture = fakeBrowser((intent) => {
  if (intent.kind === "find" && intent.selector === GPT_ATTACHMENT_REGION_SELECTOR) return { count: 1 };
  if (intent.kind === "find" && intent.selector === GPT_ATTACHMENT_ITEM_SELECTOR) {
    return { count: 1, matches: [{ ariaLabel: providerAttachmentName("甲.pdf", "artifact:1") }] };
  }
  if (intent.kind === "find" && intent.selector === GPT_ATTACHMENT_READY_ICON_SELECTOR) {
    return { count: simulatedNow >= 61_000 ? 1 : 0 };
  }
  if (intent.kind === "find" && intent.selector === GPT_ATTACHMENT_UPLOAD_SPINNER_SELECTOR) {
    return { count: simulatedNow >= 61_000 ? 0 : 1 };
  }
  throw new Error(`UNEXPECTED_DELAYED_ATTACHMENT_INTENT:${intent.kind}`);
}, { onWait: (durationMs) => { simulatedNow += durationMs; } });
const nativeDateNow = Date.now;
Date.now = () => simulatedNow;
try {
  const delayedUpload = await execute("reconcile_gpt_attachment_set", delayedUploadFixture.browser, {
    files: [approvedAttachment], timeoutMs: 70_000,
  });
  assert.equal(delayedUpload.status, "success", delayedUpload.failureCode ?? "delayed attachment upload failed");
  assert.ok(simulatedNow >= 61_000, "upload completion must be observed after the retired 60s ceiling");
} finally {
  Date.now = nativeDateNow;
}

const uploadTimeoutFixture = fakeBrowser((intent) => {
  if (intent.kind === "find" && intent.selector === GPT_ATTACHMENT_REGION_SELECTOR) return { count: 1 };
  if (intent.kind === "find" && intent.selector === GPT_ATTACHMENT_ITEM_SELECTOR) {
    return { count: 1, matches: [{ ariaLabel: providerAttachmentName("甲.pdf", "artifact:1") }] };
  }
  if (intent.kind === "find" && intent.selector === GPT_ATTACHMENT_READY_ICON_SELECTOR) return { count: 0 };
  if (intent.kind === "find" && intent.selector === GPT_ATTACHMENT_UPLOAD_SPINNER_SELECTOR) return { count: 1 };
  throw new Error(`UNEXPECTED_ATTACHMENT_TIMEOUT_INTENT:${intent.kind}`);
});
const uploadTimedOut = await execute("reconcile_gpt_attachment_set", uploadTimeoutFixture.browser, {
  files: [approvedAttachment], timeoutMs: 1_000,
});
assert.equal(uploadTimedOut.status, "failed");
assert.equal(uploadTimedOut.failureCode, "GPT_ATTACHMENT_UPLOAD_TIMEOUT:ready=0:uploading=1:expected=1");
assert.equal(uploadTimeoutFixture.physicalMutations(), 0, "timed-out reconciliation must never mutate the page");

emitQualityProofObservation({
  passed: true,
  findings: [],
  lawId: "LAW-GPT-001-V13",
  evidenceMode: "exam.golden",
  clauses: ["forbidden:10", "forbidden:11", "forbidden:13", "forbidden:3", "forbidden:5", "forbidden:9", "summary"],
  locator: "acceptance:gpt-exact-target:atomic-child-golden",
  observedValue: "23 public child contracts exercised with exact target model attachment and response postconditions",
});
emitQualityProofObservation({
  passed: true,
  findings: [],
  lawId: "LAW-GPT-001-V13",
  evidenceMode: "exam.property",
  clauses: ["forbidden:10", "forbidden:13", "forbidden:14", "forbidden:5", "forbidden:7", "forbidden:8", "forbidden:9", "summary"],
  locator: "acceptance:gpt-exact-target:candidate-property-matrix",
  observedValue: "candidate cardinality visibility identity and typed blocker mutants rejected without extra mutation",
});
emitQualityProofObservation({
  passed: true,
  findings: [],
  lawId: "LAW-GPT-001-V13",
  evidenceMode: "exam.state-machine",
  clauses: ["forbidden:0", "forbidden:12", "forbidden:14", "forbidden:4", "forbidden:6", "forbidden:7", "summary"],
  locator: "acceptance:gpt-exact-target:wait-recovery-state-machine",
  observedValue: "provider wait deadline readback continuation identity and single child execution transitions exercised",
});
