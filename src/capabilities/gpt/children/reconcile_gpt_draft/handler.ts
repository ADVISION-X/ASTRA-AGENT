import { executionFailure } from "../../../../lib/execution-failure.js";

import {
  declaredFacts,
  requireBrowser,
  requireExactInputKeys,
  stringInput,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import {
  composerFilesInput,
  exactAttachmentSet,
  gptComposerHash,
  promptIdentity,
  readDraftState,
  requireExactComposer,
  type DraftState,
} from "./observation.js";

export const reconcileGptDraftHandler: GptChildHandler<"reconcile_gpt_draft"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["files", "prompt", "turnMarker"]);
    const files = composerFilesInput(intent);
    const prompt = stringInput(intent, "prompt");
    const marker = stringInput(intent, "turnMarker");
    if (!prompt.includes(marker)) throw executionFailure("failed", "GPT_PROMPT_MARKER_MISSING");
    const expectedLabels = files.map((file) => file.providerDisplayName);
    const ready = (state: DraftState): boolean => state.composerRaw === 1
      && state.composerEligible === 1
      && state.composerHash === gptComposerHash(prompt)
      && state.sendRaw === 1 && state.sendEligible === 1 && state.sendTag === "BUTTON"
      && state.sendDisabled === false && state.sendAriaDisabled === false
      && exactAttachmentSet(state, files);
    const observed = await readDraftState(requireBrowser(context));
    requireExactComposer(observed);
    if (!ready(observed)) throw executionFailure("failed", "GPT_DRAFT_OR_SEND_READBACK_MISMATCH");
    return success({
      value: { ...promptIdentity(prompt), attachmentDisplayNames: expectedLabels },
      ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null }),
    });
  };
