import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHmac } from "node:crypto";

import { canonicalBrowserExactAssistantTurnRevision } from
  "../../src/lib/browser/exact-target/exact-assistant-turn-revision.js";
import { BrowserMutationStore } from
  "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { serializeTerminalFailure } from
  "../../src/lib/local-runtime/production/terminal-failure.js";
import type { BrowserCommandPermit } from
  "../../src/lib/browser/transport/command-permit.js";
import { BrowserCommandActor, type BrowserGovernedCommand } from
  "../../src/lib/browser/exact-target/browser-command-actor.js";
import { createRuntimeLogger, type RuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { createBrowserActorFactory, createClickCommand, permit } from
  "./local-browser-terminal-fixture.js";
import { permitAuthority, permitExecution } from "./local-browser-terminal-fixture.js";
import { exactHash } from "./local-browser-mutation-store-support.js";
import { exactConversationFixtureUrl } from "./local-browser-dom-runtime-fixture.js";
import { workerFixture } from "./local-browser-auto-pairing-support.js";
import { authenticatedDiagnosticChannel } from "./local-browser-diagnostic-contract-support.js";
import { ExtensionExactTargetRegistry } from "../../src/lib/browser/chrome-extension/exact-target-runtime.js";
import type { ExtensionChromeApi } from "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import type { ExtensionDebuggerRuntime } from "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { BrowserCommandAdmissionBudget } from "../../src/lib/browser/transport/browser-command-admission-budget.js";
import { browserCommandPermitMacPayload } from "../../src/lib/browser/transport/command-permit.js";
import { setExtensionPermitAuthority, clearExtensionPermitAuthority } from "../../src/lib/browser/chrome-extension/command-permit-validator.js";
import { decodeBrowserAuthorityFrame } from "../../src/lib/browser/transport/browser-authority-frame-codec.js";
import { BrowserInfrastructureSupervisor } from "../../src/lib/browser/infrastructure/browser-infrastructure-supervisor.js";
import { rateLimitDetectorCdpResult } from "./local-browser-rate-limit-detector.acceptance-support.js";

type ActorRejectionContext = Readonly<{
  actorRoot: string;
  actorFor: ReturnType<typeof createBrowserActorFactory>;
  actorStore: BrowserMutationStore;
  clickCommand: ReturnType<typeof createClickCommand>;
}>;

const exactAssistantFixture = (observedAt: string) => {
  const exactAssistantPermit: BrowserCommandPermit = {
    ...permit("actor-exact-assistant"), capabilityId: "browser.dom.inspect.v1",
    mutationClass: "observation", replayPolicy: "observation-only",
  };
  const exactAssistantCommand = { kind: "dom-intent" as const, intent: {
    kind: "readExactAssistantTurn" as const,
    turnMarker: "fixture-marker",
    canonicalConversationUrl: new URL("/c/exact-assistant", exactConversationFixtureUrl).href,
  } };
  const rawDomHtml = "<div>answer</div>";
  const semanticText = "answer";
  const exactAssistantReply = {
    schemaVersion: "grasseye.browser.exact-assistant-turn.v4" as const,
    targetRefHash: exactHash(exactAssistantPermit.targetRef),
    documentRefHash: exactHash(exactAssistantPermit.documentRef),
    assistantTurnId: "00000000-0000-4000-8000-000000000002",
    currentUrl: exactAssistantCommand.intent.canonicalConversationUrl,
    precedingUserTurnId: "00000000-0000-4000-8000-000000000001",
    generatingRaw: 0,
    rawDomHtml, rawDomHash: exactHash(rawDomHtml),
    semanticText, semanticTextHash: exactHash(semanticText),
    observedAt,
  };
  const revisionHash = exactHash(canonicalBrowserExactAssistantTurnRevision({ ...exactAssistantReply,
    turnMarkerHash: exactHash(exactAssistantCommand.intent.turnMarker) }));
  return { exactAssistantPermit, exactAssistantCommand, exactAssistantReply, revisionHash };
};

export const exerciseExactAssistantActorBinding = async (
  actorFor: ReturnType<typeof createBrowserActorFactory>,
  observedAt: string,
): Promise<void> => {
  const { exactAssistantPermit, exactAssistantCommand, exactAssistantReply, revisionHash } =
    exactAssistantFixture(observedAt);
  const boundExactAssistant = await actorFor(async (candidate) => ({
    replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
    permitSequence: candidate.sequence,
    result: { ...exactAssistantReply, observationRevisionHash: revisionHash },
  })).execute(exactAssistantPermit, exactAssistantCommand) as Readonly<Record<string, unknown>>;
  assert.match(String(boundExactAssistant.exactCallIdentityHash), /^sha256:[a-f0-9]{64}$/u);
  const wrongUrlExactAssistant = { ...exactAssistantReply,
    currentUrl: new URL("/c/another-conversation", exactAssistantCommand.intent.canonicalConversationUrl).href };
  const wrongUrlRevision = exactHash(canonicalBrowserExactAssistantTurnRevision({
    ...wrongUrlExactAssistant, turnMarkerHash: exactHash(exactAssistantCommand.intent.turnMarker),
  }));
  await assert.rejects(actorFor(async (candidate) => ({
    replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
    permitSequence: candidate.sequence,
    result: { ...wrongUrlExactAssistant, observationRevisionHash: wrongUrlRevision },
  })).execute(exactAssistantPermit, exactAssistantCommand), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  "a hash-consistent answer from another conversation must not bind to the requested URL");
  const negativeExactAssistant = {
    ...exactAssistantReply,
    assistantTurnId: "", precedingUserTurnId: "",
    rawDomHtml: "", rawDomHash: exactHash(""),
    semanticText: "", semanticTextHash: exactHash(""),
    pendingCause: "exact-user-turn-unavailable" as const,
  };
  const negativeRevision = exactHash(canonicalBrowserExactAssistantTurnRevision(
    { ...negativeExactAssistant, turnMarkerHash: exactHash(exactAssistantCommand.intent.turnMarker) },
    negativeExactAssistant.pendingCause,
  ));
  const boundNegative = await actorFor(async (candidate) => ({
    replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
    permitSequence: candidate.sequence,
    result: { ...negativeExactAssistant, observationRevisionHash: negativeRevision },
  })).execute(exactAssistantPermit, exactAssistantCommand) as Readonly<Record<string, unknown>>;
  assert.equal(boundNegative.pendingCause, "exact-user-turn-unavailable");
  assert.match(String(boundNegative.exactCallIdentityHash), /^sha256:[a-f0-9]{64}$/u);
  const tamperedExactAssistantPermit: BrowserCommandPermit = {
    ...exactAssistantPermit,
    ...permitAuthority("actor-exact-assistant-tampered"),
    ...permitExecution("actor-exact-assistant-tampered"),
    capabilityId: "browser.dom.inspect.v1", mutationClass: "observation", replayPolicy: "observation-only",
  };
  await assert.rejects(actorFor(async (candidate) => ({
    replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
    permitSequence: candidate.sequence,
    result: { ...exactAssistantReply,
      targetRefHash: exactHash(tamperedExactAssistantPermit.targetRef),
      documentRefHash: exactHash(tamperedExactAssistantPermit.documentRef),
      semanticText: "tampered but hash-shaped", semanticTextHash: exactHash("tampered but hash-shaped"),
      observationRevisionHash: revisionHash },
  })).execute(tamperedExactAssistantPermit, exactAssistantCommand), /BROWSER_AUTH_TRANSCRIPT_INVALID/u,
  "the Browser actor must reject source/assistant facts not bound into the exact observation revision");
};

const spanEvents = (logger: RuntimeLogger, commandId: string): Readonly<Record<string, unknown>>[] =>
  readFileSync(logger.currentSegmentPath()!, "utf8").trim().split("\n")
    .map((line) => JSON.parse(line) as Readonly<Record<string, unknown>>)
    .filter((event) => event.spanId === `${commandId}:1`);

export const exerciseCheckpointObservationFailures = async (input: Readonly<{
  actorFor: ReturnType<typeof createBrowserActorFactory>;
  actorLogger: RuntimeLogger;
  observationPermit: BrowserCommandPermit;
  observationCommand: BrowserGovernedCommand;
  clickCommand: ReturnType<typeof createClickCommand>;
}>): Promise<void> => {
  const { actorFor, actorLogger, observationPermit, observationCommand, clickCommand } = input;
  for (const pending of [
    { commandId: "actor-text-user-turn-pending", childCapabilityId: "checkpoint_gpt_text_response",
      code: "BROWSER_EXACT_USER_TURN_UNAVAILABLE" },
    { commandId: "actor-text-assistant-pending", childCapabilityId: "checkpoint_gpt_text_response",
      code: "BROWSER_ADJACENT_ASSISTANT_TURN_MISSING" },
    { commandId: "actor-image-checkpoint-pending", childCapabilityId: "checkpoint_gpt_generated_image",
      code: "BROWSER_AUTHENTICATED_MEDIA_IMAGE_SOURCE_ABSENT" },
    { commandId: "actor-image-user-turn-pending", childCapabilityId: "checkpoint_gpt_generated_image",
      code: "BROWSER_AUTHENTICATED_MEDIA_USER_TURN_ABSENT" },
  ] as const) {
    const pendingPermit: BrowserCommandPermit = {
      ...observationPermit, ...permitAuthority(pending.commandId), ...permitExecution(pending.commandId),
      capabilityId: "browser.dom.inspect.v1", mutationClass: "observation", replayPolicy: "observation-only",
      childCapabilityId: pending.childCapabilityId,
    };
    await assert.rejects(actorFor(async () => { throw new Error(pending.code); })
      .execute(pendingPermit, observationCommand), new RegExp(pending.code, "u"));
    const events = spanEvents(actorLogger, pending.commandId);
    assert.equal(events.at(-1)?.outcome, "succeeded",
      "an expected checkpoint absence is a successful observation, while the Child retains timeout ownership");
    assert.equal(events.some((event) => event.kind === "error" || event.outcome === "failed"), false);
  }
  const ordinaryMissingPermit: BrowserCommandPermit = {
    ...observationPermit, ...permitAuthority("actor-ordinary-observation-missing"),
    ...permitExecution("actor-ordinary-observation-missing"), capabilityId: "browser.dom.inspect.v1",
    mutationClass: "observation", replayPolicy: "observation-only",
  };
  await assert.rejects(actorFor(async () => { throw new Error("BROWSER_DOM_CANDIDATE_MISSING"); })
    .execute(ordinaryMissingPermit, observationCommand), /BROWSER_DOM_CANDIDATE_MISSING/u);
  assert.equal(spanEvents(actorLogger, ordinaryMissingPermit.commandId).at(-1)?.outcome, "failed",
    "the checkpoint exception must not soften ordinary Browser observation failures");
  const checkpointMutationPermit: BrowserCommandPermit = {
    ...permit("actor-checkpoint-mutation-missing"), childCapabilityId: "checkpoint_gpt_text_response",
  };
  await assert.rejects(actorFor(async () => { throw new Error("BROWSER_DOM_CANDIDATE_MISSING"); })
    .execute(checkpointMutationPermit, clickCommand), /BROWSER_DOM_CANDIDATE_MISSING/u);
  assert.equal(spanEvents(actorLogger, checkpointMutationPermit.commandId).at(-1)?.outcome, "failed",
    "the checkpoint exception must never soften a Browser mutation failure");
};

const interactionChrome = () => {
  const state = { status: "loading" as "loading" | "complete", inputs: 0, frameUrl: "https://chatgpt.com/", loaderId: "loader-1", failPreflight: false, frameFailure: false };
  const chrome: ExtensionChromeApi = {
    runtime: { id: "interaction-wire", getManifest: () => ({ version: "1.0.0" }), getPlatformInfo: async () => ({}),
      reload: () => undefined, onMessage: { addListener: () => undefined }, onStartup: { addListener: () => undefined } },
    alarms: { create: async () => undefined, onAlarm: { addListener: () => undefined } },
    debugger: { attach: async () => undefined, detach: async () => undefined, getTargets: async () => [],
      onDetach: { addListener: () => undefined }, onEvent: { addListener: () => undefined },
      sendCommand: async (_target, method, parameters) => {
        if (method === "Page.getFrameTree") {
          if (state.frameFailure) throw new Error("BROWSER_DOCUMENT_INVALID");
          return { frameTree: { frame: { id: "frame-1", loaderId: state.loaderId, url: state.frameUrl } } };
        }
        if (method === "Runtime.evaluate") {
          if (state.failPreflight) throw new Error("BROWSER_DOM_SCRIPT_FAILED");
          return rateLimitDetectorCdpResult(parameters, { state: "absent" }, []);
        }
        state.inputs += 1; throw new Error("UNEXPECTED_PAGE_WORK_BEFORE_INTERACTION");
      } },
    tabs: { create: async () => ({ id: 1 }), remove: async () => undefined,
      get: async id => ({ id, active: true, discarded: false, status: state.status, windowId: 1 }),
      update: async id => ({ id, active: true, discarded: false, status: state.status, windowId: 1 }),
      onActivated: { addListener: () => undefined }, onUpdated: { addListener: () => undefined } },
  };
  return { chrome, state };
};

const signInteractionPermit = (candidate: BrowserCommandPermit): BrowserCommandPermit => {
  const { commandFrameMac: _prior, ...unsigned } = candidate;
  return { ...unsigned, commandFrameMac: `sha256:${createHmac("sha256", Buffer.alloc(32, 7))
    .update(browserCommandPermitMacPayload(unsigned)).digest("hex")}` };
};

export const interactionWireFixture = async (root: string,
  input: Parameters<typeof authenticatedDiagnosticChannel>[1] = {}) => {
  const { chrome, state } = interactionChrome(), worker = await workerFixture(chrome);
  const key = Buffer.from(await crypto.subtle.exportKey("raw", worker.session.clientToServerKey));
  const store = new BrowserMutationStore(join(root, "browser")); store.verifyRuntimeTaskProvenance(null);
  const logger = createRuntimeLogger({ producer: "interaction-wire", owner: "browser-session", component: "exact-target",
    terminalEnabled: false, fileSink: { directoryPath: join(root, "logs") } });
  const supervisor = Object.create(BrowserInfrastructureSupervisor.prototype) as BrowserInfrastructureSupervisor;
  Object.assign(supervisor, { state: { started: true, mutationState: store }, options: { runtimeLogger: logger },
    lane: { notifyMutationSettled: () => undefined } });
  const channel = authenticatedDiagnosticChannel((fact, acknowledge) => {
    Reflect.get(supervisor, "settleMutationTerminal").call(supervisor, fact, acknowledge);
  }, { ...input, key });
  const delivery = Reflect.get(worker.actor, "commandDelivery");
  const sendServer = channel.socket.send, sendWorker = worker.socket.send.bind(worker.socket);
  const network = { holdAck: false, acks: [] as string[], failure: null as unknown,
    intercept: null as ((frame: string) => boolean) | null, disconnected: false, dropReply: false, generation: 1 };
  const deliverServer = (frame: string): void => {
    const generation = network.generation;
    setImmediate(() => {
      if (network.disconnected || generation !== network.generation) return;
      delivery.receiveTail = delivery.receiveTail.then(() => worker.invoke("onMessage", worker.socket, frame));
      void delivery.receiveTail.catch((error: unknown) => { network.failure = error; });
    });
  };
  channel.socket.send = frame => {
    sendServer(frame);
    if (network.intercept?.(frame)) return;
    if (network.holdAck && decodeBrowserAuthorityFrame(frame).kind === "MUTATION_RECEIPT") network.acks.push(frame);
    else deliverServer(frame);
  };
  Reflect.set(worker.socket, "send", (frame: string) => {
    const generation = network.generation;
    sendWorker(frame);
    if (network.dropReply && decodeBrowserAuthorityFrame(frame).kind === "REPLY") {
      network.disconnected = true; setImmediate(() => channel.channel.disconnect(channel.socket));
    }
    setImmediate(() => { if (!network.disconnected && generation === network.generation) channel.receiveEncoded(frame); });
  });
  const actor = new BrowserCommandActor(new BrowserCommandAdmissionBudget(), {
    send: (candidate, ...args) => {
      setExtensionPermitAuthority({ authorityRef: candidate.authorityRef, authorityEpoch: candidate.authorityEpoch,
        certificateHash: candidate.certificateHash, channelSessionHash: candidate.channelSessionHash,
        commandPermitKey: Buffer.alloc(32, 7).toString("base64") });
      return channel.channel.send(candidate, ...args);
    },
  }, store, { assertCurrentAuthority: () => undefined }, logger);
  const bindTarget = (candidate: Pick<BrowserCommandPermit, "jobId" | "targetRef" | "documentRef">) => {
    const registry = Reflect.get(worker.authority, "targets") as ExtensionExactTargetRegistry;
    const target = { targetRef: candidate.targetRef, documentRef: candidate.documentRef, tabId: 1,
      chromeTargetId: "chrome-1", navigationEpoch: 0, jobRefHash: exactHash(candidate.jobId), loaderId: "loader-1" };
    registry.invalidateTab(1); registry.restore(target); Reflect.set(worker.authority, "activeTarget", target);
    (Reflect.get(worker.authority, "debuggerRuntime") as ExtensionDebuggerRuntime).adoptAttached(1); return target;
  };
  const idle = async (): Promise<void> => {
    for (let turn = 0; turn < 200; turn += 1) {
      await new Promise<void>(resolve => setImmediate(resolve));
      if (worker.delivery.pendingCommandHandlers.size === 0 && worker.delivery.mutationSlot === null) break;
    }
    await delivery.receiveTail; assert.equal(network.failure, null);
  };
  return { worker, channel, actor, store, supervisor, state, bindTarget, idle, network,
    releaseAcks: () => { network.holdAck = false; for (const frame of network.acks.splice(0)) deliverServer(frame); },
    close: () => { network.disconnected = true; channel.channel.close("ACCEPTANCE_COMPLETE"); clearExtensionPermitAuthority(); store.close(); } };
};

const interactionCommands: readonly [BrowserCommandPermit["capabilityId"], BrowserGovernedCommand][] = [
  ["browser.dom.click.v1", createClickCommand()],
  ["browser.dom.hover.v1", { kind: "dom-intent", intent: { kind: "hover", selector: "button", postHoverAttribute: { name: "aria-expanded", equals: "true" } } }],
  ["browser.dom.double-click.v1", { kind: "dom-intent", intent: { kind: "doubleClick", selector: "button", postDoubleClickMatch: { selector: "button", expectedMatches: 1 } } }],
  ["browser.dom.keypress.v1", { kind: "dom-intent", intent: { kind: "keypress", selector: "button", key: "Enter", postKeypressMatch: { selector: "button", expectedMatches: 1 } } }],
  ["browser.dom.fill.v1", { kind: "dom-intent", intent: { kind: "fill", selector: "textarea", approvedText: "", clearBeforeType: true } }],
  ["browser.dom.click.v1", { kind: "dom-intent", intent: { kind: "acknowledgeKnownGptRateLimit", targetRefHash: exactHash("target-1"), documentRefHash: exactHash("document-1"), dispatchNotAfter: null } }],
  ["browser.file-input.v1", { kind: "file-input", selector: "input[type=file]", activation: { selector: "button", scope: { selector: "form" }, expectedText: "Upload" }, approvedFiles: [], resolvedFilePaths: [] }],
];

const exerciseNotInteractiveRejection = async ({ actorRoot }: ActorRejectionContext): Promise<void> => {
  const cases = interactionCommands.map(([capabilityId, command]) => ({ capabilityId, command, mode: "loading" }));
  for (const mode of ["origin", "document"]) cases.push({ capabilityId: "browser.dom.click.v1", command: createClickCommand(), mode });
  for (const [index, { capabilityId, command, mode }] of cases.entries()) {
    const f = await interactionWireFixture(join(actorRoot, "real-interaction-" + index));
    const candidate = signInteractionPermit({ ...permit("real-interaction-" + index), capabilityId });
    f.bindTarget(candidate);
    if (mode !== "loading") f.state.status = "complete";
    if (mode === "origin") f.state.frameUrl = "https://example.invalid/";
    if (mode === "document") f.state.loaderId = "another-document";
    try {
      await assert.rejects(f.actor.execute(candidate, command), (error: unknown) => {
        assert.match(String(error), /BROWSER_TARGET_NOT_INTERACTIVE/u);
        assert.equal(serializeTerminalFailure(error).cause?.code, mode === "origin" ? "BROWSER_ORIGIN_REJECTED"
          : mode === "document" ? "BROWSER_DOCUMENT_INVALID" : "BROWSER_TARGET_INVALID"); return true;
      });
      await f.idle();
      const row = f.store.readCommand(candidate.commandId)!;
      assert.equal(row.state, "REJECTED"); assert.equal(f.actor.mutationOutcome(candidate.commandId), "no");
      assert.equal(f.state.inputs, 0); assert.equal(f.worker.delivery.pendingCommandHandlers.size, 0);
      assert.equal(f.worker.delivery.mutationSlot, null); assert.deepEqual(f.channel.revocations, []);
      assert.equal(f.channel.closes(), 0); assert.equal(f.worker.closes(), 0);
      const replies = f.worker.frames.map(decodeBrowserAuthorityFrame).filter(frame => frame.kind === "REPLY");
      assert.equal(replies.length, 1); assert.ok(f.store.authorityHash(candidate.commandId));
    } finally { f.close(); }
  }
  await exerciseInteractionRedelivery(actorRoot);
};

const reconnectInteractionWire = async (f: Awaited<ReturnType<typeof interactionWireFixture>>): Promise<void> => {
  await f.worker.invoke("onSocketClosed", f.worker.socket);
  assert.equal(f.worker.delivery.pendingCommandHandlers.size, 0);
  // Rebinding the fake socket must not deliver packets queued on the retired transport.
  f.network.generation += 1;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const bytes = Buffer.from(await crypto.subtle.exportKey("raw", key));
  Object.assign(f.worker.connection, { socket: f.worker.socket, state: "CONNECTED", commandReady: true, lastServerSequence: 0,
    session: { ...f.worker.session, clientToServerKey: key, serverToClientKey: key, nextClientSequence: 2 } });
  f.worker.delivery.commandAdmissionSuspended = false;
  Reflect.set(f.channel.channel, "active", { socket: f.channel.socket, keys: { clientToServer: bytes, serverToClient: bytes },
    lastClientSequence: 1, nextServerSequence: 2, lastHeartbeatAt: Date.now(), replies: new Map() });
  f.network.disconnected = false; f.network.dropReply = false;
};

const exerciseInteractionRedelivery = async (root: string): Promise<void> => {
  for (const mode of ["lost-ack", "lost-reply"] as const) {
    const f = await interactionWireFixture(join(root, mode)), candidate = signInteractionPermit(permit("interaction-" + mode));
    f.bindTarget(candidate); f.network.holdAck = mode === "lost-ack"; f.network.dropReply = mode === "lost-reply";
    try {
      await assert.rejects(f.actor.execute(candidate, createClickCommand()));
      const original = f.worker.delivery.mutationSlot?.fact; assert.ok(original);
      if (mode === "lost-ack") {
        await f.worker.invoke("flushMutationReceipt"); await f.idle(); assert.ok(f.network.acks.length > 0);
        assert.equal(f.worker.delivery.mutationSlot?.fact, original); f.releaseAcks();
      } else {
        assert.equal(f.store.readCommand(candidate.commandId)?.state, "DISPATCHED");
        await reconnectInteractionWire(f); await f.worker.invoke("flushMutationReceipt");
      }
      await f.idle(); assert.equal(f.worker.delivery.mutationSlot, null);
      assert.equal(f.store.readCommand(candidate.commandId)?.state, "REJECTED");
      assert.equal(f.store.readMutationOutcome(candidate.commandId), "no"); assert.equal(f.state.inputs, 0);
      const database = Reflect.get(f.store, "database") as import("better-sqlite3").Database;
      assert.equal(database.prepare("select proof_hash from browser_mutations where command_id=?").pluck().get(candidate.commandId),
        (original as { receiptHash: string }).receiptHash);
      assert.equal(f.channel.sent.filter(value => decodeBrowserAuthorityFrame(value).kind === "COMMAND").length, 1);
      assert.deepEqual(f.channel.revocations, mode === "lost-reply" ? ["BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"] : []);
      const next = signInteractionPermit({ ...permit("after-" + mode), capabilityId: "browser.wait.v1",
        mutationClass: "observation", replayPolicy: "observation-only", sequence: 2 });
      f.state.status = "complete"; f.bindTarget(next);
      await f.actor.execute(next, { kind: "wait", durationMs: 1 }); await f.idle();
      assert.equal(f.state.inputs, 0); assert.equal(f.channel.closes(), 0); assert.equal(f.worker.closes(), 0);
    } finally { f.close(); }
  }
};

const exerciseFillReadbackRejection = async (
  { actorFor, actorStore }: ActorRejectionContext,
): Promise<void> => {
  const fillReadbackPermit: BrowserCommandPermit = {
    ...permit("actor-fill-readback-rejected"), capabilityId: "browser.dom.fill.v1",
    childCapabilityId: "prepare_clean_gpt_chat",
  };
  const fillCommand = { kind: "dom-intent" as const, intent: {
    kind: "fill" as const, selector: "form[data-chatgpt-composer] [data-composer-markdown][contenteditable='true'][role='textbox']", approvedText: "",
    clearBeforeType: true, expectedMatches: 1,
  } };
  const fillReadbackActor = actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: {
        filled: true, candidateCount: 0, identityRevalidated: false,
        mutationCount: 1, retainedValueVerified: false, postconditionVerified: false,
        failureCode: "BROWSER_POSTCONDITION_FAILED", nativeCauseCode: "BROWSER_DOM_CANDIDATE_MISSING",
      } };
  });
  let fillReadbackError: unknown = null;
  try { await fillReadbackActor.execute(fillReadbackPermit, fillCommand); }
  catch (error) { fillReadbackError = error; }
  assert.match(String(fillReadbackError), /BROWSER_POSTCONDITION_FAILED/u);
  assert.equal(serializeTerminalFailure(fillReadbackError).cause?.code, "BROWSER_DOM_CANDIDATE_MISSING");
  assert.equal(serializeTerminalFailure(new Error("RESULT_SETTLED_UNUSABLE", {
    cause: new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID"),
  })).cause?.code, "AGENT_RESULT_SCHEMA_VERSION_INVALID");
  assert.equal(actorStore.readCommand(fillReadbackPermit.commandId)?.state ?? null, "REJECTED");
  assert.equal(fillReadbackActor.mutationOutcome(fillReadbackPermit.commandId), "confirmed");
};

const exerciseQualificationRejection = async (
  { actorRoot, actorFor, actorStore, clickCommand }: ActorRejectionContext,
): Promise<void> => {
  const qualificationPermit = permit("actor-qualification-rejected");
  const qualificationActor = actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: { candidateCount: 1, identityRevalidated: false,
        mutationCount: 0, postconditionVerified: false, qualificationRejected: true,
        qualificationStage: "actionability",
        failureCode: "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH", nativeCauseCode: null } };
  });
  await assert.rejects(qualificationActor.execute(qualificationPermit, clickCommand),
    /BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH/u);
  assert.equal(actorStore.readCommand(qualificationPermit.commandId)?.state ?? null, "REJECTED");
  assert.equal(qualificationActor.mutationOutcome(qualificationPermit.commandId), "no");
  const actorDatabase = new Database(join(actorRoot, "browser", "browser-mutations.sqlite"), { readonly: true });
  assert.deepEqual(actorDatabase.prepare(
    "select reason,native_cause_code from browser_mutations where command_id=?",
  ).get(qualificationPermit.commandId), {
    reason: "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH", native_cause_code: null,
  });
  const stagePermit = permit("actor-candidate-missing-stage");
  const stageActor = actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return { replyChannelToken: candidate.replyChannelToken, transportSequence: 1,
      permitSequence: candidate.sequence, result: { candidateCount: 0, identityRevalidated: false,
        mutationCount: 0, postconditionVerified: false, qualificationRejected: true,
        qualificationStage: "candidate-set",
        failureCode: "BROWSER_DOM_CANDIDATE_MISSING", nativeCauseCode: "BROWSER_DOM_SELECTOR_ABSENT" } };
  });
  await assert.rejects(stageActor.execute(stagePermit, clickCommand), /BROWSER_DOM_CANDIDATE_MISSING/u);
  assert.deepEqual(actorDatabase.prepare(
    "select reason,native_cause_code from browser_mutations where command_id=?",
  ).get(stagePermit.commandId), {
    reason: "BROWSER_DOM_CANDIDATE_MISSING", native_cause_code: "BROWSER_DOM_SELECTOR_ABSENT",
  }, "the candidate-set stage must reach the single Browser WAL through markRejected");
  const stored = actorDatabase.prepare(
    "select exact_call_identity_hash from browser_mutations where command_id=?",
  ).get(qualificationPermit.commandId) as { exact_call_identity_hash: `sha256:${string}` };
  actorDatabase.close();
  const identity = { jobId: qualificationPermit.jobId, attemptId: qualificationPermit.attemptId,
    exactCallIdentityHash: stored.exact_call_identity_hash,
    actionOrdinal: qualificationPermit.actionOrdinal };
  const qualificationFact = actorStore.readExactCallMutationFact(identity);
  assert.equal(qualificationFact?.failureCode, "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH");
  assert.equal(qualificationFact?.nativeFailureCode, null);
  const qualificationOutcome = actorStore.readAtomicStepOutcome({ ...identity,
    targetRef: qualificationPermit.targetRef, effectScope: "target_local" });
  assert.equal(qualificationOutcome?.failureCode, "BROWSER_DOM_ACTION_OUTGOING_ATTACHMENT_SET_MISMATCH");
  assert.equal(qualificationOutcome?.nativeFailureCode, null);
};

export const exerciseActorRejections = async (
  actorRoot: string,
  actorFor: ReturnType<typeof createBrowserActorFactory>,
  actorStore: BrowserMutationStore,
  clickCommand: ReturnType<typeof createClickCommand>,
): Promise<void> => {
  const context = { actorRoot, actorFor, actorStore, clickCommand };
  await exerciseNotInteractiveRejection(context);
  await exerciseFillReadbackRejection(context);
  await exerciseQualificationRejection(context);
};
