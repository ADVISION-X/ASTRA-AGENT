import type { GptChildHandlerMap } from "../child-handler.js";
import { executionFailure } from "../../../../lib/typed-failure.js";
import {
  booleanInput,
  requireBrowser,
  requireExactInputKeys,
  stringInput,
  success,
} from "../child-handler.js";
import { readGptDocument } from "../gpt-dom-observation.js";
import { GPT_ROOT_URL, assertGptUrl } from "../contracts/target-document.contract.js";

export const targetDocumentChildHandlers = {
  async bind_exact_gpt_target(intent, context) {
    requireExactInputKeys(intent, []);
    const browser = requireBrowser(context);
    const document = await readGptDocument(browser);
    if (browser.document.targetRef !== browser.target.targetRef) {
      throw executionFailure("review_required", "GPT_TARGET_DOCUMENT_BINDING_INVALID");
    }
    return success({
      value: { targetRef: browser.target.targetRef, documentRef: browser.document.documentRef, ...document },
      candidateCount: 1,
      observedSemantics: ["exact Browser Authority target", "exact current document", "chatgpt.com"],
      committedMutation: "no",
    });
  },

  async observe_gpt_document(intent, context) {
    requireExactInputKeys(intent, []);
    const document = await readGptDocument(requireBrowser(context));
    return success({
      value: document,
      candidateCount: 1,
      observedSemantics: ["current URL", "current document title"],
      committedMutation: "no",
    });
  },

  async verify_gpt_workspace(intent, context) {
    requireExactInputKeys(intent, ["accountCapabilityRef"]);
    const accountCapabilityRef = stringInput(intent, "accountCapabilityRef");
    const browser = requireBrowser(context);
    const document = await readGptDocument(browser);
    if (browser.authorityRef.length === 0 || browser.executionBindingHash.length === 0) {
      throw executionFailure("review_required", "GPT_WORKSPACE_AUTHORITY_INVALID");
    }
    return success({
      value: { accountCapabilityRef, authorityRef: browser.authorityRef, url: document.url },
      candidateCount: 1,
      observedSemantics: ["frozen account capability", "authenticated Browser Authority", "exact GPT origin"],
      committedMutation: "no",
    });
  },

  async restore_gpt_operator_source(intent, context) {
    requireExactInputKeys(intent, ["managedExecution", "sourceUrl"]);
    if (booleanInput(intent, "managedExecution")) {
      throw executionFailure("failed", "GPT_OPERATOR_SOURCE_MANAGED_EXECUTION_FORBIDDEN");
    }
    const sourceUrl = stringInput(intent, "sourceUrl");
    const expected = assertGptUrl(sourceUrl).href;
    const browser = requireBrowser(context);
    await browser.navigate({ url: expected, title: "restore approved GPT operator source" });
    const after = await readGptDocument(browser);
    if (new URL(after.url).href !== expected) throw executionFailure("review_required", "GPT_OPERATOR_SOURCE_RESTORE_UNCONFIRMED");
    return success({
      value: after,
      candidateCount: 1,
      observedSemantics: ["approved non-managed source", GPT_ROOT_URL],
      committedMutation: "confirmed",
    });
  },
} satisfies GptChildHandlerMap;
