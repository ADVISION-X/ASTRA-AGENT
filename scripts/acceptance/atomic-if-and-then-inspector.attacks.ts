import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

export const runAiInputGatewayAtomicInspectorAttacks = (): void => {
  const source = readFileSync(
    "src/capabilities/ai-input-gateway/providers/gpt-web-execution-profile.ts",
    "utf8",
  );
  assert.match(source, /expectedTextEquals: input\.expectedValue,/u);
  assert.match(source, /readCurrentProfileSummary\(input, MODEL_LABEL, modelDisplayName\)/u);
  assert.match(source, /readCurrentProfileSummary\(input, REASONING_LABEL, reasoningUiLabel\)/u);
  assert.match(source, /menu-closed=true/u);
  assert.match(source, /PROFILE_ACTION_OBSERVATION_TIMEOUT_MS/u);
  assert.match(source, /return readAdvancedProfileState\(browser\);/u);
  assert.doesNotMatch(source, /Date\.now\(\) \+ input\.request\.timeoutMs/u);
  assert.doesNotMatch(source, /observeSubmenuSelection/u);
  assert.doesNotMatch(source, /postClickAttribute/u);
  assert.doesNotMatch(source, /expectedValue\.slice\(/u);
};
