import { executionFailure } from "../../../../lib/execution-failure.js";

import type { GptChildCapabilityIntent } from "../../contract.js";
import { arrayInput, stringInput } from "../../web/child-handler.js";
import { canonicalGptConversationUrl } from "../../web/contracts/target-document.contract.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;

export const composerHashInput = (
  intent: GptChildCapabilityIntent<"submit_exact_gpt_turn_once">,
  key: string,
): `sha256:${string}` => {
  const value = stringInput(intent, key);
  if (!HASH.test(value)) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  }
  return value as `sha256:${string}`;
};

export const composerFilesInput = (
  intent: GptChildCapabilityIntent<"submit_exact_gpt_turn_once">,
): readonly Readonly<{ providerDisplayName: string }>[] => Object.freeze(
  arrayInput(intent, "files").map((file) => {
    if (!file || typeof file !== "object" || Array.isArray(file)) {
      throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:files`);
    }
    const value = file as Readonly<Record<string, unknown>>;
    if (Object.keys(value).sort().join("|") !== "artifactRef|bytes|displayName|providerDisplayName|sha256"
      || typeof value.artifactRef !== "string" || value.artifactRef.length === 0
      || typeof value.displayName !== "string" || value.displayName.length === 0
      || typeof value.providerDisplayName !== "string" || value.providerDisplayName.length === 0
      || typeof value.sha256 !== "string" || !HASH.test(value.sha256)
      || typeof value.bytes !== "number" || !Number.isSafeInteger(value.bytes) || value.bytes < 1) {
      throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:files`);
    }
    return Object.freeze({ providerDisplayName: value.providerDisplayName.normalize("NFC") });
  }),
);

export const canonicalConversationOrNull = (value: string): string | null => {
  try { return canonicalGptConversationUrl(value); } catch { return null; }
};
