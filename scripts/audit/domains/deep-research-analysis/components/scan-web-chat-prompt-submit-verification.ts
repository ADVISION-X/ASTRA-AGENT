import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

type WebChatPromptSubmitVerificationInput = {
  answerSupportFile: SourceFile | undefined;
  submitFile: SourceFile | undefined;
  submitPageActionsFile: SourceFile | undefined;
  evaluationFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
};

const collectSourceTokens = (sourceFile: SourceFile | undefined): Set<string> => {
  if (!sourceFile) {
    return new Set<string>();
  }
  const tokens = new Set<string>();
  for (const literal of sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
    tokens.add(literal.getLiteralText());
  }
  for (const literal of sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
    tokens.add(literal.getLiteralText());
  }
  for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    tokens.add(identifier.getText());
  }
  return tokens;
};

const getVariableInitializerText = (sourceFile: SourceFile | undefined, declarationName: string): string =>
  sourceFile?.getVariableDeclaration(declarationName)?.getInitializer()?.getText() ?? "";

const pushFinding = (input: {
  findings: InspectorFinding[];
  lawId: string;
  filePath: string;
  message: string;
}): void => {
  input.findings.push(createFinding({
    checkId: "deep-research/web-chat-prompt-submit-verification",
    lawId: input.lawId,
    filePath: input.filePath,
    message: input.message,
  }));
};

const inspectRequiredTokens = (input: WebChatPromptSubmitVerificationInput): void => {
  const checks = [
    {
      sourceFile: input.submitFile,
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts",
      markers: [
        "preparePromptComposer",
        "waitForPromptReady",
        "verifyPromptPasted",
        "PROMPT_PASTE_VERIFY_TIMEOUT_MS",
        "verify_prompt_pasted_before_submit",
        "verify_prompt_ready_before_submit",
        "click_send_after_prompt_paste",
        "wasPromptVerifiedBeforeSubmit",
      ],
      message: "web-chat submit runtime must verify prompt paste before submit, click send after return does not submit, and carry pre-submit verification state.",
    },
    {
      sourceFile: input.answerSupportFile,
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-answer-support.ts",
      markers: [
        "hasAnswerProgressWithoutAssistantCount",
        "seenGenerating",
        "previousAnswerText",
      ],
      message: "web-chat answer extraction must not block solely on assistant count when generating or new answer text proves current-round progress.",
    },
    {
      sourceFile: input.submitPageActionsFile,
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-submit-page-actions.ts",
      markers: [
        "verifyPromptPasted",
        "buildVerifyPromptPastedScript",
        "wasPromptVerifiedBeforeSubmit",
      ],
      message: "web-chat submit page actions must expose prompt paste verification and verified-submit gating.",
    },
    {
      sourceFile: input.evaluationFile,
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts",
      markers: [
        "buildVerifyPromptPastedScript",
        "pastedTextCardReady",
        "hasPastedTextCard",
        "sendReady",
        "wasPromptVerifiedBeforeSubmit",
      ],
      message: "web-chat evaluation must distinguish verified prompt submission from empty-composer false positives.",
    },
  ] as const;

  for (const check of checks) {
    const tokens = collectSourceTokens(check.sourceFile);
    const missingMarkers = check.markers.filter((marker) => !tokens.has(marker));
    if (missingMarkers.length === 0) continue;
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: check.filePath,
      message: `${check.message} Missing: ${missingMarkers.join(", ")}.`,
    });
  }
};

const inspectSubmissionOrdering = (input: WebChatPromptSubmitVerificationInput): void => {
  const submitterText = getVariableInitializerText(input.submitFile, "submitPromptViaClipboard");
  const preparePosition = submitterText.indexOf("preparePromptComposer");
  const submitPosition = submitterText.indexOf("submitPromptFromComposer");
  if (preparePosition !== -1 && submitPosition !== -1 && preparePosition < submitPosition) {
    return;
  }
  pushFinding({
    findings: input.findings,
    lawId: input.lawId,
    filePath: "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts",
    message: "web-chat submit runtime must complete prompt preparation before invoking submitPromptFromComposer.",
  });
};

const inspectUnsafeComposerSuccess = (input: WebChatPromptSubmitVerificationInput): void => {
  const verifySubmittedText = getVariableInitializerText(input.evaluationFile, "buildVerifyPromptSubmittedScript");
  if (verifySubmittedText.includes("|| !promptStillInComposer")) {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts",
      message: "web-chat submit verification must not treat !promptStillInComposer as unconditional success.",
    });
  }
  if (verifySubmittedText.includes("composerClearedAfterVerifiedPaste")) {
    return;
  }
  pushFinding({
    findings: input.findings,
    lawId: input.lawId,
    filePath: "src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts",
    message: "web-chat submit verification must gate composer-cleared success on previously verified prompt paste state.",
  });
};

const inspectPromptSubmitProtection = (input: WebChatPromptSubmitVerificationInput): void => {
  const preparePromptComposerText = getVariableInitializerText(input.submitFile, "preparePromptComposer");
  const submitPromptText = getVariableInitializerText(input.submitFile, "submitPromptFromComposer");
  const pasteTimeoutText = getVariableInitializerText(input.submitFile, "PROMPT_PASTE_VERIFY_TIMEOUT_MS");
  if (pasteTimeoutText !== "20_000") {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts",
      message: "web-chat prompt paste verification must keep the long prompt observation window at 20_000ms.",
    });
  }
  if (preparePromptComposerText.includes("for (") || preparePromptComposerText.includes("probePromptRetryStateBeforeClear")) {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts",
      message: "web-chat prompt preparation must not loop clear/paste retries after a paste attempt.",
    });
  }
  if (!submitPromptText.includes("click_send_after_prompt_paste")) {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts",
      message: "web-chat submit must click the provider send button when Return does not prove submission.",
    });
  }
};

export const inspectWebChatPromptSubmitVerification = (
  input: WebChatPromptSubmitVerificationInput,
): void => {
  for (const sourceFile of [input.answerSupportFile, input.submitFile, input.submitPageActionsFile, input.evaluationFile]) {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }
  inspectRequiredTokens(input);
  inspectSubmissionOrdering(input);
  inspectUnsafeComposerSuccess(input);
  inspectPromptSubmitProtection(input);
};
