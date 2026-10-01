import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import {
  brokerPath,
  createLocalFinding,
  identifiers,
  requireSource,
  sourcePaths,
  stringLiterals,
  targetAuthorityPath,
  extensionCommandRuntimePath,
} from "./inspector-support.js";

const inspectSocketShape = (
  actor: SourceFile,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const socketCreations = actor.getDescendantsOfKind(SyntaxKind.NewExpression)
    .filter((node) => Node.isIdentifier(node.getExpression())
      && astIdentifierName(node.getExpression()) === "WebSocket");
  const socketUrls = stringLiterals(actor)
    .filter((value) => value === "ws://127.0.0.1:4173/browser-authority/v1");
  if (socketCreations.length === 1 && socketUrls.length === 1) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/terminal-authority",
    lawId,
    filePath: sourcePaths[1],
    message: "The fixed extension must contain exactly one WebSocket creation and one exact loopback authority URL.",
  }));
};

const inspectTransportMethods = (
  actor: SourceFile,
  channel: SourceFile,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const actorClass = actor.getClass("ExtensionWebSocketActor");
  const channelClass = channel.getClass("BrowserAuthorityWebSocket");
  const requirements = [
    ["sole extension pairing socket owner", Boolean(actorClass?.getMethod("connectForPairing"))],
    ["disconnect target cleanup", Boolean(actorClass?.getMethod("onSocketClosed"))],
    ["operator pairing-secret reader", Boolean(channelClass?.getMethod("readOperatorPairingSecret"))],
    ["one-time secret rotation", Boolean(channelClass?.getMethod("createPairingSecret"))],
    ["authenticated command sender", Boolean(channelClass?.getMethod("send"))],
  ] as const;
  for (const [label, present] of requirements) {
    if (present) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority",
      lawId,
      filePath: label.includes("extension") ? sourcePaths[1] : sourcePaths[0],
      message: `Browser terminal transport is missing ${label}.`,
    }));
  }
};

const inspectTransportIdentity = (
  actor: SourceFile,
  channel: SourceFile,
  broker: SourceFile,
  commandRuntime: SourceFile,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const brokerIdentifiers = identifiers(broker);
  if (!brokerIdentifiers.has("assertTransportLive") || brokerIdentifiers.has("assertCertificateLive")) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority",
      lawId,
      filePath: brokerPath,
      message: "Execution liveness must use the authenticated WebSocket heartbeat state, never an absolute certificate-age check.",
    }));
  }
  const actorIdentifiers = new Set([...identifiers(actor), ...identifiers(commandRuntime)]);
  const channelIdentifiers = identifiers(channel);
  if (actorIdentifiers.has("requestSequence") && actorIdentifiers.has("permitSequence")
    && channelIdentifiers.has("requestSequence") && channelIdentifiers.has("permitSequence")) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/terminal-authority",
    lawId,
    filePath: sourcePaths[0],
    message: "Authenticated replies must keep transport requestSequence and command permitSequence as separate identities.",
  }));
};

const inspectTargetRefresh = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const targetAuthority = requireSource(context, findings, lawId, targetAuthorityPath);
  if (targetAuthority) {
    const names = identifiers(targetAuthority);
    if (!names.has("advanceDocument") || !names.has("describeOperatorClaim")) findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority",
      lawId,
      filePath: targetAuthorityPath,
      message: "A successful navigation must publish its advanced exact Document through the authenticated target-claim path.",
    }));
  }
  const leaseManager = requireSource(context, findings, lawId, sourcePaths[5]);
  if (leaseManager && !identifiers(leaseManager).has("resolveCurrentTarget")) findings.push(createLocalFinding({
    checkId: "browser-authority/terminal-authority",
    lawId,
    filePath: sourcePaths[5],
    message: "Every queued command must refresh the current exact Document from the sole Broker before signing its permit.",
  }));
};

export const inspectSingleTransport = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const actor = requireSource(context, findings, lawId, sourcePaths[1]);
  const channel = requireSource(context, findings, lawId, sourcePaths[0]);
  const broker = requireSource(context, findings, lawId, brokerPath);
  const commandRuntime = requireSource(context, findings, lawId, extensionCommandRuntimePath);
  if (!actor || !channel || !broker || !commandRuntime) return;
  inspectSocketShape(actor, findings, lawId);
  inspectTransportMethods(actor, channel, findings, lawId);
  inspectTransportIdentity(actor, channel, broker, commandRuntime, findings, lawId);
  inspectTargetRefresh(context, findings, lawId);
};
