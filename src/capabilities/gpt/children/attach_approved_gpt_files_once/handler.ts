import {
  attachmentValue,
  filesFromIntent,
  observeExactAttachmentSet,
} from "./attachment-observation.js";
import {
  attachmentControlReady,
  failAttachmentControl,
  readAttachmentControlState,
} from "./control-observation.js";
import {
  declaredFacts,
  requireBrowser,
  requireConfirmedBrowserFact,
  requireExactInputKeys,
  success,
  type GptChildHandler,
} from "../../web/child-handler.js";
import {
  GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR,
  GPT_FILE_INPUT_SELECTOR,
  GPT_UPLOAD_FROM_COMPUTER_LABEL,
  GPT_UPLOAD_FROM_COMPUTER_SELECTOR,
} from "./selectors.js";

export const attachApprovedGptFilesOnceHandler: GptChildHandler<"attach_approved_gpt_files_once"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["files"]);
    const files = filesFromIntent(intent);
    const browser = requireBrowser(context);
    if (files.length === 0) {
      const readback = await observeExactAttachmentSet(browser, files);
      return success({
        value: { files: readback.value.files, mutationSent: false },
        ...declaredFacts({
          decision: "DONE",
          factResultIds: readback.factResultIds,
          candidateCardinality: readback.candidateCardinality,
          authorityRefHashes: readback.authorityRefHashes,
          observationRevisionHash: readback.observationRevisionHash,
          mutationOutcome: "no", browserFact: null, nativeFailureCode: null,
        }),
      });
    }
    const control = await readAttachmentControlState(browser);
    if (!attachmentControlReady(control)) {
      failAttachmentControl("GPT_UPLOAD_CHOICE_INVALID", control);
    }
    await browser.attachFile({
      selector: GPT_FILE_INPUT_SELECTOR,
      activation: {
        selector: GPT_UPLOAD_FROM_COMPUTER_SELECTOR,
        scope: { selector: GPT_ATTACHMENT_ACTIVE_MENU_SCOPE_SELECTOR },
        expectedTextEquals: GPT_UPLOAD_FROM_COMPUTER_LABEL,
      },
      approvedArtifacts: files.map((file) => ({
        artifactRef: file.artifactRef,
        providerDisplayName: file.providerDisplayName,
        expectedSha256: file.sha256,
        bytes: file.bytes,
      })),
    });
    const browserFact = requireConfirmedBrowserFact(intent, context);
    return success({
      value: { ...attachmentValue(files), mutationSent: true },
      ...declaredFacts({
        ...control.facts, decision: "ACT",
        factResultIds: Object.freeze([...control.facts.factResultIds, browserFact.evidenceRef]),
        authorityRefHashes: Object.freeze([...control.facts.authorityRefHashes, browserFact.evidenceHash]),
        mutationOutcome: "confirmed", browserFact, nativeFailureCode: null,
      }),
    });
  };
