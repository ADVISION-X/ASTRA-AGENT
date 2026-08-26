import assert from "node:assert/strict";
import { emitQualityProofObservation } from "../../../../scripts/audit/shared/proof-observation.js";

import { resolveWebChatAttachmentTransportKind } from "../children/attach-approved-web-chat-files-once.js";
import { AiFeedInputSchema } from "../schema.js";

assert.equal(resolveWebChatAttachmentTransportKind({ providerKind: "gpt-web-chat", fileCount: 0 }), "skipped");
assert.equal(resolveWebChatAttachmentTransportKind({ providerKind: "gpt-web-chat", fileCount: 1 }), "exact_target_file_input_batch");
assert.equal(resolveWebChatAttachmentTransportKind({ providerKind: "gpt-web-chat", fileCount: 10 }), "exact_target_file_input_batch");
assert.throws(
  () => resolveWebChatAttachmentTransportKind({ providerKind: "gemini-web-chat", fileCount: 1 }),
  /EXACT_TARGET_FILE_INPUT_PROVIDER_NOT_APPROVED/u,
);

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
  () => AiFeedInputSchema.parse({ ...request, transportKind: "exact_target_file_input_batch" }),
  /unrecognized/iu,
  "callers must not choose the attachment transport",
);

process.stdout.write("[ACCEPTANCE] AI Input Gateway attachment routing PASS\n");
emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-AI-INPUT-GATEWAY-003-V1", evidenceMode: "exam.golden", clauses: ["forbidden:0","forbidden:1","forbidden:2","forbidden:3","forbidden:4","forbidden:5","forbidden:6","summary"], locator: "acceptance:attachment-routing:transport-not-public", observedValue: "caller cannot select attachment transport" });
