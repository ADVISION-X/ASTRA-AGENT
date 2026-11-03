import { Node, Project, SyntaxKind } from "ts-morph";
import { astExecutableTree } from "../../shared/ast-node-identity.js";
import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import {
  createLocalFinding,
  extensionCommandRuntimePath,
  identifiers,
  requireIdentifiers,
  requireSource,
  sourcePaths,
  targetAuthorityPath,
} from "./inspector-support.js";

type RequiredSource = NonNullable<ReturnType<typeof requireSource>>;
type InvocationPayloadSources = Readonly<{
  transport: RequiredSource;
  extensionActor: RequiredSource;
  extensionCrypto: RequiredSource;
  journal: RequiredSource;
  journalEvidence: RequiredSource;
  journalReplay: RequiredSource;
  locator: RequiredSource;
  commandLogging: RequiredSource;
  commandDiagnostic: RequiredSource;
  frameDiagnostic: RequiredSource;
}>;
const authenticatedMediaRuntimePath =
  "src/lib/browser/chrome-extension/authenticated-media-runtime.ts";
const extensionActorPath = "src/lib/browser/chrome-extension/websocket-actor.ts";
const extensionCryptoPath = "src/lib/browser/chrome-extension/websocket-actor-crypto.ts";
const commandLoggingPath = "src/lib/browser/exact-target/browser-command-runtime-logging.ts";
const commandDiagnosticPath = "src/lib/browser/chrome-extension/websocket-command-diagnostic.ts";
const frameDiagnosticPath = "src/lib/browser/chrome-extension/websocket-actor-diagnostics.ts";
const journalEvidencePath = "src/lib/browser/exact-target/browser-mutation-evidence.ts";
const locatorPath = "src/lib/browser/exact-target/browser-submitted-conversation-locator.ts";
const journalReplayPath = "src/lib/browser/exact-target/browser-mutation-replay-evidence.ts";

const inspectOpaqueRawFields = (
  sources: readonly (readonly [string, RequiredSource])[],
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const forbiddenRawFields = new Set([
    "targetId", "documentId", "filePath", "filePaths", "resolvedPath", "sourcePath", "rawPath",
    "pageContent", "outerHTML", "innerHTML", "cookie", "cookies", "credential", "credentials", "password", "authorization",
  ]);
  for (const [repoPath, source] of sources) {
    const leaked = [...identifiers(source)].find((name) => forbiddenRawFields.has(name));
    if (leaked) findings.push(createLocalFinding({
      checkId: "browser-authority/opaque-proof-boundary",
      lawId,
      filePath: repoPath,
      message: `Browser wire, durable proof and diagnostics must not expose raw authority/page/path field ${leaked}.`,
    }));
  }
};

const authenticatedMediaReference = (() => {
  const project = new Project({ useInMemoryFileSystem: true });
  const expected = project.createSourceFile("media.ts", "export const executeRegisteredExtensionCommand = async (\n  runtime: ExtensionDebuggerRuntime, target: ExtensionExactTarget,\n  command: Exclude<BrowserGovernedCommand, { kind: \"dom-intent\" }>, lifecycle: CommandLifecycle,\n): Promise<unknown> => {\n  switch (command.kind) {\n    case \"observe\": {\n      const result = await executeRegisteredDomIntent(runtime, target, { kind: \"document\" }, lifecycle.assertCurrent);\n      lifecycle.assertCurrent(); return result;\n    }\n    case \"wait\": return command.transientDomConfirmationStage === undefined ? executeBoundedBrowserWait(command.durationMs)\n      : { stage: command.transientDomConfirmationStage, waitedMs: command.transientDomConfirmationStage === 1 ? 1_500 : 3_000 };\n    case \"park-target\": await lifecycle.parkTarget(); return { parked: true };\n    case \"file-input\": return executeExtensionFileInput({ runtime, target, assertCurrent: lifecycle.assertCurrent,\n      selector: command.selector, activation: command.activation, approvedFiles: command.approvedFiles, resolvedFilePaths: command.resolvedFilePaths });\n    case \"authenticated-media\": return executeAuthenticatedMedia(runtime, target, command.canonicalConversationUrl,\n      command.userTurnId, command.semanticMediaId, lifecycle.assertCurrent);\n    default: throw new Error(\"BROWSER_FILE_GRANT_INVALID\");\n  }\n};\nclass BoundMedia {\npublic async executeRegisteredCommand(command: BrowserGovernedCommand, target: ExtensionExactTarget,\n    mutationClass: RegisteredExtensionCommand[\"mutationClass\"], exactCallIdentityHash: `sha256:${string}`,\n    assertCommandActive: () => void, commandDeadlineAt: number, permit: BrowserCommandPermit): Promise<unknown> {\n    const ack = command.kind === \"dom-intent\" && command.intent.kind === \"acknowledgeKnownGptRateLimit\";\n    const transient = command.kind === \"wait\" ? command.transientDomConfirmationStage : undefined;\n    return this.debuggerRuntime.withLogicalPageAccess(ack ? async () => undefined : transient === undefined ? () => this.pageAccessGate.enter()\n      : () => this.pageAccessGate.awaitTransientDomConfirmationStage(transient),\n      () => this.executeRegisteredCommandCycle(command, target, mutationClass, exactCallIdentityHash, assertCommandActive, commandDeadlineAt, permit),\n      ack ? \"rate-limit-ack\" : \"ordinary\");\n  }\nprivate async executeRegisteredCommandCycle(command: BrowserGovernedCommand, target: ExtensionExactTarget,\n    mutationClass: RegisteredExtensionCommand[\"mutationClass\"], exactCallIdentityHash: `sha256:${string}`,\n    assertCommandActive: () => void, deadlineAt: number, permit: BrowserCommandPermit): Promise<unknown> {\n    const execute = async (assertReadback: () => void = assertCommandActive): Promise<unknown> => {\n      const assertCurrent = (): void => { assertReadback(); if (deadlineAt !== undefined && Date.now() >= deadlineAt) throw new Error(\"BROWSER_COMMAND_PERMIT_EXPIRED\"); };\n      assertCommandActive();\n      if (!(command.kind === \"dom-intent\" && [\"acknowledgeKnownGptRateLimit\", \"readKnownGptRateLimitClearance\"].includes(command.intent.kind))) {\n        const preflight = await observeKnownGptRateLimitDialog(this.debuggerRuntime, target, exactCallIdentityHash, assertCurrent); assertCommandActive();\n        if (preflight.state === \"exact_present\") return knownGptRateLimitBlockerReceipt(preflight);\n        if (preflight.state === \"mismatch\") return unrecognizedGptDialogReceipt(preflight);\n        return knownGptRateLimitAbsentEnvelope(preflight, await this.executeRegisteredCommandBody(command, target, exactCallIdentityHash, assertCurrent, deadlineAt));\n      }\n      return this.executeRegisteredCommandBody(command, target, exactCallIdentityHash, assertCurrent, deadlineAt);\n    };\n    if (mutationClass === \"mutation\") return this.interactionReadiness.executeMutation(target, execute, assertCommandActive,\n      command.kind === \"dom-intent\" ? command.intent.kind : command.kind, permit);\n    if (mutationClass === \"observation\") return this.interactionReadiness.executeObservation(target, execute, assertCommandActive, permit);\n    return this.debuggerRuntime.withProviderInputGuard(\n      { started: false, physicalInputCount: 0, mutationKind: command.kind },\n      () => { assertCommandActive(); this.targets.resolve(target.targetRef, target.documentRef);\n        if (deadlineAt !== undefined && Date.now() >= deadlineAt) throw new Error(\"BROWSER_COMMAND_PERMIT_EXPIRED\"); },\n      execute);\n  }\nprivate async executeRegisteredCommandBody(command: BrowserGovernedCommand, target: ExtensionExactTarget,\n    exactCallIdentityHash: `sha256:${string}`, assertCommandActive: () => void, deadlineAt?: number): Promise<unknown> {\n    const assertCurrent = (): void => { assertCommandActive(); this.targets.resolve(target.targetRef, target.documentRef); };\n    if (command.kind !== \"dom-intent\") return executeRegisteredExtensionCommand(this.debuggerRuntime, target, command,\n      { assertCurrent, parkTarget: () => this.parkActiveTarget() });\n    if (command.intent.kind === \"selectExactGptConversation\") return this.executeConversationSelection(target,\n      command.intent.canonicalConversationUrl, assertCommandActive, deadlineAt ?? Date.now() + BROWSER_COMMAND_DEFAULT_DEADLINE_MS);\n    const loader = exactAssistantReadLoaderId(command.intent.kind, target, this.activeTarget, this.activeTarget?.loaderId ?? null);\n    if (command.intent.kind === \"readExactAssistantTurn\" && !loader) throw new Error(\"BROWSER_DOCUMENT_INVALID\");\n    const result = await executeRegisteredDomIntent(this.debuggerRuntime, target, command.intent, assertCurrent, loader, deadlineAt, exactCallIdentityHash);\n    assertCurrent(); return result;\n  }\n}");
  return Object.freeze({
    dispatch: astExecutableTree(expected.getVariableDeclarationOrThrow("executeRegisteredExtensionCommand").getVariableStatementOrThrow()),
    methods: Object.freeze(expected.getClassOrThrow("BoundMedia").getMethods().map(method =>
      Object.freeze({ name: method.getName(), tree: astExecutableTree(method) }))),
  });
})();

const authenticatedMediaDispatchIsExact = (authority: RequiredSource, runtime: RequiredSource): boolean => {
  const dispatch = runtime.getVariableDeclaration("executeRegisteredExtensionCommand")?.getVariableStatement();
  const owner = authority.getClass("ExtensionTargetAuthority");
  return dispatch !== undefined && astExecutableTree(dispatch) === authenticatedMediaReference.dispatch
    && authenticatedMediaReference.methods.every(reference => {
      const method = owner?.getMethod(reference.name);
      return method !== undefined && astExecutableTree(method) === reference.tree;
    });
};

const inspectAuthenticatedMediaBoundary = (
  targetAuthority: RequiredSource,
  commandRuntime: RequiredSource,
  authenticatedMediaRuntime: RequiredSource,
  leaseManager: RequiredSource,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const registeredCommandMethod = targetAuthority.getClass("ExtensionTargetAuthority")
    ?.getMethod("executeRegisteredCommand")?.getText() ?? "";
  const commandDispatchText = `${registeredCommandMethod}\n${commandRuntime.getFullText()}`;
  const mediaRuntimeText = authenticatedMediaRuntime.getFullText();
  const leaseMethod = leaseManager.getClass("BrowserTargetLeaseManager")
    ?.getMethod("readAuthenticatedMedia")?.getText() ?? "";
  if (!authenticatedMediaDispatchIsExact(targetAuthority, commandRuntime)) findings.push(createLocalFinding({
    checkId: "browser-authority/authenticated-media-boundary", lawId, filePath: extensionCommandRuntimePath,
    message: "The authenticated media case must return one exact native call through the current guarded authority body.",
  }));
  const requiredBySource = [
    [targetAuthorityPath, mediaRuntimeText, [
      "Runtime.evaluate", "credentials: \"include\"", "crypto.subtle.digest", "bytesBase64",
      "canonicalConversationUrl", "userTurnId", "querySelectorAll(\"img\")",
      "assistantTurnId", "precedingUserTurnId", "currentUrl", "MutationObserver",
      "attributeFilter: [\"src\", \"srcset\"]", "AUTHENTICATED_MEDIA_SOURCE_WAIT_MS = 5_000",
    ]],
    [sourcePaths[5], leaseMethod, ["browser.authenticated-media.v1", "canonicalConversationUrl",
      "userTurnId", "semanticMediaId", "createHash"]],
  ] as const;
  for (const [filePath, text, requiredTokens] of requiredBySource) for (const required of requiredTokens) {
    if (!text.includes(required)) findings.push(createLocalFinding({
      checkId: "browser-authority/authenticated-media-boundary",
      lawId,
      filePath,
      message: `The single authenticated media observation is missing ${required}.`,
    }));
  }
  for (const forbidden of [
    "readExactAssistantTurn", "projectExactAssistantTurn", "img[alt]", "naturalWidth",
    "naturalHeight", "getBoundingClientRect", "getComputedStyle", ".complete",
    "data-message-author-role='assistant'",
  ]) if (mediaRuntimeText.includes(forbidden)) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/authenticated-media-boundary",
      lawId,
      filePath: authenticatedMediaRuntimePath,
      message: `Authenticated media retrieval retains a forbidden second or layout-dependent gate ${forbidden}.`,
    }));
  }
  for (const forbidden of ["resourceUrl", "sourceUrl", "cookie", "token", "selector:"]) {
    if ([mediaRuntimeText, leaseMethod].some((text) => text.includes(forbidden))) findings.push(createLocalFinding({
      checkId: "browser-authority/authenticated-media-boundary",
      lawId,
      filePath: targetAuthorityPath,
      message: `Authenticated media retrieval exposes forbidden caller control ${forbidden}.`,
    }));
  }
  for (const forbidden of [
    "visible-download", "captureCompletedDownload", "Browser.setDownloadBehavior",
    "generatedImageViewerLabel", "button[aria-label='保存']",
  ]) if ([mediaRuntimeText, leaseMethod, commandDispatchText]
    .some((text) => text.includes(forbidden))) findings.push(createLocalFinding({
    checkId: "browser-authority/authenticated-media-boundary",
    lawId,
    filePath: targetAuthorityPath,
    message: `Authenticated media observation retains forbidden download mutation ${forbidden}.`,
  }));
};

const inspectEncryptedRecoveryLocator = (
  journal: RequiredSource, journalEvidence: RequiredSource, journalReplay: RequiredSource, locator: RequiredSource,
  findings: InspectorFinding[], lawId: string,
): void => {
  for (const [filePath, source, required] of [
    [sourcePaths[7], journal, "sealProviderRecoveryPayload("],
    [journalEvidencePath, journalEvidence, "unsealProviderRecoveryPayload("],
    [journalReplayPath, journalReplay, "unsealProviderRecoveryPayload("],
    [journalReplayPath, journalReplay, "readSubmittedConversationLocator(envelope"],
    [locatorPath, locator, "requireCanonicalGptConversationUrl(value.canonicalConversationUrl)"],
    [locatorPath, locator, "assertSubmitRecoveryPayload(envelope.terminalPayload, identity)"],
    [locatorPath, locator, "input.assertCurrent()"],
    [locatorPath, locator, "and provider_recovery_payload=?"],
  ] as const) if (!source.getFullText().includes(required)) findings.push(createLocalFinding({
    checkId: "browser-authority/closed-invocation-payload", lawId, filePath,
    message: `The encrypted Provider recovery locator boundary is missing ${required}.`,
  }));
  const reader = journalEvidence.getClass("BrowserMutationEvidence")?.getMethod("readAtomicStepOutcome");
  const locatorReads = reader?.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call =>
    call.getExpression().getText() === "readSubmittedConversationLocator") ?? [];
  const identity = locatorReads[0]?.getArguments()[1];
  if (locatorReads.length !== 1 || locatorReads[0]?.getArguments()[0]?.getText() !== "recovered"
    || !Node.isObjectLiteralExpression(identity)
    || identity.getProperties().map(property => property.getText()).join("|") !==
      "exactCallIdentityHash: input.exactCallIdentityHash|providerEffectIdentityHash: row.logical_mutation_id!") {
    findings.push(createLocalFinding({ checkId: "browser-authority/closed-invocation-payload", lawId,
      filePath: journalEvidencePath, message: "The original atomic readback must decode its own encrypted locator with exact call and effect identities." }));
  }
  const writes = [...locator.getFullText().matchAll(/update\s+browser_mutations\s+set\s+([\s\S]*?)\s+where/giu)];
  if (writes.length !== 1 || writes[0]![1]!.replace(/\s/gu, "") !== "provider_recovery_payload=?") {
    findings.push(createLocalFinding({ checkId: "browser-authority/closed-invocation-payload", lawId,
      filePath: locatorPath, message: "Locator binding must update only the original encrypted payload, leaving every terminal field unchanged." }));
  }
};

const inspectDiagnosticPayloadBoundary = (
  sources: readonly RequiredSource[], findings: InspectorFinding[], lawId: string,
): void => {
  if (sources.some((source) => identifiers(source).has("canonicalConversationUrl"))) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/closed-invocation-payload", lawId,
      filePath: commandDiagnosticPath,
      message: "Browser diagnostics must not retain the decrypted canonical conversation URL.",
    }));
  }
  const text = sources.map((source) => source.getFullText()).join("\n");
  for (const forbidden of ["UnknownError", "JSON.stringify(input.error)",
    "String(input.error)", "error.message"]) {
    if (!text.includes(forbidden)) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/closed-invocation-payload", lawId,
      filePath: commandDiagnosticPath,
      message: `Browser diagnostics retain forbidden unclassified or raw error material ${forbidden}.`,
    }));
  }
};

const inspectClosedInvocationPayloadBoundary = (
  sources: InvocationPayloadSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const { transport, extensionActor, extensionCrypto, journal, journalEvidence, journalReplay, locator, commandLogging,
    commandDiagnostic, frameDiagnostic } = sources;
  const requiredByFile = [
    [sourcePaths[0], transport.getFullText(), [
      "encryptedFrame(active, \"COMMAND\"", "{ permit, command, receiptBindingHash }",
      "encryptBrowserAuthorityFrame", "canonicalBrowserAuthorityPlaintext(body)",
    ]],
    [extensionActorPath, extensionActor.getFullText(), [
      "decrypt(session.serverToClientKey, \"server-to-client\", frame)",
      "readExtensionCommandPayload(payload, frame.deadline)", "this.commandDelivery.mutationSlot = { jobId: permit.jobId, commandId: permit.commandId, receiptBindingHash, fact: null }",
      "executeExtensionCommandReply", "this.sendEncrypted(socket, \"REPLY\"",
    ]],
    [extensionCryptoPath, extensionCrypto.getFullText(), [
      "name: \"AES-GCM\"", "additionalData", "canonicalizeBrowserAuthorityValue(body)",
    ]],
  ] as const;
  for (const [filePath, text, required] of requiredByFile) {
    for (const token of required) {
      if (text.includes(token)) continue;
      findings.push(createLocalFinding({
        checkId: "browser-authority/closed-invocation-payload",
        lawId,
        filePath,
        message: `The sole invocation-time encrypted payload chain is missing ${token}.`,
      }));
    }
  }

  const forbiddenDurableIdentifiers = new Set([
    "approvedText", "resolvedFilePaths", "outerHtml", "semanticText", "pageContent",
    "resourceUrl", "sourceUrl", "cookie", "token", "credentials",
  ]);
  for (const [filePath, source] of [
    [sourcePaths[7], journal],
    [journalEvidencePath, journalEvidence],
    [journalReplayPath, journalReplay],
    [commandLoggingPath, commandLogging],
    [commandDiagnosticPath, commandDiagnostic],
    [frameDiagnosticPath, frameDiagnostic],
  ] as const) {
    const leaked = [...identifiers(source)].find((name) => forbiddenDurableIdentifiers.has(name));
    if (!leaked) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/closed-invocation-payload",
      lawId,
      filePath,
      message: `Browser durable state or diagnostics retain forbidden invocation payload field ${leaked}.`,
    }));
  }
  inspectEncryptedRecoveryLocator(journal, journalEvidence, journalReplay, locator, findings, lawId);
  inspectDiagnosticPayloadBoundary([commandLogging, commandDiagnostic, frameDiagnostic], findings, lawId);
};

const readEncryptedRecoverySources = (context: InspectorContext, findings: InspectorFinding[], lawId: string) => {
  const journal = requireSource(context, findings, lawId, sourcePaths[7]);
  const journalEvidence = requireSource(context, findings, lawId, journalEvidencePath);
  const journalReplay = requireSource(context, findings, lawId, journalReplayPath);
  const locator = requireSource(context, findings, lawId, locatorPath);
  if (!journal || !journalEvidence || !journalReplay || !locator) return null;
  return { journal, journalEvidence, journalReplay, locator };
};

export const inspectOpaqueAuthorityBoundary = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const transport = requireSource(context, findings, lawId, sourcePaths[0]);
  const recovery = readEncryptedRecoverySources(context, findings, lawId);
  const broker = requireSource(context, findings, lawId, sourcePaths[18]);
  const supervisor = requireSource(context, findings, lawId, sourcePaths[3]);
  const targetAuthority = requireSource(context, findings, lawId, targetAuthorityPath);
  const commandRuntime = requireSource(context, findings, lawId, extensionCommandRuntimePath);
  const authenticatedMediaRuntime = requireSource(
    context, findings, lawId, authenticatedMediaRuntimePath,
  );
  const leaseManager = requireSource(context, findings, lawId, sourcePaths[5]);
  const extensionActor = requireSource(context, findings, lawId, extensionActorPath);
  const extensionCrypto = requireSource(context, findings, lawId, extensionCryptoPath);
  const commandLogging = requireSource(context, findings, lawId, commandLoggingPath);
  const commandDiagnostic = requireSource(context, findings, lawId, commandDiagnosticPath);
  const frameDiagnostic = requireSource(context, findings, lawId, frameDiagnosticPath);
  if (!transport || !recovery || !broker || !supervisor || !targetAuthority || !commandRuntime
    || !authenticatedMediaRuntime || !leaseManager || !extensionActor || !extensionCrypto
    || !commandLogging || !commandDiagnostic || !frameDiagnostic) return;
  const { journal, journalEvidence, journalReplay, locator } = recovery;
  requireIdentifiers(broker, ["authorityRefHash", "certificateHash", "channelSessionHash", "artifactRef", "contentHash"], findings, lawId,
    "Public Browser authority and artifact status must expose opaque references and hashes.");
  requireIdentifiers(journal, ["payloadHash", "proofHash", "targetRef", "documentRef"], findings, lawId,
    "Durable Browser proof must retain opaque references and content hashes instead of raw page or filesystem payloads.");
  inspectOpaqueRawFields([
    [sourcePaths[0], transport],
    [sourcePaths[7], journal],
    [journalEvidencePath, journalEvidence],
    [journalReplayPath, journalReplay],
    [sourcePaths[3], supervisor],
  ], findings, lawId);
  inspectAuthenticatedMediaBoundary(targetAuthority, commandRuntime, authenticatedMediaRuntime,
    leaseManager, findings, lawId);
  inspectClosedInvocationPayloadBoundary(
    { transport, extensionActor, extensionCrypto, journal, journalEvidence, journalReplay, locator,
      commandLogging, commandDiagnostic, frameDiagnostic },
    findings, lawId,
  );
};
