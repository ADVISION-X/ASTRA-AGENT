import { SyntaxKind, type SourceFile } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import {
  type AiInputGatewayFinding as Finding,
  identifiers,
  pushAiInputGatewayFinding as pushFinding,
  requireAiInputGatewaySource as requireSourceFile,
  stringLiterals,
  typePropertyNames,
} from "./inspector-helpers.js";
import * as P from "./paths.js";

type AttachmentSources = Readonly<{
  adapterContract: SourceFile;
  child: SourceFile;
  shared: SourceFile;
  state: SourceFile;
  submittedState: SourceFile;
  transport: SourceFile;
}>;

const requireAttachmentSources = (
  context: InspectorContext,
  findings: Finding[],
  routingLawId: string,
  proofLawId: string,
): AttachmentSources | null => {
  const child = requireSourceFile(context, findings, routingLawId, P.attachment.childPath);
  const shared = requireSourceFile(context, findings, routingLawId, P.attachment.sharedPath);
  const adapterContract = requireSourceFile(context, findings, proofLawId, P.attachment.adapterContractPath);
  const transport = requireSourceFile(context, findings, routingLawId, P.attachment.exactTargetTransportPath);
  const state = requireSourceFile(context, findings, proofLawId, P.attachment.attachmentStatePath);
  const submittedState = requireSourceFile(context, findings, proofLawId, P.attachment.submittedAttachmentStatePath);
  return child && shared && adapterContract && transport && state && submittedState
    ? { child, shared, adapterContract, transport, state, submittedState }
    : null;
};

const inspectAttachmentRouting = (
  sources: AttachmentSources,
  findings: Finding[],
  routingLawId: string,
  proofLawId: string,
): void => {
  const childIds = identifiers(sources.child);
  const childStrings = stringLiterals(sources.child);
  for (const requiredIdentifier of ["attachApprovedWebChatFilesOnce", "attachByExactTargetFileInputBatch", "resolveWebChatAttachmentTransportKind", "stageApprovedFiles", "waitForStableAttachmentSet", "stagingManifestHash", "onAttachmentUploadCompleted"]) {
    if (!childIds.has(requiredIdentifier)) pushFinding(findings, proofLawId, P.attachment.childPath, "ai-input-gateway/attachment-child-structure", `${P.attachment.childPath} must contain ${requiredIdentifier}.`);
  }
  for (const requiredLiteral of ["skipped", "exact_target_file_input_batch", "attachments_stable"]) {
    if (!childStrings.has(requiredLiteral)) pushFinding(findings, routingLawId, P.attachment.childPath, "ai-input-gateway/fixed-routing-literal", `${P.attachment.childPath} must declare ${requiredLiteral}.`);
  }
  for (const specifier of sources.child.getImportDeclarations().map((declaration) => declaration.getModuleSpecifierValue()).filter((value) => value.includes("web-chat-submit") || value.includes("web-chat-answer"))) {
    pushFinding(findings, routingLawId, P.attachment.childPath, "ai-input-gateway/attachment-child-terminal-boundary", `Attachment child must not import ${specifier}.`);
  }
  if (!identifiers(sources.shared).has("attachApprovedWebChatFilesOnce")) pushFinding(findings, routingLawId, P.attachment.sharedPath, "ai-input-gateway/shared-child-integration", "The web-chat main flow must delegate attachments to the standard child.");
};

const inspectAttachmentProofContract = (
  sources: AttachmentSources,
  findings: Finding[],
  routingLawId: string,
  proofLawId: string,
): void => {
  const proofProperties = typePropertyNames(sources.adapterContract, "WebChatAttachmentUploadProof");
  for (const field of ["uploadAttemptId", "transportKind", "expectedFileCount", "detectedFileCount", "stagingManifestHash", "files", "startedAt", "endedAt", "status", "failureReason", "reviewRequiredReason"]) {
    if (!proofProperties.has(field)) pushFinding(findings, proofLawId, P.attachment.adapterContractPath, "ai-input-gateway/aggregate-proof-field", `Aggregate attachment proof must contain ${field}.`);
  }
  const transportIdentifiers = identifiers(sources.transport);
  for (const required of ["registerBrowserFileArtifact", "issueBrowserFileArtifactGrant", "attachFile"]) {
    if (!transportIdentifiers.has(required)) pushFinding(findings, routingLawId, P.attachment.exactTargetTransportPath, "ai-input-gateway/exact-file-grant-chain", `Exact attachment transport must contain ${required}.`);
  }
  if (!stringLiterals(sources.transport).has("#upload-files")) pushFinding(findings, routingLawId, P.attachment.exactTargetTransportPath, "ai-input-gateway/exact-file-grant-chain", "Exact attachment transport must use only #upload-files.");
};

const inspectAttachmentTerminalProof = (
  sources: AttachmentSources,
  findings: Finding[],
  proofLawId: string,
): void => {
  for (const [sourceFile, variableName, filePath] of [
    [sources.state, "evaluateKnownAttachmentPreflight", P.attachment.attachmentStatePath],
    [sources.submittedState, "verifyLastUserMessageAttachments", P.attachment.submittedAttachmentStatePath],
  ] as const) {
    const initializer = sourceFile.getVariableDeclaration(variableName)?.getInitializer();
    if (!initializer) {
      pushFinding(findings, proofLawId, filePath, "ai-input-gateway/attachment-terminal-proof", `${variableName} must exist.`);
      continue;
    }
    const literals = initializer.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralValue());
    if (literals.some((value) => value.includes("NOT_PRODUCTION_VERIFIED"))) pushFinding(findings, proofLawId, filePath, "ai-input-gateway/attachment-terminal-proof", `${variableName} must implement exact positive and negative terminal evidence instead of an unconditional production rejection.`);
  }
};

export const inspectAttachmentChild = (
  context: InspectorContext,
  findings: Finding[],
  routingLawId: string,
  proofLawId: string,
): void => {
  const sources = requireAttachmentSources(context, findings, routingLawId, proofLawId);
  if (!sources) return;
  inspectAttachmentRouting(sources, findings, routingLawId, proofLawId);
  inspectAttachmentProofContract(sources, findings, routingLawId, proofLawId);
  inspectAttachmentTerminalProof(sources, findings, proofLawId);
};
