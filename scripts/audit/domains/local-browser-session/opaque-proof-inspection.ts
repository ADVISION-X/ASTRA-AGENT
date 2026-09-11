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
  for (const required of ["command.kind === \"authenticated-media\"", "executeAuthenticatedMedia("]) {
    if (commandDispatchText.includes(required)) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/authenticated-media-boundary",
      lawId,
      filePath: targetAuthorityPath,
      message: `The fixed authenticated media command dispatch is missing ${required}.`,
    }));
  }
  for (const required of [
    "Runtime.evaluate", "credentials: \"include\"", "crypto.subtle.digest", "bytesBase64",
    "gpt-generated-image-main", "assistantTurnId",
  ]) if (!mediaRuntimeText.includes(required)) findings.push(createLocalFinding({
    checkId: "browser-authority/authenticated-media-boundary",
    lawId,
    filePath: targetAuthorityPath,
    message: `The fixed authenticated media observation is missing ${required}.`,
  }));
  for (const required of [
    "browser.authenticated-media.v1", "assistantTurnId", "semanticMediaId", "createHash",
  ]) if (!leaseMethod.includes(required)) findings.push(createLocalFinding({
    checkId: "browser-authority/authenticated-media-boundary",
    lawId,
    filePath: sourcePaths[5],
    message: `The task-owned authenticated media receiver is missing ${required}.`,
  }));
  for (const forbidden of ["resourceUrl", "sourceUrl", "cookie", "token", "selector:"]) {
    if (mediaRuntimeText.includes(forbidden) || leaseMethod.includes(forbidden)) findings.push(createLocalFinding({
      checkId: "browser-authority/authenticated-media-boundary",
      lawId,
      filePath: targetAuthorityPath,
      message: `Authenticated media retrieval exposes forbidden caller control ${forbidden}.`,
    }));
  }
  for (const forbidden of [
    "visible-download", "captureCompletedDownload", "Browser.setDownloadBehavior",
    "generatedImageViewerLabel", "button[aria-label='保存']",
  ]) if (mediaRuntimeText.includes(forbidden) || leaseMethod.includes(forbidden)
    || commandDispatchText.includes(forbidden)) findings.push(createLocalFinding({
    checkId: "browser-authority/authenticated-media-boundary",
    lawId,
    filePath: targetAuthorityPath,
    message: `Authenticated media observation retains forbidden download mutation ${forbidden}.`,
  }));
};

const inspectClosedInvocationPayloadBoundary = (
  sources: InvocationPayloadSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const { transport, extensionActor, extensionCrypto, journal, commandLogging,
    commandDiagnostic, frameDiagnostic } = sources;
  const requiredByFile = [
    [sourcePaths[0], transport.getFullText(), [
      "encryptedFrame(active, \"COMMAND\"", "{ permit, command }",
      "encryptBrowserAuthorityFrame", "canonicalBrowserAuthorityPlaintext(body)",
    ]],
    [extensionActorPath, extensionActor.getFullText(), [
      "decrypt(session.serverToClientKey, \"server-to-client\", frame)",
      "commandFrom(payload.command)", "admitExtensionCommand({ command, permit })",
      "registeredCommand.mutationClass", "this.sendEncrypted(socket, \"REPLY\"",
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
    "canonicalConversationUrl", "resourceUrl", "sourceUrl", "cookie", "token", "credentials",
  ]);
  for (const [filePath, source] of [
    [sourcePaths[7], journal],
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

  const diagnosticText = `${commandDiagnostic.getFullText()}\n${frameDiagnostic.getFullText()}`;
  for (const forbidden of ["UnknownError", "JSON.stringify(input.error)", "String(input.error)", "error.message"]) {
    if (!diagnosticText.includes(forbidden)) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/closed-invocation-payload",
      lawId,
      filePath: commandDiagnosticPath,
      message: `Browser diagnostics retain forbidden unclassified or raw error material ${forbidden}.`,
    }));
  }
};

export const inspectOpaqueAuthorityBoundary = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const transport = requireSource(context, findings, lawId, sourcePaths[0]);
  const journal = requireSource(context, findings, lawId, sourcePaths[7]);
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
  if (!transport || !journal || !broker || !supervisor || !targetAuthority || !commandRuntime
    || !authenticatedMediaRuntime || !leaseManager || !extensionActor || !extensionCrypto
    || !commandLogging || !commandDiagnostic || !frameDiagnostic) return;
  requireIdentifiers(broker, ["authorityRefHash", "certificateHash", "channelSessionHash", "artifactRef", "contentHash"], findings, lawId,
    "Public Browser authority and artifact status must expose opaque references and hashes.");
  requireIdentifiers(journal, ["payloadHash", "proofHash", "targetRef", "documentRef"], findings, lawId,
    "Durable Browser proof must retain opaque references and content hashes instead of raw page or filesystem payloads.");
  inspectOpaqueRawFields([
    [sourcePaths[0], transport],
    [sourcePaths[7], journal],
    [sourcePaths[3], supervisor],
  ], findings, lawId);
  inspectAuthenticatedMediaBoundary(
    targetAuthority, commandRuntime, authenticatedMediaRuntime, leaseManager, findings, lawId,
  );
  inspectClosedInvocationPayloadBoundary(
    { transport, extensionActor, extensionCrypto, journal, commandLogging, commandDiagnostic, frameDiagnostic },
    findings, lawId,
  );
};
