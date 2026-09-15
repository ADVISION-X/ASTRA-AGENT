import {
  filesFromIntent,
  waitForUploadedAttachmentSet,
} from "./observation.js";
import {
  numberInput,
  requireBrowser,
  requireExactInputKeys,
  type GptChildHandler,
} from "../../web/child-handler.js";

export const reconcileGptAttachmentSetHandler: GptChildHandler<"reconcile_gpt_attachment_set"> =
  async (intent, context) => {
    requireExactInputKeys(intent, ["files", "timeoutMs"]);
    const files = filesFromIntent(intent);
    const browser = requireBrowser(context);
    const timeoutMs = Math.max(1_500, numberInput(intent, "timeoutMs"));
    return waitForUploadedAttachmentSet(browser, files, timeoutMs, context.signal);
  };
