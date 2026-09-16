import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

export const providerAttachmentName = (displayName: string, artifactRef: string): string => {
  const dot = displayName.lastIndexOf(".");
  const stem = dot > 0 ? displayName.slice(0, dot) : displayName;
  const extension = dot > 0 ? displayName.slice(dot) : "";
  const token = createHash("sha256")
    .update(`job:gpt-exact-target\u0000${artifactRef}`)
    .digest("hex")
    .slice(0, 12);
  return `${stem}-${token}${extension}`;
};

export const assertGptExactTargetSourceShape = (baseUrl: string): void => {
  for (const retired of [
    "../gpt-turn-executor.ts",
    "../../../lib/local-runtime/production/gpt-turn-state.ts",
    "../../../lib/local-runtime/production/production-gpt-executor.ts",
    "../../../lib/local-runtime/production/production-gpt-turn-flow.ts",
  ]) assert.equal(existsSync(new URL(retired, baseUrl)), false, `${retired} must be physically absent`);
  for (const active of [
    "../contract.ts",
    "../ability-group.ts",
    "../production-child-tools.ts",
    "../production-browser-lifecycle.ts",
    "../../../mediator/product-plugin-contract.ts",
  ]) {
    const source = readFileSync(new URL(active, baseUrl), "utf8");
    assert.doesNotMatch(source,
      /GptTurnExecutor|GPT_TURN_FLOW|runTurn|stepIndex|flowVersion|resumePoint|reconcileOnly/u);
  }
  const rateLimit = readFileSync(new URL(
    "../../../lib/browser/chrome-extension/gpt-rate-limit-dialog.ts", baseUrl,
  ), "utf8");
  assert.match(rateLimit, /executeClickIntent\([\s\S]*dispatchNotAfter[\s\S]*\}, false\);/u,
    "the one-second rate-limit acknowledgement must remain outside staged DOM confirmation");
  const pointerRuntime = readFileSync(new URL(
    "../../../lib/browser/chrome-extension/dom-pointer-intent-runtime.ts", baseUrl,
  ), "utf8");
  assert.match(pointerRuntime,
    /preClickExactOutgoingTurn !== undefined\)[\s\S]*return prepareExactOutgoingClick/u,
    "the frozen submit actionability protocol must bypass generic staged preparation");
};
