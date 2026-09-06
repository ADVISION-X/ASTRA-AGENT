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

const sameStableDraft = (left: DraftState, right: DraftState): boolean =>
  left.composerRaw === right.composerRaw
  && left.composerEligible === right.composerEligible
  && left.composerHash === right.composerHash
  && left.sendRaw === right.sendRaw
  && left.sendEligible === right.sendEligible
  && left.sendTag === right.sendTag
  && left.sendDisabled === right.sendDisabled
  && left.sendAriaDisabled === right.sendAriaDisabled
  && left.attachmentRaw === right.attachmentRaw
  && left.attachmentEligible === right.attachmentEligible
  && left.attachmentLabels.length === right.attachmentLabels.length
  && left.attachmentLabels.every((label, index) => label === right.attachmentLabels[index])
  && left.facts.authorityRefHashes.length === right.facts.authorityRefHashes.length
  && left.facts.authorityRefHashes.every((value, index) => value === right.facts.authorityRefHashes[index]);

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
    const browser = requireBrowser(context);
    const observed = await readDraftState(browser);
    requireExactComposer(observed);
    if (!ready(observed)) throw executionFailure("failed", "GPT_DRAFT_OR_SEND_READBACK_MISMATCH");
    const confirmed = await readDraftState(browser);
    requireExactComposer(confirmed);
    if (!ready(confirmed) || !sameStableDraft(observed, confirmed)) {
      throw executionFailure("failed", "GPT_DRAFT_READBACK_UNSTABLE");
    }
    return success({
      value: { ...promptIdentity(prompt), attachmentDisplayNames: expectedLabels },
      ...declaredFacts({ ...confirmed.facts,
        factResultIds: Object.freeze([...observed.facts.factResultIds, ...confirmed.facts.factResultIds]),
        decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null }),
    });
  };
