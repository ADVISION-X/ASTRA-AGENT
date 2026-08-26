import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

export const runAiInputGatewayAtomicInspectorAttacks = (): void => {
  const source = readFileSync(
    "src/capabilities/ai-input-gateway/providers/gpt-web-execution-profile.ts",
    "utf8",
  );
  assert.match(source, /expectedText: \{ equals: expectedValue \}/u);
  assert.equal(
    (source.match(/readCurrentProfileSummary\(input, MODEL_LABEL, modelDisplayName\)/gu) ?? []).length,
    3,
  );
  assert.equal(
    (source.match(/readCurrentProfileSummary\(input, REASONING_LABEL, reasoningUiLabel\)/gu) ?? []).length,
    2,
  );
  assert.match(source, /menu-closed=true/u);
  assert.match(source, /PROFILE_ACTION_OBSERVATION_TIMEOUT_MS/u);
  assert.match(source, /isOutcomeUnknown\(error\)/u);
  assert.match(source, /main button\[aria-haspopup='menu'\]:not\(\[aria-label\]\)/u);
  assert.match(source, /\[role='menuitem'\]\[aria-haspopup='menu'\]/u);
  assert.match(source, /readProfileMenuClosed/u);
  assert.match(source, /triggerCount > 1/u);
  assert.match(source, /triggerCount === 1 \? true : null/u);
  assert.doesNotMatch(source, /input\.request\.timeoutMs/u);
  assert.doesNotMatch(source, /readCollapsedProfileState/u);
  assert.doesNotMatch(source, /kind: "readText"/u);
  assert.doesNotMatch(source, /data-has-submenu/u);
  assert.doesNotMatch(source, /form button\[aria-haspopup/u);
  assert.doesNotMatch(source, /observeSubmenuSelection/u);
  assert.doesNotMatch(source, /clickExactChoiceAndProve/u);
  assert.doesNotMatch(source, /clickAndProve/u);
  assert.doesNotMatch(source, /postClickAttribute/u);
  assert.doesNotMatch(source, /expectedValue\.slice\(/u);
  assert.doesNotMatch(source, /retry.*click|click.*retry/iu);
};
