import assert from "node:assert/strict";

import { resolveWebChatAttachmentTransportKind } from "../children/attach-approved-web-chat-files-once.js";
import { AiFeedInputSchema } from "../schema.js";
import { assertNativePickerContracts } from "./attachment-native-picker-contract.acceptance-helper.js";

assert.equal(resolveWebChatAttachmentTransportKind({ providerKind: "gpt-web-chat", fileCount: 0 }), "skipped");
assert.equal(resolveWebChatAttachmentTransportKind({ providerKind: "gpt-web-chat", fileCount: 1 }), "ordered_clipboard");
assert.equal(resolveWebChatAttachmentTransportKind({ providerKind: "gpt-web-chat", fileCount: 2 }), "native_picker_batch");
assert.equal(resolveWebChatAttachmentTransportKind({ providerKind: "gemini-web-chat", fileCount: 17 }), "ordered_clipboard");
await assertNativePickerContracts();

const request = {
  providerKind: "gpt-web-chat",
  taskIdentity: {
    labelKey: "system_acceptance",
    sourceProject: "grasseye",
    taskKind: "attachment-routing",
    sourceTaskId: "attachment-routing-acceptance",
  },
  promptPackageId: "attachment-routing-acceptance",
  promptContractId: "attachment-routing-acceptance",
  textPrompt: "Attachment routing acceptance.",
  requestedBy: "acceptance-test",
};
assert.throws(
  () => AiFeedInputSchema.parse({ ...request, transportKind: "native_picker_batch" }),
  /unrecognized/iu,
  "callers must not choose the attachment transport",
);

process.stdout.write("[ACCEPTANCE] AI Input Gateway attachment routing PASS\n");
