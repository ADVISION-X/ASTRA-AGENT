import { readFileSync } from "node:fs";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const facebookSchemaPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.schema.ts";
const facebookAiJudgePath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts";
const facebookAiTimeoutPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-timeout.ts";
const facebookRoundOutcomesPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-outcomes.ts";
const webChatOpenPath = "src/capabilities/ai-input-gateway/providers/web-chat-open.ts";
const webChatPageActionsPath = "src/capabilities/ai-input-gateway/providers/web-chat-page-actions.ts";
const webChatSharedPath = "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts";
const webChatSubmitPath = "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts";
const webChatUploadPath = "src/capabilities/ai-input-gateway/providers/web-chat-upload.ts";
const webChatWorkspacePath = "src/capabilities/ai-input-gateway/providers/web-chat-workspace.ts";

const readRepoText = (repoPath: string): string => readFileSync(resolveFromRepo(repoPath), "utf8");

type WebChatSafetySources = {
  open: string;
  pageActions: string;
  roundOutcomes: string;
  shared: string;
  submit: string;
  upload: string;
  workspace: string;
};

const inspectWebChatSafetyGuards = (
  findings: InspectorFinding[],
  lawId: string,
  sources: WebChatSafetySources,
): void => {
  if (!sources.shared.includes("ensureProviderWorkspaceFocused")) {
    findings.push(createFinding({ checkId: "facebook-mining/provider-tab-focus-guard", lawId, filePath: webChatSharedPath, message: "Facebook web-chat feed must refocus provider workspace before upload, submit, and answer extraction." }));
  }
  if (/chooseFileInNativeDialog/u.test(sources.upload)) {
    findings.push(createFinding({ checkId: "facebook-mining/no-blind-native-file-path-entry", lawId, filePath: webChatUploadPath, message: "Facebook web-chat upload must not type file paths unless a provider file input is located." }));
  }
  if (!/allowAnyProviderTab:\s*false/u.test(sources.open) || !/allowAnyProviderTab:\s*false/u.test(sources.workspace)) {
    findings.push(createFinding({ checkId: "facebook-mining/no-arbitrary-provider-tab", lawId, filePath: webChatOpenPath, message: "Facebook web-chat feed must not reuse arbitrary provider tabs." }));
  }
  if (!sources.open.includes("saveWorkspaceUrl") || /lowerTitle contains/u.test(sources.workspace)) {
    findings.push(createFinding({ checkId: "facebook-mining/workspace-url-pinning", lawId, filePath: webChatOpenPath, message: "Facebook web-chat feed must pin the opened workspace URL instead of matching old provider tabs by title." }));
  }
  if (!/MAX_UPLOAD_COMPLETE_WAIT_MS\s*=\s*45_000/u.test(sources.pageActions)) {
    findings.push(createFinding({ checkId: "facebook-mining/upload-wait-short-cap", lawId, filePath: webChatPageActionsPath, message: "Facebook web-chat upload completion wait must not consume the whole judgment timeout." }));
  }
  if (!/MAX_SUBMIT_BUTTON_WAIT_MS\s*=\s*45_000/u.test(sources.submit)) {
    findings.push(createFinding({ checkId: "facebook-mining/submit-wait-short-cap", lawId, filePath: webChatSubmitPath, message: "Facebook web-chat submit button wait must not consume the whole judgment timeout." }));
  }
  if (!/terminal:\s*true,\s*reason:\s*input\.judgment\.reason/u.test(sources.roundOutcomes)) {
    findings.push(createFinding({ checkId: "facebook-mining/ai-judgment-failure-terminal", lawId, filePath: facebookRoundOutcomesPath, message: "Facebook AI judgment failure must save evidence and terminate the mission for review." }));
  }
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
    webChatUploadPath,
    webChatWorkspacePath,
  ];
  for (const repoPath of paths) inspectedFiles.add(repoPath);
  const schemaText = readRepoText(facebookSchemaPath);
  if (!/notInterestedEnabled:\s*z\.boolean\(\)\.default\(false\)/u.test(schemaText)) {
    findings.push(createFinding({ checkId: "facebook-mining/not-interested-default-off", lawId, filePath: facebookSchemaPath, message: "Facebook mining must keep notInterestedEnabled off by default." }));
  }
  if (!/executeFacebookAiFeedWithHardTimeout/u.test(readRepoText(facebookAiJudgePath)) || !/AbortController/u.test(readRepoText(facebookAiTimeoutPath))) {
    findings.push(createFinding({ checkId: "facebook-mining/ai-hard-timeout", lawId, filePath: facebookAiTimeoutPath, message: "Facebook AI judgment must have a hard timeout and abort signal." }));
  }
  inspectWebChatSafetyGuards(findings, lawId, {
    open: readRepoText(webChatOpenPath),
    pageActions: readRepoText(webChatPageActionsPath),
    roundOutcomes: readRepoText(facebookRoundOutcomesPath),
    shared: readRepoText(webChatSharedPath),
    submit: readRepoText(webChatSubmitPath),
    upload: readRepoText(webChatUploadPath),
    workspace: readRepoText(webChatWorkspacePath),
  });
};
