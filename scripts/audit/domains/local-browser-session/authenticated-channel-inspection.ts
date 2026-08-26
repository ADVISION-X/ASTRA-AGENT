import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { createLocalFinding, identifiers, requireIdentifiers, requireSource, sourcePaths, stringLiterals } from "./inspector-support.js";

export const inspectAuthenticatedChannelGuards = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const channel = requireSource(context, findings, lawId, sourcePaths[0]);
  const actor = requireSource(context, findings, lawId, sourcePaths[1]);
  const crypto = requireSource(context, findings, lawId, sourcePaths[20]);
  const heartbeat = requireSource(context, findings, lawId, sourcePaths[22]);
  if (!channel || !actor || !crypto || !heartbeat) return;

  requireIdentifiers(crypto, ["aad", "protocolVersion", "kind", "epoch", "sequence", "deadline"], findings, lawId,
    "Extension AES-GCM AAD must be reconstructed from the five authenticated header fields.");
  requireIdentifiers(channel, ["aadForFrame", "protocolVersion", "kind", "epoch", "sequence", "deadline"], findings, lawId,
    "Workbench AES-GCM AAD must be reconstructed from the same five authenticated header fields.");
  requireIdentifiers(heartbeat, ["startHeartbeat", "sendLivenessPulse", "getPlatformInfo"], findings, lawId,
    "The MV3 heartbeat owner must invoke the Chrome API liveness pulse on the authenticated channel.");
  requireIdentifiers(actor, ["onSocketClosed", "releaseActiveTarget", "close", "reasonCode"], findings, lawId,
    "The MV3 socket owner must release stale debugger state after disconnect and expose every programmatic close reason.");
  requireIdentifiers(actor, ["extensionCommandDiagnostic", "commandStage", "commandKind", "commandIntentKind", "capabilityId"], findings, lawId,
    "Every authenticated command failure must emit a non-fatal redacted diagnostic with command-stage and capability identity.");
  requireIdentifiers(channel, ["commandStage", "commandKind", "commandIntentKind", "capabilityId"], findings, lawId,
    "The Workbench authority socket must retain the redacted authenticated-command diagnostic fields.");
  if (!stringLiterals(actor).includes("HEARTBEAT")) findings.push(createLocalFinding({
    checkId: "browser-authority/terminal-authority", lawId, filePath: sourcePaths[1],
    message: "The MV3 worker must send an authenticated HEARTBEAT liveness frame.",
  }));
};
