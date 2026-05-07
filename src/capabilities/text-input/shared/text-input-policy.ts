export const DEFAULT_TEXT_INPUT_POLICY = {
  primitiveTimeoutMs: 60_000,
  maxDurationMs: 60_000,
  maxLengthPolicy: {
    maxLength: 4000,
    failureStatus: "failed",
  },
  sensitiveTextPolicy: {
    classification: "public",
    allowSensitiveWrite: false,
    requiresHumanApproval: true,
    requiresMapPolicyApproval: false,
  },
  redactionPolicy: {
    mode: "masked",
    maxPreviewChars: 12,
    keepFullTextInFullDebugOnly: true,
  },
  clipboardPolicy: {
    allowPaste: true,
    requiredForPaste: true,
    restoreStrategy: "restore_original",
    clearClipboardAfterOperation: false,
    requireSnapshotHash: true,
    allowPlaintextPersistence: false,
  },
  commitPolicy: {
    allowCommit: false,
    requireApprovedCommitRef: true,
    requireHumanApproval: true,
    requireMapPolicyApproval: false,
    allowedCommitKeys: ["Enter"],
  },
  keyPolicy: {
    allowEnterInPressKey: false,
    allowArrowNavigation: true,
  },
  replacePolicy: {
    allowReplace: true,
    requireClearBeforeWrite: true,
    writeMode: "type-text",
  },
} as const;