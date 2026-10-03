import { gptExecutionFailure } from "../../execution-fault.js";
import { declaredFacts, projectBrowserFact, requireBrowser, requireExactInputKeys, success,
  type GptChildHandler } from "../../web/child-handler.js";
import { ATTACHMENT_CONTROL_OPEN_POSTCONDITION, attachmentControlOpenable, attachmentControlReady,
  decodeAttachmentControlState, failAttachmentControl, readConfirmedAttachmentControlState } from "./observation.js";
import { GPT_ATTACHMENT_CONTROL_SELECTOR, GPT_COMPOSER_FORM_SELECTOR } from "./selectors.js";

export const openGptAttachmentControlHandler: GptChildHandler<"open_gpt_attachment_control"> = async (intent, context) => {
  requireExactInputKeys(intent, []);
  const browser = requireBrowser(context), observed = await readConfirmedAttachmentControlState(browser, context.signal);
  if (attachmentControlReady(observed)) return success({ value: { state: "upload-choice-ready" },
    ...declaredFacts({ ...observed.facts, decision: "DONE", mutationOutcome: "no", browserFact: null, nativeFailureCode: null }) });
  if (!attachmentControlOpenable(observed)) failAttachmentControl("GPT_ATTACHMENT_CONTROL_QUALIFICATION_INVALID", observed);
  const mutation = await browser.executeDomIntent({ kind: "click", selector: GPT_ATTACHMENT_CONTROL_SELECTOR,
    scope: { selector: GPT_COMPOSER_FORM_SELECTOR }, expectedMatches: 1,
    postClickObservation: ATTACHMENT_CONTROL_OPEN_POSTCONDITION });
  const projected = projectBrowserFact(intent, context);
  if (!projected || projected.fact.browserOutcome !== "CONFIRMED" || projected.outcome.physicalInputCount > 1) {
    throw gptExecutionFailure("GPT_BROWSER_TERMINAL_FACT_REQUIRED");
  }
  const packet = mutation && typeof mutation === "object" ? (mutation as Readonly<Record<string, unknown>>).postconditionObservation : null;
  const readback = decodeAttachmentControlState(packet), { fact } = projected;
  if (!attachmentControlReady(readback)) failAttachmentControl("GPT_ATTACHMENT_CONTROL_POSTCONDITION_FAILED", readback, fact);
  return success({ value: { state: "upload-choice-ready" }, ...declaredFacts({ ...readback.facts,
    decision: fact.mutationOutcome === "no" ? "DONE" : "ACT", mutationOutcome: fact.mutationOutcome,
    factResultIds: [...readback.facts.factResultIds, fact.evidenceRef],
    authorityRefHashes: [...readback.facts.authorityRefHashes, fact.evidenceHash], browserFact: fact, nativeFailureCode: null }) });
};
