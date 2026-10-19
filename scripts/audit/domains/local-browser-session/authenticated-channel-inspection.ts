import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { createLocalFinding, requireIdentifiers, requireSource, sourcePaths, stringLiterals, extensionCommandRuntimePath } from "./inspector-support.js";

export const inspectAuthenticatedChannelGuards = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const channel = requireSource(context, findings, lawId, sourcePaths[0]);
  const actor = requireSource(context, findings, lawId, sourcePaths[1]);
  const crypto = requireSource(context, findings, lawId, sourcePaths[20]);
  const heartbeat = requireSource(context, findings, lawId, sourcePaths[22]);
  const commandRuntime = requireSource(context, findings, lawId, extensionCommandRuntimePath);
  const diagnostic = requireSource(
    context, findings, lawId, "src/lib/browser/transport/browser-authority-diagnostic.ts",
  );
  if (!channel || !actor || !crypto || !heartbeat || !diagnostic || !commandRuntime) return;

  requireIdentifiers(crypto, ["aad", "protocolVersion", "kind", "epoch", "sequence", "deadline"], findings, lawId,
    "Extension AES-GCM AAD must be reconstructed from the five authenticated header fields.");
  requireIdentifiers(channel, ["aadForFrame", "protocolVersion", "kind", "epoch", "sequence", "deadline"], findings, lawId,
    "Workbench AES-GCM AAD must be reconstructed from the same five authenticated header fields.");
  requireIdentifiers(heartbeat, ["startHeartbeat", "sendLivenessPulse", "getPlatformInfo"], findings, lawId,
    "The MV3 heartbeat owner must invoke the Chrome API liveness pulse on the authenticated channel.");
  requireIdentifiers(actor, ["onSocketClosed", "releaseActiveTarget", "close", "reasonCode"], findings, lawId,
    "The MV3 socket owner must release stale debugger state after disconnect and expose every programmatic close reason.");
  requireIdentifiers(commandRuntime, ["extensionCommandDiagnostic", "commandStage", "commandKind", "commandIntentKind", "capabilityId"], findings, lawId,
    "Every authenticated command failure must emit a non-fatal redacted diagnostic with command-stage and capability identity.");
  requireIdentifiers(diagnostic, ["commandStage", "commandKind", "commandIntentKind", "capabilityId"], findings, lawId,
    "The Workbench authority socket must retain the redacted authenticated-command diagnostic fields.");
  const producer = requireSource(context, findings, lawId, "src/lib/browser/chrome-extension/websocket-command-diagnostic.ts");
  if (producer) requireIdentifiers(producer, ["BrowserDiagnosticCommandStage", "BROWSER_DIAGNOSTIC_COMMAND_INTENT_KINDS"],
    findings, lawId, "The command producer must consume the parser's unique closed stage and intent sources.");
  requireIdentifiers(commandRuntime, ["FixedDocumentReadFailure", "BrowserDiagnosticCommandStage"], findings, lawId,
    "Registered-command refinement must use the fixed Document reader's typed failure.");
  if (!commandRuntime.getFullText().includes('stage === "registered-command" && error instanceof FixedDocumentReadFailure')) {
    findings.push(createLocalFinding({ checkId: "browser-authority/terminal-authority", lawId,
      filePath: extensionCommandRuntimePath, message: "Only a typed fixed-read failure may refine registered-command." }));
  }
  if (!stringLiterals(actor).includes("HEARTBEAT")) findings.push(createLocalFinding({
    checkId: "browser-authority/terminal-authority", lawId, filePath: sourcePaths[1],
    message: "The MV3 worker must send an authenticated HEARTBEAT liveness frame.",
  }));
};
