import type { UploadApprovedFileInput } from "../../../types/dom-automation-inputs.js";

const DOM_UPLOAD_FIXTURE: UploadApprovedFileInput = {
  elementRef: {
    elementRef: "fixture-file-input",
    selector: "input[type='file']",
    targetKind: "file-input",
    confidence: 0.98,
    matchedSignals: ["label", "type"],
    reason: "Fixture file input is visible and enabled.",
    fallbackUsed: false,
  },
  approvedFilePath: "/tmp/grasseye-approved-task.txt",
  approvedTaskFilePath: "/tmp/grasseye-approved-task.txt",
  allowedExtensions: [".txt"],
  uploadPurpose: "approved-file-upload",
};

void DOM_UPLOAD_FIXTURE;
