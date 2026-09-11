import {
  ATTACHMENT_CONTROL_OPEN_POSTCONDITION,
  attachmentControlOpenable,
  attachmentControlReady,
  decodeAttachmentControlState,
  failAttachmentControl,
  waitForAttachmentControlHydration,
} from "./observation.js";
import {
  declaredFacts,
  requireBrowser,
  requireConfirmedBrowserFact,
  requireExactInputKeys,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import {
  GPT_ATTACHMENT_CONTROL_SELECTOR,
  GPT_COMPOSER_FORM_SELECTOR,
} from "./selectors.js";

export const openGptAttachmentControlHandler: GptChildHandler<"open_gpt_attachment_control"> =
  async (intent, context) => {
    requireExactInputKeys(intent, []);
    const browser = requireBrowser(context);
    const observed = await waitForAttachmentControlHydration(browser, context.signal);
    if (attachmentControlReady(observed)) return success({
      value: { state: "upload-choice-ready" },
      ...declaredFacts({
        ...observed.facts, decision: "DONE", mutationOutcome: "no",
        browserFact: null, nativeFailureCode: null,
      }),
    });
    if (!attachmentControlOpenable(observed)) {
      failAttachmentControl("GPT_ATTACHMENT_CONTROL_QUALIFICATION_INVALID", observed);
    }
    const mutation = await browser.executeDomIntent({
      kind: "click", selector: GPT_ATTACHMENT_CONTROL_SELECTOR, expectedMatches: 1,
      scope: { selector: GPT_COMPOSER_FORM_SELECTOR },
      postClickObservation: ATTACHMENT_CONTROL_OPEN_POSTCONDITION,
    });
    const mutationRecord = mutation && typeof mutation === "object" && !Array.isArray(mutation)
      ? mutation as Readonly<Record<string, unknown>> : {};
    const readback = decodeAttachmentControlState(mutationRecord.postconditionObservation);
    const browserFact = requireConfirmedBrowserFact(intent, browser);
    if (!attachmentControlReady(readback)) {
      failAttachmentControl("GPT_ATTACHMENT_CONTROL_OPEN_PENDING", readback, browserFact);
    }
    return success({
      value: { state: "upload-choice-ready" },
      ...declaredFacts({
        ...readback.facts, decision: "ACT",
        factResultIds: Object.freeze([...readback.facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...readback.facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: "confirmed", browserFact, nativeFailureCode: null,
      }),
    });
  };
