import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";

import { astExecutableTree, astIdentifierName } from "../../shared/ast-node-identity.js";
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
const transportReplyBindingsAreExact = (channel: SourceFile): boolean => {
  const owner = channel.getClass("BrowserAuthorityWebSocket");
  const project = new Project({ useInMemoryFileSystem: true });
  const expected = project.createSourceFile("transport.ts", "class BoundTransport {\npublic receive(socket: BrowserAuthoritySocket, encoded: string): void {\n    if (this.closed) { socket.close(1000); return; }\n    try {\n      const frame = decodeBrowserAuthorityFrame(encoded);\n      if (Date.parse(frame.deadline) <= Date.now()) throw new Error(\"BROWSER_AUTH_TRANSCRIPT_INVALID\");\n      if (frame.kind === \"PAIR_HELLO\") this.acceptHello(socket, frame);\n      else if (frame.kind === \"PAIR_PROOF\") this.acceptProof(socket, frame);\n      else this.receiveAuthenticated(socket, frame);\n    } catch (error) { this.revoke(socket, error instanceof Error ? error.message : \"BROWSER_AUTH_TRANSCRIPT_INVALID\", error); }\n  }\npublic async send(permit: BrowserCommandPermit, command: BrowserGovernedCommand,\n    onDispatched?: () => void, receiptBindingHash: `sha256:${string}` | null = null): Promise<BrowserCommandReply> {\n    if ((permit.mutationClass === \"mutation\") !== (receiptBindingHash !== null)) throw new Error(\"BROWSER_COMMAND_PERMIT_INVALID\");\n    this.assertLive();\n    const active = this.active!;\n    const sequence = active.nextServerSequence;\n    const budget = Math.min(BROWSER_COMMAND_DEFAULT_DEADLINE_MS, permit.commandTtlMs);\n    const frame = this.encryptedFrame(active, \"COMMAND\", sequence, new Date(Date.now() + budget).toISOString(), { permit, command, receiptBindingHash });\n    return new Promise<BrowserCommandReply>((resolve, reject) => {\n      const timeout = setTimeout(() => {\n        this.removeReply(sequence);\n        try { this.revoke(active.socket, \"BROWSER_COMMAND_RECEIPT_MISSING\"); }\n        catch (cause) { reject(new Error(\"BROWSER_COMMAND_RECEIPT_MISSING\", { cause })); return; }\n        reject(new Error(\"BROWSER_COMMAND_RECEIPT_MISSING\"));\n      }, budget + (permit.mutationClass === \"mutation\" ? MUTATION_TERMINAL_REPLY_GRACE_MS : 0));\n      const replies = new Map(active.replies);\n      replies.set(sequence, { permit, command, receiptBindingHash, targetRef: permit.targetRef,\n        replyChannelToken: permit.replyChannelToken, permitSequence: permit.sequence, diagnostic: null, resolve, reject, timeout });\n      this.active = { ...active, replies, nextServerSequence: sequence + 1 };\n      try { onDispatched?.(); active.socket.send(encodeBrowserAuthorityFrame(frame)); }\n      catch (error) {\n        const code = error instanceof Error && /^(?:BROWSER|RUNTIME_LOG)_[A-Z_]+$/u.test(error.message)\n          ? error.message : \"BROWSER_EXTENSION_CHANNEL_UNAVAILABLE\";\n        this.removeReply(sequence);\n        try { this.revoke(active.socket, code); }\n        catch (failure) { reject(new Error(code, { cause: new AggregateError([error, failure]) })); return; }\n        reject(new Error(code, { cause: error }));\n      }\n    });\n  }\nprivate receiveAuthenticated(socket: BrowserAuthoritySocket, frame: BrowserAuthorityFrame): void {\n    const active = this.active;\n    if (!active || active.socket !== socket || frame.epoch !== AUTH_EPOCH || frame.sequence <= active.lastClientSequence\n      || [\"PAIR_CHALLENGE\", \"AUTHENTICATED\"].includes(frame.kind)) throw new Error(\"BROWSER_AUTH_TRANSCRIPT_INVALID\");\n    const body = parseCanonicalPlaintext(decryptBrowserAuthorityFrame({ key: active.keys.clientToServer, direction: \"client-to-server\",\n      epoch: frame.epoch, sequence: frame.sequence, aad: aadForFrame(frame), encrypted: encryptedFrameBody(frame) }));\n    this.active = { ...active, lastClientSequence: frame.sequence, lastHeartbeatAt: Date.now() };\n    if (!this.acceptAuthenticatedControl(socket, frame, body)) this.acceptReply(socket, body);\n  }\nprivate acceptReply(socket: BrowserAuthoritySocket, body: Record<string, unknown>): void {\n    const active = this.active, sequence = integerField(body, \"requestSequence\", 1), reply = active?.replies.get(sequence);\n    if (!active || active.socket !== socket || !reply) throw new Error(\"BROWSER_AUTH_TRANSCRIPT_INVALID\");\n    const parsed = parseBrowserCommandReply(body, reply.permit, reply.command, reply.receiptBindingHash);\n    if (parsed.fact) this.settleMutationReceipt(socket, parsed.fact);\n    this.removeReply(sequence);\n    if (parsed.errorCode !== null) reply.reject(new BrowserCommandTerminalReplyError(parsed.errorCode,\n      reply.replyChannelToken, sequence, reply.permitSequence,\n      reply.diagnostic?.reasonCode === parsed.errorCode ? reply.diagnostic.commandStage : null));\n    else reply.resolve({ replyChannelToken: reply.replyChannelToken, transportSequence: sequence,\n      permitSequence: reply.permitSequence, result: body.result, mutationReceipt: parsed.fact });\n  }\nprivate settleMutationReceipt(socket: BrowserAuthoritySocket, fact: BrowserMutationTerminalFact): void {\n    const keys = this.active?.keys;\n    this.options.onMutationReceipt(fact, () => {\n      if (!keys || this.active?.socket !== socket || this.active.keys !== keys) throw new Error(\"BROWSER_LIVENESS_EXPIRED\");\n      this.sendControlFrame(socket, \"MUTATION_RECEIPT\", { type: \"ack\", commandId: fact.commandId,\n        receiptBindingHash: fact.receiptBindingHash, receiptHash: fact.receiptHash });\n    });\n  }\n}").getClassOrThrow("BoundTransport");
  return expected.getMethods().every(reference => {
    const actual = owner?.getMethod(reference.getName());
    return actual !== undefined && astExecutableTree(actual) === astExecutableTree(reference);
  });
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
  if (actorIdentifiers.has("requestSequence") && actorIdentifiers.has("permitSequence")
    && transportReplyBindingsAreExact(channel)) return;
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
