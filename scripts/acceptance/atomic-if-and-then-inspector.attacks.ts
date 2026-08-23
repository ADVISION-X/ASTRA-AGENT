import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

export const runAiInputGatewayAtomicInspectorAttacks = (): void => {
  const source = readFileSync(
    "src/capabilities/ai-input-gateway/providers/gpt-web-execution-profile.ts",
    "utf8",
  );
  assert.match(source, /expectedTextEquals: input\.expectedValue,/u);
  assert.match(source, /postClickAttribute: \{ name: "aria-checked", equals: "true" \},/u);
  assert.doesNotMatch(source, /expectedValue\.slice\(/u);
};
