import { SyntaxKind } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type {
  InspectorContext,
  InspectorFinding,
} from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import {
  flowPath,
  gatewayCanonicalRoutingPath,
} from "./inspector-paths.js";

const finding = (
  lawId: string,
  checkId: string,
  filePath: string,
  message: string,
): InspectorFinding => createFinding({ lawId, clauseId: "apex-xuanxue-001-v6-session-bound-cloud-pull", checkId, filePath, message });

const inspectCanonicalProviderIdentity = (
  findings: InspectorFinding[],
  lawId: string,
  values: ReadonlySet<string>,
): void => {
  const required = [
    "focusChatGptConversationByCanonicalPath",
    "WEB_CHAT_BOUND_CONVERSATION_NOT_READY",
    "observeOne",
    "verifyCanonicalMarker",
    "CHATGPT_CANONICAL_CONVERSATION_IDENTITY_AMBIGUOUS",
  ];
  for (const value of required) {
    if (values.has(value)) continue;
    findings.push(finding(lawId,
      "xuanxue-ai-production/canonical-provider-identity",
      gatewayCanonicalRoutingPath,
      `Canonical provider recovery must contain ${value}.`));
  }
  for (const forbidden of [
    "WebChatTitleRenameState", "renameSubmittedChatGptConversation",
    "scheduleWebChatTitleHousekeeping",
  ]) {
    if (!values.has(forbidden)) continue;
    findings.push(finding(lawId,
      "xuanxue-ai-production/title-chain-retired",
      gatewayCanonicalRoutingPath,
      `Provider title side chain must not contain ${forbidden}.`));
  }
};

const inspectTerminalAttachmentGuard = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const flow = context.project.getSourceFile(resolveFromRepo(flowPath));
  if (!flow) {
    findings.push(finding(lawId, "xuanxue-ai-production/source-present",
      flowPath, `${flowPath} must exist in the audit project.`));
    return;
  }
  const helper = flow.getVariableDeclaration(
    "hasTerminalAttachmentTransportProof",
  );
  if (!helper) {
    findings.push(finding(lawId,
      "xuanxue-ai-production/no-terminal-attachment-reentry", flowPath,
      "Factory flow must define hasTerminalAttachmentTransportProof."));
    return;
  }
  for (const functionName of ["executeStage", "executeStageUntilSettled"]) {
    const guarded = flow.getVariableDeclaration(functionName)?.getInitializer()
      ?.getDescendantsOfKind(SyntaxKind.CallExpression)
      .some((call) => call.getExpression().asKind(SyntaxKind.Identifier)
        ?.getSymbol()?.getDeclarations().includes(helper));
    if (guarded) continue;
    findings.push(finding(lawId,
      "xuanxue-ai-production/no-terminal-attachment-reentry", flowPath,
      `${functionName} must stop automatic Gateway re-entry after a terminal attachment proof.`));
  }
};

export const inspectXuanxueRecoveryDurability = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
  values: ReadonlySet<string>,
): void => {
  inspectCanonicalProviderIdentity(findings, lawId, values);
  inspectTerminalAttachmentGuard(context, findings, lawId);
};
