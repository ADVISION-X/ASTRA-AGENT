import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { ExtensionTargetAuthority } from "../../src/lib/browser/chrome-extension/extension-target-authority.js";
import { ChatGptPageAccessGate } from "../../src/lib/browser/chrome-extension/chatgpt-page-access-gate.js";
import type { ExtensionChromeApi } from "../../src/lib/browser/chrome-extension/extension-runtime-types.js";
import { exerciseAuthenticatedMedia } from "./local-browser-authenticated-media-support.js";
import { exerciseLocalBrowserDomIntent } from "./local-browser-dom-intent-support.js";
import { emitLocalBrowserAutoPairingProofs } from "./local-browser-proof-support.js";
import { browserDomFacts } from "./local-browser-dom-runtime-fixture.js";
import { exerciseAutomaticPairing } from "./local-browser-auto-pairing-support.js";
import { exerciseAuthenticatedTargetIsolation, exerciseAuthorizedContinuation, exerciseClaimBroker, exerciseClosedParkedTabRecovery, exerciseLogicalPageAccessPriority,
  exerciseTargetRotation } from "./local-browser-target-lifecycle-support.js";
import { rateLimitDetectorCdpResult, verifyKnownGptRateLimitDetector } from "./local-browser-rate-limit-detector.acceptance-support.js";
import { verifyRateLimitCommandAdmission } from "./local-browser-rate-limit-command.acceptance-support.js";
import { permit } from "./local-browser-terminal-fixture.js";
import { hashBrowserExtensionText } from "../../src/lib/browser/chrome-extension/websocket-actor-crypto.js";
import { BrowserTargetLeaseManager } from "../../src/lib/browser/exact-target/browser-target-lease-manager.js";
import { BrowserSessionWorkspace } from "../../src/lib/browser/exact-target/browser-session-workspace.js";
import { BrowserAuthorityBroker } from "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "../../src/lib/browser/infrastructure/browser-authority-issuer.js";
import { decodeKnownGptRateLimitPreflightReply } from "../../src/lib/browser/exact-target/browser-special-mutation-receipt.js";
import { browserExactCallIdentityHash } from "../../src/lib/browser/exact-target/browser-command-postcondition.js";
import { parseBrowserAuthorityTargetClaim } from "../../src/lib/browser/transport/browser-authority-frame-payload.js";
import type { BrowserCommandPermit } from "../../src/lib/browser/transport/command-permit.js";
import { binding } from "./browser-lane-fifo-support.js";
import { BROWSER_PROTOCOL_REVISION } from "../../src/lib/browser/protocol/generated/browser-protocol.generated.js";

process.stderr.write("[QUALITY][browser-pairing:start] automatic-pairing\n");
const chrome = await exerciseAutomaticPairing(); await verifyKnownGptRateLimitDetector();
process.stderr.write("[QUALITY][browser-pairing:progress] automatic-pairing-and-detector-complete\n");
await exerciseAuthenticatedTargetIsolation(chrome);
const state = { nextId: 3, activeId: 99, navigationCount: 0, physicalTargetsReads: 0, pointer: false,
  clickDestination: null as string | null,
  frameNavigationDuringNavigate: false, switchBeforeInput: false, switchAfterInput: false,
  switchReadCountdown: 0, switchDuringTargets: null as "away" | "away-back" | null, attachFailure: null as number | null, removeFailure: null as number | null,
  created: null as Readonly<{ active: true; url: string }> | null, pointerResult: { x: 5, y: 5 } as unknown,
  detector: { state: "absent" } as Readonly<Record<string, unknown>>, runtime: null as ((expression: string) => Promise<unknown>) | null };
const attached: number[] = [], detached: number[] = [], activated: number[] = [], removed: number[] = [], inputs: string[] = [], methods: string[] = [], detectorStarts: number[] = [];
const chromeIdentities = new Map<number, string>();
const initialFrames = new Set<number>();
const discarded = new Set<number>(), lostDebugger = new Set<number>(), urls = new Map<number, string>(), loaders = new Map<number, string>();
const frames: { kind: "TARGET_CLAIM" | "TARGET_REVOKE"; body: Record<string, unknown> }[] = [], failures: Record<string, unknown>[] = [], failureOrder: string[] = [];
let receiveClaim = (_kind: "TARGET_CLAIM" | "TARGET_REVOKE", _body: Record<string, unknown>): void => undefined;
let event: Parameters<ExtensionChromeApi["debugger"]["onEvent"]["addListener"]>[0] = () => undefined;
let detach: Parameters<ExtensionChromeApi["debugger"]["onDetach"]["addListener"]>[0] = () => undefined;
let activation: Parameters<ExtensionChromeApi["tabs"]["onActivated"]["addListener"]>[0] = () => undefined;
let update: Parameters<ExtensionChromeApi["tabs"]["onUpdated"]["addListener"]>[0] = () => undefined;
let removal: (id: number) => void = () => undefined;
const switchTab = (id: number): void => { state.activeId = id; activation({ tabId: id, windowId: 1 }); };
const tabUpdated: typeof update = (id, changes, tab) => { update(id, changes, tab); };
const tabValue = (id: number) => ({ active: id === state.activeId, discarded: discarded.has(id), id,
  title: "ChatGPT", windowId: 1 });
const simulateDomReadAndInput = async (tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>): Promise<unknown> => {
      if (method === "Runtime.evaluate" && String(parameters?.expression).includes("known-gpt-rate-limit-preflight.v2"))
        return rateLimitDetectorCdpResult(parameters, state.detector, detectorStarts);
      if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
      if (method === "DOM.resolveNode") return { object: { objectId: "candidate-root" } };
      if (method === "Runtime.callFunctionOn" && state.pointer) {
        if (String(parameters?.functionDeclaration).includes("spec.output")) {
          if (state.switchBeforeInput) { state.switchBeforeInput = false; switchTab(99); }
          return { result: { value: state.pointerResult } };
        }
        return { result: { value: browserDomFacts() } };
      }
      if (method === "Input.dispatchMouseEvent" && state.pointer) {
        inputs.push(String(parameters?.type)); if (state.switchAfterInput) { state.switchAfterInput = false; switchTab(99); }
        if (parameters?.type === "mouseReleased" && state.clickDestination) urls.set(tabId, state.clickDestination); return {};
      }
      if (method === "Runtime.evaluate" && state.runtime) return { result: { value: await state.runtime(String(parameters?.expression)) } };
  return {};
};
const targetChrome: ExtensionChromeApi = { runtime: chrome.runtime, alarms: chrome.alarms,
  debugger: { attach: async ({ tabId }) => { if (state.attachFailure === tabId) throw new Error("DEBUGGER_CONFLICT"); lostDebugger.delete(tabId); attached.push(tabId); },
    detach: async ({ tabId }) => { lostDebugger.add(tabId); detached.push(tabId); },
    getTargets: async () => { state.physicalTargetsReads += 1;
      if (state.switchDuringTargets) { const mode = state.switchDuringTargets, original = state.activeId;
        state.switchDuringTargets = null; switchTab(99); if (mode === "away-back") switchTab(original); }
      return Array.from({ length: state.nextId - 3 }, (_, index) => index + 3)
      .filter(id => !removed.includes(id)).map(id => ({ id: chromeIdentities.get(id) ?? `chrome-target-${id}`, tabId: id, attached: attached.includes(id) && !lostDebugger.has(id),
        title: "ChatGPT", type: "page" as const, url: urls.get(id)! })); },
    sendCommand: async ({ tabId }, method, parameters) => {
      methods.push(method);
      if (method === "Page.getNavigationHistory") return { currentIndex: 0, entries: [{ id: 1, url: urls.get(tabId), title: "ChatGPT" }] };
      if (method === "Page.navigate") {
        state.navigationCount += 1; urls.set(tabId, String(parameters?.url)); loaders.set(tabId, `loader-${tabId}-navigation-${state.navigationCount}`);
        if (state.frameNavigationDuringNavigate) { state.frameNavigationDuringNavigate = false; event({ tabId }, "Page.frameNavigated"); }
        return { loaderId: loaders.get(tabId) };
      }
      if (method === "Page.getFrameTree") return { frameTree: { frame: { id: `frame-${tabId}`, loaderId: loaders.get(tabId) ?? `loader-${tabId}`, url: initialFrames.delete(tabId) ? "about:blank" : urls.get(tabId) } } };
      return simulateDomReadAndInput(tabId, method, parameters);
    }, onDetach: { addListener: callback => { detach = (target, reason) => { lostDebugger.add(target.tabId); callback(target, reason); }; } },
    onEvent: { addListener: callback => { event = callback; } } },
  tabs: { create: async input => { state.created = input; const id = state.nextId++; urls.set(id, input.url); initialFrames.add(id); switchTab(id); return { id }; },
    get: async id => { if (removed.includes(id)) throw new Error("TAB_ABSENT"); if (state.switchReadCountdown > 0 && --state.switchReadCountdown === 0) { switchTab(99); switchTab(id); } return tabValue(id); },
    remove: async id => { if (state.removeFailure === id) { state.removeFailure = null; throw new Error("REMOVE_UNPROVEN"); } removed.push(id); removal(id); },
    update: async id => { activated.push(id); switchTab(id); return tabValue(id); },
    onActivated: { addListener: callback => { activation = callback; } }, onUpdated: { addListener: callback => { update = callback; } },
    onRemoved: { addListener: callback => { removal = callback; } } } };
await exerciseLogicalPageAccessPriority(targetChrome);
process.stderr.write("[QUALITY][browser-pairing:progress] page-access-priority-complete\n");
const authority = new ExtensionTargetAuthority(targetChrome, async (kind, body) => { frames.push({ kind, body }); receiveClaim(kind, body); if (kind === "TARGET_REVOKE") failureOrder.push(kind); },
  failure => { failures.push({ ...failure }); failureOrder.push("DIAGNOSTIC"); }, async () => undefined);
authority.start();
const until = async (condition: () => boolean): Promise<void> => { const deadline = Date.now() + 10_000;
  while (!condition()) { if (Date.now() >= deadline) throw new Error("FIXTURE_CONDITION_TIMEOUT"); await new Promise<void>(resolve => setTimeout(resolve, 1)); } };
const waitForCreatedTab = (id: number) => until(() => state.nextId > id);
const job = `sha256:${"a".repeat(64)}` as const;
const first = authority.acquireJobBoundChatGptTarget("fresh", job, undefined, () => { assert.match(job, /^sha256:[a-f0-9]{64}$/u); }); await waitForCreatedTab(3);
assert.deepEqual(attached, []); assert.deepEqual([...frames], []);
tabUpdated(3, { status: "complete" }, { id: 3, url: "https://chatgpt.com/" }); await first;
assert.deepEqual(attached, [3]); assert.ok(state.physicalTargetsReads > 0); assert.deepEqual(state.created, { active: true, url: "https://chatgpt.com/" });
assert.equal(state.activeId, 3); assert.deepEqual(Object.keys(frames[0]!.body).sort(), ["claimOrigin", "documentRef", "jobRefHash", "navigationEpoch", "targetRef"]);
assert.equal(frames[0]!.body.claimOrigin, "https://chatgpt.com"); const initialClaim = frames[0]!.body;
const targetRef = String(initialClaim.targetRef), documentRef = String(initialClaim.documentRef), target = authority.resolve(targetRef, documentRef);
const execute = async (command: Parameters<ExtensionTargetAuthority["executeRegisteredCommand"]>[0], current = target,
  kind: Parameters<ExtensionTargetAuthority["executeRegisteredCommand"]>[2] = "mutation") => {
  state.clickDestination = command.kind === "dom-intent" && command.intent.kind === "click" ? command.intent.postClickUrl?.equals ?? null : null;
  const child = command.kind === "dom-intent" && ["acknowledgeKnownGptRateLimit", "readKnownGptRateLimitClearance"].includes(command.intent.kind)
    ? "acknowledge_known_gpt_rate_limit" : "open_gpt_model_selector_v3";
  const result = await authority.executeRegisteredCommand(command, current, kind, `sha256:${"e".repeat(64)}`,
    () => { assert.deepEqual(authority.resolve(current.targetRef, current.documentRef), current); }, Date.now() + 30_000,
    { ...permit("direct-interaction"), targetRef: current.targetRef, documentRef: current.documentRef, mutationClass: kind, childCapabilityId: child });
  const row = result as Record<string, unknown>; return row?.schemaVersion === "grasseye.browser.command-preflight.v1" ? row.commandResult : result;
};
const selectionFixture = async () => {
  const execution = binding("a"), hash = execution.executionRefHash;
  const certificate = { schemaVersion: "browser-authority-certificate-v1" as const,
    authorityRef: "authority-1", authorityEpoch: 1, channelSessionHash: hash, artifactSetHash: hash,
    releaseSecurityPolicyHash: hash, profileEnrollmentHash: hash, connectionGeneration: 1,
    extensionId: "reload-fixture", extensionVersion: "1.0.0", protocolRevision: BROWSER_PROTOCOL_REVISION,
    capabilitySetHash: hash, permissionPolicyHash: hash, originPolicyHash: hash, livenessPolicyHash: hash,
    commandAdmissionBudgetHash: hash, artifactStreamBudgetHash: hash, authTranscriptHash: hash,
    keyEpoch: 1, livenessLeaseEpoch: 1, issuedAt: new Date().toISOString(), issuedAtMonotonicNs: "1", issuerMac: hash };
  const issuer = new BrowserAuthorityIssuer();
  Reflect.set(issuer, "slot", { kind: "PRESENT", authority: certificate });
  Reflect.set(issuer, "commandPermitKey", Buffer.alloc(32, 7));
  const workspace = new BrowserSessionWorkspace({ schemaVersion: "grasseye.session-workspace-binding.v6",
    workspaceRef: "reload-workspace", authorityRef: certificate.authorityRef, authorityEpoch: 1,
    connectionGeneration: 1, profileHash: hash, extensionId: certificate.extensionId,
    releaseBuildId: "reload-fixture", directoryHash: hash, sitePolicyHash: hash, establishedAt: certificate.issuedAt });
  const delivered: { candidate: BrowserCommandPermit; command: Parameters<ExtensionTargetAuthority["executeRegisteredCommand"]>[0]; raw: unknown }[] = [];
  const actor = { pendingMutationCommandIds: () => [], awaitPostSubmitQuiet: async () => undefined,
    execute: async (candidate: BrowserCommandPermit, command: Parameters<ExtensionTargetAuthority["executeRegisteredCommand"]>[0]) => {
      const current = authority.resolve(candidate.targetRef, candidate.documentRef);
      const raw = await authority.executeRegisteredCommand(command, current, candidate.mutationClass,
        browserExactCallIdentityHash(candidate), () => { authority.resolve(candidate.targetRef, candidate.documentRef); }, Date.now() + 30_000, candidate);
      delivered.push({ candidate, command, raw });
      return decodeKnownGptRateLimitPreflightReply(candidate, command, raw).commandResult;
    }, mutationOutcome: () => null, browserOutcome: () => null };
  const broker = new BrowserAuthorityBroker(issuer, () => undefined,
    (bound, resolveGrantPaths, current, issueApprovedArtifactGrants) => new BrowserTargetLeaseManager(
      certificate, bound, actor as never, issuer, workspace, current, { resolveGrantPaths, issueApprovedArtifactGrants }));
  receiveClaim = (kind, body) => {
    if (kind === "TARGET_CLAIM") broker.registerOperatorTargetClaim({ authorityEpoch: 1, ...parseBrowserAuthorityTargetClaim(body) });
    else broker.revokeOperatorTargetClaim({ targetRef: String(body.targetRef), jobRefHash: job, documentRef: String(body.documentRef) });
  };
  receiveClaim("TARGET_CLAIM", initialClaim);
  return { lease: await broker.acquireOperatorClaimedTargetLease(execution, "same-url-readback"), delivered };
};
await exerciseAuthenticatedMedia({ authority, targetRef, documentRef, setRuntime: callback => { state.runtime = callback; } }); assert.deepEqual(activated, []);
process.stderr.write("[QUALITY][browser-pairing:progress] authenticated-media-complete\n");
switchTab(99); await execute({ kind: "wait", durationMs: 1 }, target, "observation"); assert.deepEqual(activated, [3]);
const click = { kind: "dom-intent" as const, intent: { kind: "click" as const, selector: "button[data-testid='interaction-ready']", expectedMatches: 1,
  postClickUrl: { equals: "https://chatgpt.com/c/interaction-ready" } } };
state.pointer = true;
await verifyRateLimitCommandAdmission({ executeRegisteredCommand: execute, simpleClick: click, interactionTarget: target, firstTargetRef: targetRef,
  firstDocumentRef: documentRef, providerInputMethods: inputs, rateLimitDetectorStartedAt: detectorStarts,
  setRateLimitDetectorState: value => { state.detector = value; } });
const gate = new ChatGptPageAccessGate(), starts: number[] = [];
for (let index = 0; index < 3; index += 1) { await gate.enter(); starts.push(performance.now()); }
assert.ok(starts.slice(1).every((value, index) => value - starts[index]! >= 1500));
urls.set(3, "https://chatgpt.com/"); switchTab(99); await execute(click); const activationCount = activated.length;
urls.set(3, "https://chatgpt.com/"); await execute(click); assert.equal(activated.length, activationCount);
for (const mode of ["origin", "away-back", "before-input", "discarded"] as const) {
  process.stderr.write(`[QUALITY][browser-interaction:case] ${mode}\n`);
  const before = inputs.length; urls.set(3, mode === "origin" ? "http://127.0.0.1:4174/" : "https://chatgpt.com/");
  if (mode === "away-back") state.switchReadCountdown = 2;
  if (mode === "before-input") state.switchBeforeInput = true;
  if (mode === "discarded") discarded.add(3);
  await assert.rejects(execute(click), (error: unknown) => {
    assert(error instanceof Error); assert.equal(error.message, "BROWSER_TARGET_NOT_INTERACTIVE");
    if (mode === "origin") assert.equal((error.cause as Error).message, "BROWSER_ORIGIN_REJECTED");
    return true;
  }, mode);
  assert.equal(inputs.length, before); discarded.delete(3); switchTab(3);
}
urls.set(3, "https://chatgpt.com/"); state.switchAfterInput = true; const beforeLateSwitch = inputs.length;
await assert.rejects(execute(click), (error: unknown) => {
  assert.match(String(error), /BROWSER_TARGET_NOT_INTERACTIVE/u);
  assert.equal(Reflect.get(error as object, "browserInputStarted"), true);
  assert.equal(Reflect.get(error as object, "browserPhysicalInputCount"), 0); return true;
}); assert.equal(inputs.length, beforeLateSwitch + 1); switchTab(3);
state.pointer = false;
const select = (url: string, current = target) => execute({ kind: "dom-intent", intent: { kind: "selectExactGptConversation", canonicalConversationUrl: url } }, current, "lifecycle") as Promise<Record<string, unknown>>;
urls.set(3, "https://chatgpt.com/c/sidebar-target?messageId=one#tail"); const baselineNavigation = state.navigationCount;
process.stderr.write("[QUALITY][browser-pairing:progress] interaction-rejections-complete\n");
const same = await select("https://chatgpt.com/c/sidebar-target"); assert.equal(same.documentRef, target.documentRef); assert.equal(state.navigationCount, baselineNavigation);
const reload = await selectionFixture(), sameIntent = { kind: "selectExactGptConversation" as const, canonicalConversationUrl: "https://chatgpt.com/c/sidebar-target" };
loaders.set(3, "same-url-new-loader");
await assert.rejects(select(sameIntent.canonicalConversationUrl), /BROWSER_DOCUMENT_INVALID/u);
assert.equal(state.navigationCount, baselineNavigation);
await authority.parkActiveTarget();
await authority.acquireJobBoundChatGptTarget("confirmed-readback", job, sameIntent.canonicalConversationUrl, () => undefined);
const reacquired = frames.at(-1)!.body;
assert.notEqual(reacquired.documentRef, target.documentRef); assert.equal(reacquired.targetRef, targetRef);
await reload.lease.executeDomIntent(sameIntent);
assert.equal(reload.lease.document.documentRef, reacquired.documentRef);
assert.equal(reload.delivered.at(-1)!.candidate.documentRef, reacquired.documentRef);
loaders.set(3, "event-reload-loader"); event({ tabId: 3 }, "Page.frameNavigated", {});
await until(() => frames.at(-1)!.body.documentRef !== reacquired.documentRef);
await reload.lease.executeDomIntent(sameIntent);
const reloaded = reload.lease.document;
assert.notEqual(reloaded.documentRef, reacquired.documentRef); assert.equal(state.navigationCount, baselineNavigation);
assert.equal(reload.delivered.at(-1)!.candidate.documentRef, reloaded.documentRef);
for (const delivered of reload.delivered) assert.throws(() => decodeKnownGptRateLimitPreflightReply(
  { ...delivered.candidate, documentRef: target.documentRef }, delivered.command, delivered.raw), /BROWSER_AUTH_TRANSCRIPT_INVALID/u);
receiveClaim = () => undefined;
const reloadedTarget = authority.resolve(String(reloaded.targetRef), String(reloaded.documentRef)), beforeNavigationClaims = frames.length;
loaders.set(3, "unannounced-document");
await assert.rejects(select("https://chatgpt.com/c/foreign-document", reloadedTarget), /BROWSER_DOCUMENT_INVALID/u);
assert.equal(state.navigationCount, baselineNavigation); assert.equal(frames.length, beforeNavigationClaims);
loaders.set(3, reloadedTarget.loaderId);
chromeIdentities.set(3, "replacement-chrome-target");
await assert.rejects(select("https://chatgpt.com/c/foreign-target", reloadedTarget), /BROWSER_TARGET_INVALID/u);
assert.equal(state.navigationCount, baselineNavigation); assert.equal(frames.length, beforeNavigationClaims);
chromeIdentities.delete(3);
for (const mode of ["away", "away-back"] as const) {
  state.switchDuringTargets = mode;
  await assert.rejects(select("https://chatgpt.com/c/inactive-during-qualification", reloadedTarget), /BROWSER_TARGET_NOT_INTERACTIVE/u);
  assert.equal(state.navigationCount, baselineNavigation); assert.equal(frames.length, beforeNavigationClaims); switchTab(3);
}
state.frameNavigationDuringNavigate = true;
const selecting = select("https://chatgpt.com/c/sidebar-next", reloadedTarget); await until(() => state.navigationCount === baselineNavigation + 1);
tabUpdated(99, { status: "complete" }, { id: 99, url: "https://chatgpt.com/" }); await Promise.resolve(); assert.equal(frames.length, beforeNavigationClaims);
tabUpdated(3, { status: "complete" }, { id: 3, url: urls.get(3)! }); const selected = await selecting;
assert.deepEqual(frames.slice(beforeNavigationClaims).map(frame => frame.kind), ["TARGET_CLAIM"]); assert.notEqual(selected.documentRef, reloadedTarget.documentRef);
const selectedTarget = authority.resolve(String(selected.targetRef), String(selected.documentRef)); await select("https://chatgpt.com/c/sidebar-absent", selectedTarget);
assert.equal(state.navigationCount, baselineNavigation + 2); assert.equal(inputs.length, beforeLateSwitch + 1);
process.stderr.write("[QUALITY][browser-pairing:progress] exact-navigation-rejections-complete\n");
const currentClaim = frames.at(-1)!.body, current = authority.resolve(String(currentClaim.targetRef), String(currentClaim.documentRef));
const removedBefore = removed.length; await authority.retireInvalidCommandTarget({ message: "BROWSER_DOCUMENT_INVALID" },
  { ...permit("unknown-cause"), targetRef: current.targetRef, documentRef: current.documentRef }, "click"); assert.equal(removed.length, removedBefore);
await authority.parkActiveTarget(); assert.equal(frames.at(-1)?.kind, "TARGET_REVOKE"); assert.deepEqual(detached, []);
await authority.acquireJobBoundChatGptTarget("confirmed-readback", job, "https://chatgpt.com/c/sidebar-absent", () => { assert.match(job, /^sha256:[a-f0-9]{64}$/u); }); assert.deepEqual(attached, [3]); assert.equal(state.nextId, 4);
assert.equal(frames.at(-1)?.body.targetRef, targetRef); assert.equal(methods.includes("Page.bringToFront"), false); await authority.releaseActiveTarget(false); assert.deepEqual(detached, []);
await exerciseLocalBrowserDomIntent(); const beforeFresh = state.navigationCount; await authority.acquireJobBoundChatGptTarget("fresh", job, undefined, () => { assert.match(job, /^sha256:[a-f0-9]{64}$/u); });
assert.equal(state.navigationCount, beforeFresh + 1); assert.equal(state.nextId, 4); assert.equal(frames.at(-1)?.body.targetRef, targetRef);
assert.notEqual(frames.at(-1)?.body.documentRef, documentRef);
failureOrder.length = 0; detach({ tabId: 3 }, "target_closed"); await new Promise<void>(resolve => setTimeout(resolve, 0));
assert.deepEqual(failureOrder, ["DIAGNOSTIC", "TARGET_REVOKE"]); assert.equal(failures.at(-1)?.nativeCauseCode, "CHROME_DEBUGGER_TARGET_CLOSED");
const replacement = authority.acquireJobBoundChatGptTarget("confirmed-readback", job, "https://chatgpt.com/c/replacement-readback", () => { assert.match(job, /^sha256:[a-f0-9]{64}$/u); }); await waitForCreatedTab(4);
assert.equal(state.created?.url, "https://chatgpt.com/c/replacement-readback");
tabUpdated(4, { status: "complete" }, { id: 4, url: state.created!.url }); await replacement; assert.equal(frames.at(-1)?.body.targetRef, "target-tab-4");
const replacementClaim = frames.at(-1)!.body; await select("https://chatgpt.com/c/replacement-readback", authority.resolve(String(replacementClaim.targetRef), String(replacementClaim.documentRef)));
assert.equal(state.nextId, 5); assert.equal(state.activeId, 4); detach({ tabId: 4 }, "canceled_by_user"); await new Promise<void>(resolve => setTimeout(resolve, 0));
assert.equal(failures.at(-1)?.reasonCode, "BROWSER_DEVTOOLS_CONFLICT"); assert.equal(failures.at(-1)?.nativeCauseCode, "CHROME_DEBUGGER_CANCELED_BY_USER");
for (const bad of ["origin", "debugger"] as const) {
  const id = state.nextId; if (bad === "debugger") state.attachFailure = id;
  const claimsBefore = frames.filter(frame => frame.kind === "TARGET_CLAIM").length, inputsBefore = inputs.length;
  const attempt = authority.acquireJobBoundChatGptTarget("fresh", job, undefined, () => { assert.match(job, /^sha256:[a-f0-9]{64}$/u); }); await waitForCreatedTab(id);
  if (bad === "origin") urls.set(id, "https://example.com/");
  tabUpdated(id, { status: "complete" }, { id, url: urls.get(id)! });
  await assert.rejects(attempt, new RegExp(bad === "origin" ? "BROWSER_ORIGIN_REJECTED" : "BROWSER_DEVTOOLS_CONFLICT", "u"));
  assert.ok(removed.includes(id)); state.attachFailure = null;
  assert.equal(frames.filter(frame => frame.kind === "TARGET_CLAIM").length, claimsBefore);
  assert.equal(inputs.length, inputsBefore);
}
process.stderr.write("[QUALITY][browser-pairing:progress] target-retirement-rejections-complete\n");
const rotation = await exerciseTargetRotation({ authority, waitForCreatedTab, targetTabUpdated: tabUpdated, targetFrames: frames,
  debuggerMethods: methods, activatedTabs: activated, removedTabs: removed, setRemoveFailureTabId: value => { state.removeFailure = value; } });
process.stderr.write("[QUALITY][browser-pairing:progress] target-rotation-complete\n");
await exerciseAuthorizedContinuation({ authority, nextCreatedTabId: state.nextId, waitForCreatedTab, targetTabUpdated: tabUpdated,
  targetFrames: frames, debuggerMethods: methods, mainFrameUrlByTab: urls, createdUrl: () => state.created?.url });
process.stderr.write("[QUALITY][browser-pairing:progress] authorized-continuation-complete\n");
await exerciseClosedParkedTabRecovery({ authority, readNextCreatedTabId: () => state.nextId, waitForCreatedTab, targetTabUpdated: tabUpdated,
  targetFrames: frames, targetFailures: failures, removedTabs: removed });
process.stderr.write("[QUALITY][browser-pairing:progress] closed-tab-recovery-complete\n");
await exerciseClaimBroker({ hashes: rotation, activatedTabs: activated, removedTabs: removed });

const compareAfterBarrier = async (): Promise<void> => {
  for (const field of ["jobRefHash", "targetRef", "documentRef", "chromeTargetId", "tabId", "absent"] as const) {
    const fixture = Object.create(ExtensionTargetAuthority.prototype) as ExtensionTargetAuthority;
    const targets = Reflect.get(authority, "targets") as import("../../src/lib/browser/chrome-extension/exact-target-runtime.js").ExtensionExactTargetRegistry;
    const original = targets.claimOperatorTarget(100, await hashBrowserExtensionText("job-retire"), "loader", "chrome-original");
    let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; }); let revocations = 0;
    Object.assign(fixture, { targets, activeTarget: original, navigationPublication: null,
      debuggerRuntime: { awaitPageReadPermission: () => barrier }, send: async () => { revocations += 1; } });
    const retiring = fixture.retireInvalidCommandTarget({ errorCode: "BROWSER_ORIGIN_REJECTED" }, { ...permit("retire"), jobId: "job-retire",
      targetRef: original.targetRef, documentRef: original.documentRef }, "click");
    await Promise.resolve(); const current = field === "absent" ? null
      : { ...original, [field]: field === "tabId" ? 101 : field === "jobRefHash" ? `sha256:${"f".repeat(64)}` : "replacement" };
    if (field === "absent") targets.remove(original.targetRef);
    Reflect.set(fixture, "activeTarget", current); release(); await retiring;
    assert.equal(Reflect.get(fixture, "activeTarget"), current); assert.equal(revocations, 0); targets.remove(original.targetRef);
  }
};
await compareAfterBarrier();
process.stderr.write("[QUALITY][browser-pairing:end] claim-broker-and-barrier-complete\n");
emitLocalBrowserAutoPairingProofs(); console.log("automatic pairing and exact Target navigation exercised");
