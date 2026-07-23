import { existsSync } from "node:fs";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

type Finding = ReturnType<typeof createFinding>;

const lawPath = ".github/instructions/agent-rules/modules/module-ai-input-gateway.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye AI 投喂能立组施工图 V1.md";
const schemaPath = "src/capabilities/ai-input-gateway/schema.ts";
const contractPath = "src/capabilities/ai-input-gateway/contract.ts";
const adapterContractPath = "src/capabilities/ai-input-gateway/contracts/ai-provider-adapter.contract.ts";
const childPath = "src/capabilities/ai-input-gateway/children/attach-approved-web-chat-files-once.ts";
const sharedPath = "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts";
const orderedTransportPath = "src/capabilities/ai-input-gateway/providers/web-chat-ordered-clipboard-attachment.ts";
const nativeTransportPath = "src/capabilities/ai-input-gateway/providers/web-chat-native-picker-attachment.ts";
const attachmentTransportPath = "src/capabilities/ai-input-gateway/providers/web-chat-attachment-transport.ts";
const composerScriptsPath = "src/capabilities/ai-input-gateway/providers/web-chat-composer-scripts.ts";
const browserContractPath = "src/lib/browser/browser-controller.ts";
const nativePrimitivePath = "src/lib/browser/current-chrome-native-multi-file-picker.ts";
const acceptancePath = "src/capabilities/ai-input-gateway/acceptance/attachment.acceptance.ts";
const removedUploadPath = "src/capabilities/ai-input-gateway/providers/web-chat-upload.ts";
const removedAcceptancePath = "scripts/acceptance/ai-input-gateway-ordered-upload.acceptance.ts";

const governedPaths = [
  schemaPath,
  contractPath,
  adapterContractPath,
  childPath,
  sharedPath,
  orderedTransportPath,
  nativeTransportPath,
  attachmentTransportPath,
  composerScriptsPath,
  browserContractPath,
  nativePrimitivePath,
  acceptancePath,
] as const;

const pushFinding = (
  findings: Finding[],
  lawId: string,
  filePath: string,
  checkId: string,
  message: string,
): void => {
  findings.push(createFinding({ lawId, filePath, checkId, message }));
};

const sourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const requireSourceFile = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
  repoPath: string,
): SourceFile | null => {
  const source = sourceFile(context, repoPath);
  if (source) return source;
  pushFinding(findings, lawId, repoPath, "ai-input-gateway/source-present", `${repoPath} must exist in the audit project.`);
  return null;
};

const identifiers = (source: SourceFile): Set<string> =>
  new Set(source.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()));

const stringLiterals = (source: SourceFile): Set<string> =>
  new Set([
    ...source.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
    ...source.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
  ]);

const propertyNames = (node: Node): Set<string> =>
  new Set(node.getDescendantsOfKind(SyntaxKind.PropertyAssignment).map((property) => property.getName()));

const typePropertyNames = (source: SourceFile, typeName: string): Set<string> => {
  const alias = source.getTypeAlias(typeName);
  return new Set(alias?.getTypeNode()?.getDescendantsOfKind(SyntaxKind.PropertySignature)
    .map((property) => property.getName()) ?? []);
};

const inspectPublicBoundary = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const schema = requireSourceFile(context, findings, lawId, schemaPath);
  const contract = requireSourceFile(context, findings, lawId, contractPath);
  if (!schema || !contract) return;
  const inputInitializer = schema.getVariableDeclaration("AiFeedInputSchema")?.getInitializer();
  const publicInputProperties = inputInitializer ? propertyNames(inputInitializer) : new Set<string>();
  const executeOptionProperties = typePropertyNames(contract, "AiInputGatewayExecuteOptions");
  for (const forbidden of ["transportKind", "selector", "coordinate", "tabId", "nativePicker", "fallback"]) {
    if (publicInputProperties.has(forbidden) || executeOptionProperties.has(forbidden)) {
      pushFinding(findings, lawId, schemaPath, "ai-input-gateway/no-public-transport-controls", `Public request/options must not expose ${forbidden}.`);
    }
  }
  if (!executeOptionProperties.has("onAttachmentUploadCompleted")) {
    pushFinding(findings, lawId, contractPath, "ai-input-gateway/aggregate-progress-callback", "Execute options must expose only the aggregate attachment terminal callback.");
  }
};

const inspectAttachmentChild = (
  context: InspectorContext,
  findings: Finding[],
  routingLawId: string,
  proofLawId: string,
): void => {
  const child = requireSourceFile(context, findings, routingLawId, childPath);
  const shared = requireSourceFile(context, findings, routingLawId, sharedPath);
  const adapterContract = requireSourceFile(context, findings, proofLawId, adapterContractPath);
  if (!child || !shared || !adapterContract) return;
  const childIds = identifiers(child);
  const childStrings = stringLiterals(child);
  for (const requiredIdentifier of [
    "attachApprovedWebChatFilesOnce",
    "resolveWebChatAttachmentTransportKind",
    "stageApprovedFiles",
    "waitForStableAttachmentSet",
    "stagingManifestHash",
    "onAttachmentUploadCompleted",
  ]) {
    if (!childIds.has(requiredIdentifier)) {
      pushFinding(findings, proofLawId, childPath, "ai-input-gateway/attachment-child-structure", `${childPath} must contain ${requiredIdentifier}.`);
    }
  }
  for (const requiredLiteral of ["skipped", "ordered_clipboard", "native_picker_batch", "attachments_stable"]) {
    if (!childStrings.has(requiredLiteral)) {
      pushFinding(findings, routingLawId, childPath, "ai-input-gateway/fixed-routing-literal", `${childPath} must declare ${requiredLiteral}.`);
    }
  }
  const forbiddenImports = child.getImportDeclarations()
    .map((declaration) => declaration.getModuleSpecifierValue())
    .filter((specifier) => specifier.includes("web-chat-submit") || specifier.includes("web-chat-answer"));
  for (const specifier of forbiddenImports) {
    pushFinding(findings, routingLawId, childPath, "ai-input-gateway/attachment-child-terminal-boundary", `Attachment child must not import ${specifier}.`);
  }
  if (!identifiers(shared).has("attachApprovedWebChatFilesOnce")) {
    pushFinding(findings, routingLawId, sharedPath, "ai-input-gateway/shared-child-integration", "The web-chat main flow must delegate attachments to the standard child.");
  }
  const proofProperties = typePropertyNames(adapterContract, "WebChatAttachmentUploadProof");
  for (const field of [
    "uploadAttemptId",
    "transportKind",
    "expectedFileCount",
    "detectedFileCount",
    "stagingManifestHash",
    "files",
    "startedAt",
    "endedAt",
    "status",
    "failureReason",
    "reviewRequiredReason",
  ]) {
    if (!proofProperties.has(field)) {
      pushFinding(findings, proofLawId, adapterContractPath, "ai-input-gateway/aggregate-proof-field", `Aggregate attachment proof must contain ${field}.`);
    }
  }
};

const inspectNativePrimitive = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const primitive = requireSourceFile(context, findings, lawId, nativePrimitivePath);
  const browserContract = requireSourceFile(context, findings, lawId, browserContractPath);
  if (!primitive || !browserContract) return;
  if (!identifiers(browserContract).has("selectFilesInNativePicker")) {
    pushFinding(findings, lawId, browserContractPath, "ai-input-gateway/browser-native-picker-contract", "BrowserController must expose the generic native multi-file picker primitive.");
  }
  const literalText = [...stringLiterals(primitive)].join(" ").toLowerCase();
  for (const forbiddenWord of ["chatgpt", "gemini", "seo", "bazi", "qimen", "八字", "奇门"]) {
    if (literalText.includes(forbiddenWord)) {
      pushFinding(findings, lawId, nativePrimitivePath, "ai-input-gateway/generic-browser-primitive", `Generic native picker primitive must not contain ${forbiddenWord}.`);
    }
  }
  for (const requiredIdentifier of ["expectedFileNames", "stagingDirectoryPath", "observedFileNames"]) {
    if (!identifiers(primitive).has(requiredIdentifier)) {
      pushFinding(findings, lawId, nativePrimitivePath, "ai-input-gateway/native-picker-proof", `Native picker primitive must contain ${requiredIdentifier}.`);
    }
  }
};

const inspectRemovedRegion = (
  findings: Finding[],
  lawId: string,
): void => {
  for (const removedPath of [removedUploadPath, removedAcceptancePath]) {
    if (existsSync(resolveFromRepo(removedPath))) {
      pushFinding(findings, lawId, removedPath, "ai-input-gateway/removed-old-region", `${removedPath} must remain deleted.`);
    }
  }
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const publicLawId = selectLawId(context.planEntry.lawIds, "APEX-AI-INPUT-GATEWAY-001-V1");
  const routingLawId = selectLawId(context.planEntry.lawIds, "APEX-AI-INPUT-GATEWAY-003-V1");
  const proofLawId = selectLawId(context.planEntry.lawIds, "APEX-AI-INPUT-GATEWAY-004-V1");
  const findings: Finding[] = [];
  for (const authorityPath of [lawPath, blueprintPath]) {
    if (!existsSync(resolveFromRepo(authorityPath))) {
      pushFinding(findings, publicLawId, authorityPath, "ai-input-gateway/authority-present", `${authorityPath} must exist.`);
    }
  }
  for (const repoPath of governedPaths) {
    requireSourceFile(context, findings, publicLawId, repoPath);
  }
  inspectPublicBoundary(context, findings, publicLawId);
  inspectAttachmentChild(context, findings, routingLawId, proofLawId);
  inspectNativePrimitive(context, findings, routingLawId);
  inspectRemovedRegion(findings, routingLawId);
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [lawPath, blueprintPath, ...governedPaths].sort(),
    reportJson: {
      capabilityDomain: context.planEntry.capabilityDomain,
      status: findings.length === 0 ? "PASS" : "FAIL",
      findings,
    },
  };
};
