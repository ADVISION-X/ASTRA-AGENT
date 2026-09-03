import { executionFailure } from "../../../../lib/execution-failure.js";

import type { GptChildHandlerMap } from "../child-handler.js";
import {
  arrayInput,
  numberInput,
  requireBrowser,
  requireExactInputKeys,
  stringInput,
} from "../child-handler.js";

const HASH = /^sha256:[a-f0-9]{64}$/u;
type AnyHandler = NonNullable<GptChildHandlerMap[keyof GptChildHandlerMap]>;
type AnyIntent = Parameters<AnyHandler>[0];
type AnyContext = Parameters<AnyHandler>[1];

const hashInput = (intent: AnyIntent, key: string): string => {
  const value = stringInput(intent, key);
  if (!HASH.test(value)) throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  return value;
};

const filesInput = (intent: AnyIntent): readonly unknown[] => {
  const files = arrayInput(intent, "files");
  for (const file of files) {
    if (!file || typeof file !== "object" || Array.isArray(file)) {
      throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:files`);
    }
    const value = file as Readonly<Record<string, unknown>>;
    if (Object.keys(value).sort().join("|") !== "artifactRef|bytes|displayName|providerDisplayName|sha256"
      || typeof value.artifactRef !== "string" || value.artifactRef.length === 0
      || typeof value.displayName !== "string" || value.displayName.length === 0
      || typeof value.providerDisplayName !== "string" || value.providerDisplayName.length === 0
      || typeof value.sha256 !== "string" || !HASH.test(value.sha256)
      || typeof value.bytes !== "number" || !Number.isSafeInteger(value.bytes) || value.bytes < 0) {
      throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:files`);
    }
  }
  return files;
};

const timeoutInput = (intent: AnyIntent): number => {
  const value = numberInput(intent, "timeoutMs");
  if (!Number.isSafeInteger(value) || value < 1 || value > 60_000) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:timeoutMs`);
  }
  return value;
};

const coherentPageHandoffRequired = (context: AnyContext): never => {
  requireBrowser(context);
  throw executionFailure("failed", "GPT_BROWSER_COHERENT_PAGE_HANDOFF_REQUIRED");
};

export const composerSubmissionChildHandlers = {
  async write_exact_gpt_prompt(intent, context) {
    requireExactInputKeys(intent, ["prompt"]);
    stringInput(intent, "prompt");
    return coherentPageHandoffRequired(context);
  },

  async reconcile_gpt_draft(intent, context) {
    requireExactInputKeys(intent, ["files", "prompt", "turnMarker"]);
    filesInput(intent);
    const prompt = stringInput(intent, "prompt");
    const marker = stringInput(intent, "turnMarker");
    if (!prompt.includes(marker)) throw executionFailure("failed", "GPT_PROMPT_MARKER_MISSING");
    return coherentPageHandoffRequired(context);
  },

  async submit_exact_gpt_turn_once(intent, context) {
    requireExactInputKeys(intent, ["files", "promptHash", "turnMarker"]);
    filesInput(intent);
    hashInput(intent, "promptHash");
    stringInput(intent, "turnMarker");
    return coherentPageHandoffRequired(context);
  },

  async reconcile_gpt_turn_submission(intent, context) {
    requireExactInputKeys(intent, ["expectedPromptHash", "timeoutMs", "turnMarker"]);
    hashInput(intent, "expectedPromptHash");
    timeoutInput(intent);
    stringInput(intent, "turnMarker");
    return coherentPageHandoffRequired(context);
  },
} satisfies GptChildHandlerMap;
