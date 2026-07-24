import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const facebookSchemaPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.schema.ts";
const facebookAiJudgePath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts";
const facebookAiTimeoutPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-timeout.ts";
const facebookRoundOutcomesPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-outcomes.ts";
const webChatOpenPath = "src/capabilities/ai-input-gateway/providers/web-chat-open.ts";
const webChatPageActionsPath = "src/capabilities/ai-input-gateway/providers/web-chat-page-actions.ts";
const webChatSharedPath = "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts";
const webChatSubmitPath = "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts";
const attachmentChildPath = "src/capabilities/ai-input-gateway/children/attach-approved-web-chat-files-once.ts";
const webChatWorkspacePath = "src/capabilities/ai-input-gateway/providers/web-chat-workspace.ts";

const sourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const hasIdentifier = (file: SourceFile | undefined, name: string): boolean =>
  file?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === name) ?? false;

const hasTrueProperty = (file: SourceFile | undefined, name: string): boolean =>
  file?.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) =>
    property.getName() === name && property.getInitializer()?.getKind() === SyntaxKind.TrueKeyword) ?? false;

const hasCallWithFalse = (file: SourceFile | undefined, methodName: string): boolean =>
  file?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getName() === methodName
      && call.getArguments().some((argument) => argument.getKind() === SyntaxKind.FalseKeyword);
  }) ?? false;

const hasNumericConstant = (file: SourceFile | undefined, name: string, value: number): boolean =>
  file?.getVariableDeclaration(name)?.getInitializerIfKind(SyntaxKind.NumericLiteral)?.getLiteralValue() === value;

const hasObjectFields = (file: SourceFile | undefined, names: readonly string[]): boolean => {
  const propertyNames = new Set(
    file?.getDescendantsOfKind(SyntaxKind.PropertyAssignment).map((property) => property.getName()) ?? [],
  );
  return names.every((name) => propertyNames.has(name));
};

type SafetyState = {
  context: InspectorContext;
  findings: InspectorFinding[];
  lawId: string;
};

const inspectPreferenceAndTimeout = (state: SafetyState): void => {
  const schema = sourceFile(state.context, facebookSchemaPath);
  const aiJudge = sourceFile(state.context, facebookAiJudgePath);
  const aiTimeout = sourceFile(state.context, facebookAiTimeoutPath);
  if (!hasIdentifier(schema, "notInterestedEnabled") || !hasCallWithFalse(schema, "default")) {
    state.findings.push(createFinding({
      checkId: "facebook-mining/not-interested-default-off",
      lawId: state.lawId,
      filePath: facebookSchemaPath,
      message: "Facebook mining must keep notInterestedEnabled off by default.",
    }));
  }
  if (!hasIdentifier(aiJudge, "executeFacebookAiFeedWithHardTimeout") || !hasIdentifier(aiTimeout, "AbortController")) {
    state.findings.push(createFinding({
      checkId: "facebook-mining/ai-hard-timeout",
      lawId: state.lawId,
      filePath: facebookAiTimeoutPath,
      message: "Facebook AI judgment must have a hard timeout and abort signal.",
    }));
  }
};

const inspectWorkspaceSafety = (state: SafetyState): void => {
  const open = sourceFile(state.context, webChatOpenPath);
  const shared = sourceFile(state.context, webChatSharedPath);
  const workspace = sourceFile(state.context, webChatWorkspacePath);
  if (!hasIdentifier(shared, "ensureProviderWorkspaceFocused")) {
    state.findings.push(createFinding({
      checkId: "facebook-mining/provider-tab-focus-guard",
      lawId: state.lawId,
      filePath: webChatSharedPath,
      message: "Facebook web-chat feed must refocus provider workspace before upload, submit, and answer extraction.",
    }));
  }
  if (hasTrueProperty(open, "allowAnyProviderTab") || hasTrueProperty(workspace, "allowAnyProviderTab")) {
    state.findings.push(createFinding({
      checkId: "facebook-mining/no-arbitrary-provider-tab",
      lawId: state.lawId,
      filePath: webChatOpenPath,
      message: "Facebook web-chat feed must not reuse arbitrary provider tabs.",
    }));
  }
  if (!hasIdentifier(open, "saveWorkspaceUrl") || hasIdentifier(workspace, "lowerTitle")) {
    state.findings.push(createFinding({
      checkId: "facebook-mining/workspace-url-pinning",
      lawId: state.lawId,
      filePath: webChatOpenPath,
      message: "Facebook web-chat feed must pin the opened workspace URL instead of matching old provider tabs by title.",
    }));
  }
};

const inspectAttachmentSafety = (state: SafetyState): void => {
  const shared = sourceFile(state.context, webChatSharedPath);
  const attachmentChild = sourceFile(state.context, attachmentChildPath);
  if (!hasIdentifier(shared, "attachApprovedWebChatFilesOnce")) {
    state.findings.push(createFinding({
      checkId: "facebook-mining/standard-attachment-child",
      lawId: state.lawId,
      filePath: webChatSharedPath,
      message: "Facebook web-chat feed must use the standard AI Input Gateway attachment child.",
    }));
  }
  if (!hasIdentifier(attachmentChild, "attachApprovedWebChatFilesOnce") || !hasIdentifier(attachmentChild, "onAttachmentUploadCompleted")) {
    state.findings.push(createFinding({
      checkId: "facebook-mining/attachment-proof-boundary",
      lawId: state.lawId,
      filePath: attachmentChildPath,
      message: "The shared attachment child must return one terminal aggregate proof.",
    }));
  }
};

const inspectTerminalSafety = (state: SafetyState): void => {
  const submit = sourceFile(state.context, webChatSubmitPath);
  const roundOutcomes = sourceFile(state.context, facebookRoundOutcomesPath);
  if (!hasNumericConstant(submit, "MAX_SUBMIT_BUTTON_WAIT_MS", 45_000)) {
    state.findings.push(createFinding({
      checkId: "facebook-mining/submit-wait-short-cap",
      lawId: state.lawId,
      filePath: webChatSubmitPath,
      message: "Facebook web-chat submit button wait must not consume the whole judgment timeout.",
    }));
  }
  if (!hasObjectFields(roundOutcomes, ["terminal", "reason"]) || !hasIdentifier(roundOutcomes, "judgment")) {
    state.findings.push(createFinding({
      checkId: "facebook-mining/ai-judgment-failure-terminal",
      lawId: state.lawId,
      filePath: facebookRoundOutcomesPath,
      message: "Facebook AI judgment failure must save evidence and terminate the mission for review.",
    }));
  }
};

export const inspectFacebookSafetyDefaults = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const paths = [
    facebookSchemaPath,
    facebookAiJudgePath,
    facebookAiTimeoutPath,
    facebookRoundOutcomesPath,
    webChatOpenPath,
    webChatPageActionsPath,
    webChatSharedPath,
    webChatSubmitPath,
    attachmentChildPath,
    webChatWorkspacePath,
  ];
  for (const repoPath of paths) {
    inspectedFiles.add(repoPath);
  }
  const state = { context, findings, lawId };
  inspectPreferenceAndTimeout(state);
  inspectWorkspaceSafety(state);
  inspectAttachmentSafety(state);
  inspectTerminalSafety(state);
};
