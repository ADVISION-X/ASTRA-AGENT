import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

type WebChatPromptSubmitVerificationInput = {
  answerSupportFile: SourceFile | undefined;
  submitFile: SourceFile | undefined;
  submitPageActionsFile: SourceFile | undefined;
  evaluationFile: SourceFile | undefined;
  selectorPreludeFile: SourceFile | undefined;
  openFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
};

type RequiredTokenCheck = {
  sourceFile: SourceFile | undefined;
  filePath: string;
  markers: readonly string[];
  message: string;
};

type PromptPasteTruthDiagnostics = {
  missingDiagnostics: string[];
  missingEvaluationTokens: string[];
  missingSelectorPreludeTokens: string[];
  missingProviderOpenTokens: string[];
  evaluationTokens: ReadonlySet<string>;
};

const requiredTokenChecks = (input: WebChatPromptSubmitVerificationInput): RequiredTokenCheck[] => [
  {
    sourceFile: input.submitFile,
    filePath: "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts",
    markers: [
      "preparePromptComposer",
      "waitForPromptReady",
      "verifyPromptPasted",
      "PROMPT_PASTE_VERIFY_TIMEOUT_MS",
      "expectedLength",
      "verify_prompt_pasted_before_submit",
      "verify_prompt_ready_before_submit",
      "expectedSuffix",
      "click_send_after_prompt_paste",
      "wasPromptVerifiedBeforeSubmit",
    ],
    message: "web-chat submit runtime must verify prompt paste before submit, click send after return does not submit, and carry pre-submit verification state.",
  },
  {
    sourceFile: input.openFile,
    filePath: "src/capabilities/ai-input-gateway/providers/web-chat-open.ts",
    markers: [
      "PROVIDER_COMPOSER_READY_TIMEOUT_MS",
      "60_000",
      "lastMessage",
      "provider composer did not become ready; last=",
    ],
    message: "web-chat provider open runtime must allow real provider composer readiness and expose concise timeout diagnostics.",
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
    sourceFile: input.selectorPreludeFile,
    filePath: "src/capabilities/ai-input-gateway/providers/web-chat-selector-prelude.ts",
    markers: [
      "readComposerVisibleText",
      "innerText",
    ],
    message: "web-chat selector prelude must expose visible composer text reading for rich-text provider editors.",
  },
  {
    sourceFile: input.evaluationFile,
    filePath: "src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts",
    markers: [
      "buildVerifyPromptPastedScript",
      "pastedTextCardReady",
      "hasPastedTextCard",
      "promptSuffixVisible",
      "expectedLength",
      "expectedSuffix",
      "sendReady",
      "wasPromptVerifiedBeforeSubmit",
    ],
    message: "web-chat evaluation must distinguish verified prompt submission from empty-composer false positives.",
  },
];

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
  for (const literal of sourceFile.getDescendantsOfKind(SyntaxKind.NumericLiteral)) {
    tokens.add(literal.getText());
  }
  for (const templateExpression of sourceFile.getDescendantsOfKind(SyntaxKind.TemplateExpression)) {
    tokens.add(templateExpression.getHead().getLiteralText());
    for (const span of templateExpression.getTemplateSpans()) {
      tokens.add(span.getLiteral().getLiteralText());
    }
  }
  for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    tokens.add(identifier.getText());
  }
  return tokens;
};

const getVariableInitializerText = (sourceFile: SourceFile | undefined, declarationName: string): string =>
  sourceFile?.getVariableDeclaration(declarationName)?.getInitializer()?.getText() ?? "";

const hasTokenPart = (tokens: ReadonlySet<string>, marker: string): boolean =>
  [...tokens].some((token) => token.includes(marker));

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
  for (const check of requiredTokenChecks(input)) {
    const tokens = collectSourceTokens(check.sourceFile);
    const missingMarkers = check.markers.filter((marker) => !hasTokenPart(tokens, marker));
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

const collectPromptPasteTruthDiagnostics = (
  input: WebChatPromptSubmitVerificationInput,
): PromptPasteTruthDiagnostics => {
  const submitTokens = collectSourceTokens(input.submitFile);
  const evaluationTokens = collectSourceTokens(input.evaluationFile);
  const selectorPreludeTokens = collectSourceTokens(input.selectorPreludeFile);
  const providerOpenTokens = collectSourceTokens(input.openFile);
  return {
    missingDiagnostics: [
      "expectedChars=",
      "prefixVisible=",
      "suffixVisible=",
      "pastedCard=",
      "sendReady=",
    ].filter((marker) => !hasTokenPart(submitTokens, marker)),
    missingEvaluationTokens: [
      "promptSuffixVisible",
      "promptLengthClose",
      "expectedLength",
      "expectedSuffix",
      "provider prompt suffix and length detected in composer",
    ].filter((marker) => !hasTokenPart(evaluationTokens, marker)),
    missingSelectorPreludeTokens: [
      "readComposerVisibleText",
      "return clip(node.innerText || node.textContent || \"\")",
    ].filter((marker) => !hasTokenPart(selectorPreludeTokens, marker)),
    missingProviderOpenTokens: [
      "PROVIDER_COMPOSER_READY_TIMEOUT_MS",
      "60_000",
      "provider composer did not become ready; last=",
    ].filter((marker) => !hasTokenPart(providerOpenTokens, marker)),
    evaluationTokens,
  };
};

const writePromptPasteTruthDiagnosticSummary = (diagnostics: PromptPasteTruthDiagnostics): void => {
  process.stdout.write(
    `[AUDIT][deep-research-analysis][web-chat-paste-truth] diagnosticsMissing=${String(diagnostics.missingDiagnostics.length)} evaluationMissing=${String(diagnostics.missingEvaluationTokens.length)} visibleTextMissing=${String(diagnostics.missingSelectorPreludeTokens.length)} composerReadyMissing=${String(diagnostics.missingProviderOpenTokens.length)}\n`,
  );
};

const inspectPromptPasteTruthDiagnosticFindings = (
  input: WebChatPromptSubmitVerificationInput,
  diagnostics: PromptPasteTruthDiagnostics,
): void => {
  if (diagnostics.missingDiagnostics.length > 0) {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts",
      message: `web-chat paste review diagnostics must expose concise prompt proof metrics. Missing: ${diagnostics.missingDiagnostics.join(", ")}.`,
    });
  }
  if (diagnostics.missingEvaluationTokens.length > 0) {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts",
      message: `web-chat prompt paste verification must use suffix plus length proof. Missing: ${diagnostics.missingEvaluationTokens.join(", ")}.`,
    });
  }
  if (diagnostics.missingSelectorPreludeTokens.length > 0) {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-selector-prelude.ts",
      message: `web-chat prompt paste verification must read visible composer text before DOM-structure text. Missing: ${diagnostics.missingSelectorPreludeTokens.join(", ")}.`,
    });
  }
  if (diagnostics.missingProviderOpenTokens.length > 0) {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-open.ts",
      message: `web-chat provider composer readiness must keep the real-provider wait budget and timeout diagnostics. Missing: ${diagnostics.missingProviderOpenTokens.join(", ")}.`,
    });
  }

  if (hasTokenPart(diagnostics.evaluationTokens, "provider send button ready after paste")) {
    pushFinding({
      findings: input.findings,
      lawId: input.lawId,
      filePath: "src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts",
      message: "web-chat prompt paste verification must not treat sendReady alone as prompt proof.",
    });
  }
};

const inspectPromptPasteTruthDiagnostics = (input: WebChatPromptSubmitVerificationInput): void => {
  const diagnostics = collectPromptPasteTruthDiagnostics(input);
  writePromptPasteTruthDiagnosticSummary(diagnostics);
  inspectPromptPasteTruthDiagnosticFindings(input, diagnostics);
};

export const inspectWebChatPromptSubmitVerification = (
  input: WebChatPromptSubmitVerificationInput,
): void => {
  for (const sourceFile of [input.answerSupportFile, input.submitFile, input.submitPageActionsFile, input.evaluationFile, input.selectorPreludeFile, input.openFile]) {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }
  inspectRequiredTokens(input);
  inspectSubmissionOrdering(input);
  inspectUnsafeComposerSuccess(input);
  inspectPromptSubmitProtection(input);
  inspectPromptPasteTruthDiagnostics(input);
};
