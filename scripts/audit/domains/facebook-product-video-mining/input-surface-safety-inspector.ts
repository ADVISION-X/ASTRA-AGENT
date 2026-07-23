import { readFileSync } from "node:fs";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { containsAll, containsAny } from "../../shared/no-regex.js";
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

const readRepoText = (repoPath: string): string => readFileSync(resolveFromRepo(repoPath), "utf8");

type WebChatSafetySources = {
  open: string;
  pageActions: string;
  roundOutcomes: string;
  shared: string;
  submit: string;
  attachmentChild: string;
  workspace: string;
};

const inspectWorkspaceGuards = (findings: InspectorFinding[], lawId: string, sources: WebChatSafetySources): void => {
  if (!sources.shared.includes("ensureProviderWorkspaceFocused")) {
    findings.push(createFinding({ checkId: "facebook-mining/provider-tab-focus-guard", lawId, filePath: webChatSharedPath, message: "Facebook web-chat feed must refocus provider workspace before upload, submit, and answer extraction." }));
  }
  if (!sources.shared.includes("attachApprovedWebChatFilesOnce")) {
    findings.push(createFinding({ checkId: "facebook-mining/standard-attachment-child", lawId, filePath: webChatSharedPath, message: "Facebook web-chat feed must use the standard AI Input Gateway attachment child." }));
  }
  if (!containsAll(sources.open, ["allowAnyProviderTab", "false"]) || !containsAll(sources.workspace, ["allowAnyProviderTab", "false"])) {
    findings.push(createFinding({ checkId: "facebook-mining/no-arbitrary-provider-tab", lawId, filePath: webChatOpenPath, message: "Facebook web-chat feed must not reuse arbitrary provider tabs." }));
  }
  if (!sources.open.includes("saveWorkspaceUrl") || sources.workspace.includes("lowerTitle contains")) {
    findings.push(createFinding({ checkId: "facebook-mining/workspace-url-pinning", lawId, filePath: webChatOpenPath, message: "Facebook web-chat feed must pin the opened workspace URL instead of matching old provider tabs by title." }));
  }
};

const inspectWaitBudgetGuards = (findings: InspectorFinding[], lawId: string, sources: WebChatSafetySources): void => {
  if (!containsAll(sources.attachmentChild, ["attachApprovedWebChatFilesOnce", "onAttachmentUploadCompleted"])) {
    findings.push(createFinding({ checkId: "facebook-mining/attachment-proof-boundary", lawId, filePath: attachmentChildPath, message: "The shared attachment child must return one terminal aggregate proof." }));
  }
  if (!containsAll(sources.submit, ["MAX_SUBMIT_BUTTON_WAIT_MS", "45_000"])) {
    findings.push(createFinding({ checkId: "facebook-mining/submit-wait-short-cap", lawId, filePath: webChatSubmitPath, message: "Facebook web-chat submit button wait must not consume the whole judgment timeout." }));
  }
};

const inspectTerminalOutcomeGuard = (findings: InspectorFinding[], lawId: string, sources: WebChatSafetySources): void => {
  if (!containsAll(sources.roundOutcomes, ["terminal", "true", "reason", "input.judgment.reason"])) {
    findings.push(createFinding({ checkId: "facebook-mining/ai-judgment-failure-terminal", lawId, filePath: facebookRoundOutcomesPath, message: "Facebook AI judgment failure must save evidence and terminate the mission for review." }));
  }
};

const inspectWebChatSafetyGuards = (
  findings: InspectorFinding[],
  lawId: string,
  sources: WebChatSafetySources,
): void => {
  inspectWorkspaceGuards(findings, lawId, sources);
  inspectWaitBudgetGuards(findings, lawId, sources);
  inspectTerminalOutcomeGuard(findings, lawId, sources);
};

export const inspectFacebookSafetyDefaults = (
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
  for (const repoPath of paths) inspectedFiles.add(repoPath);
  const schemaText = readRepoText(facebookSchemaPath);
  if (!containsAll(schemaText, ["notInterestedEnabled", "z.boolean()", ".default(false)"])) {
    findings.push(createFinding({ checkId: "facebook-mining/not-interested-default-off", lawId, filePath: facebookSchemaPath, message: "Facebook mining must keep notInterestedEnabled off by default." }));
  }
  if (!containsAny(readRepoText(facebookAiJudgePath), ["executeFacebookAiFeedWithHardTimeout"]) || !containsAny(readRepoText(facebookAiTimeoutPath), ["AbortController"])) {
    findings.push(createFinding({ checkId: "facebook-mining/ai-hard-timeout", lawId, filePath: facebookAiTimeoutPath, message: "Facebook AI judgment must have a hard timeout and abort signal." }));
  }
  inspectWebChatSafetyGuards(findings, lawId, {
    open: readRepoText(webChatOpenPath),
    pageActions: readRepoText(webChatPageActionsPath),
    roundOutcomes: readRepoText(facebookRoundOutcomesPath),
    shared: readRepoText(webChatSharedPath),
    submit: readRepoText(webChatSubmitPath),
    attachmentChild: readRepoText(attachmentChildPath),
    workspace: readRepoText(webChatWorkspacePath),
  });
};
