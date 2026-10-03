import { gptExecutionFailure } from "../../execution-fault.js";
import { declaredFacts, projectBrowserFact, requireBrowser, requireExactInputKeys, success,
  type GptChildHandler } from "../../web/child-handler.js";
import { assertNoForeignComposerAttachments, attachmentValue, filesFromIntent, observeExactAttachmentSet } from "./attachment-observation.js";
import { attachmentControlReady, failAttachmentControl, readAttachmentControlState } from "./control-observation.js";
import { GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR, GPT_FILE_INPUT_SELECTOR,
  GPT_UPLOAD_FROM_COMPUTER_KEYWORD, GPT_UPLOAD_FROM_COMPUTER_SELECTOR } from "./selectors.js";

export const attachApprovedGptFilesOnceHandler: GptChildHandler<"attach_approved_gpt_files_once"> = async (intent, context) => {
  requireExactInputKeys(intent, ["files"]);
  const files = filesFromIntent(intent), browser = requireBrowser(context);
  if (files.length === 0) {
    const readback = await observeExactAttachmentSet(browser, files);
    return success({ value: { files: readback.value.files, mutationSent: false },
      ...declaredFacts({ decision: "DONE", factResultIds: readback.factResultIds, candidateCardinality: readback.candidateCardinality,
        authorityRefHashes: readback.authorityRefHashes, observationRevisionHash: readback.observationRevisionHash,
        mutationOutcome: "no", browserFact: null, nativeFailureCode: null }) });
  }
  await assertNoForeignComposerAttachments(browser, files);
  const control = await readAttachmentControlState(browser, context.signal);
  if (!attachmentControlReady(control)) failAttachmentControl("GPT_UPLOAD_CHOICE_INVALID", control);
  await browser.attachFile({ selector: GPT_FILE_INPUT_SELECTOR,
    activation: { selector: GPT_UPLOAD_FROM_COMPUTER_SELECTOR, scope: { selector: GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR },
      expectedText: GPT_UPLOAD_FROM_COMPUTER_KEYWORD },
    approvedArtifacts: files.map(file => ({ artifactRef: file.artifactRef, providerDisplayName: file.providerDisplayName,
      expectedSha256: file.sha256, bytes: file.bytes })) });
  const projected = projectBrowserFact(intent, context);
  if (!projected || projected.fact.browserOutcome !== "CONFIRMED" || projected.outcome.physicalInputCount !== 1
    || projected.fact.mutationOutcome !== "confirmed") throw gptExecutionFailure("GPT_BROWSER_TERMINAL_FACT_REQUIRED");
  const { fact } = projected;
  return success({ value: { ...attachmentValue(files), mutationSent: true }, ...declaredFacts({ ...control.facts, decision: "ACT",
    mutationOutcome: "confirmed", browserFact: fact, nativeFailureCode: null,
    factResultIds: [...control.facts.factResultIds, fact.evidenceRef], authorityRefHashes: [...control.facts.authorityRefHashes, fact.evidenceHash] }) });
};
