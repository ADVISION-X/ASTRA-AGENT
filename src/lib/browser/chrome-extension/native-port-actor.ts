import { admitExtensionCommand } from "./command-registry.js";
import { clearExtensionPermitAuthority, setExtensionPermitAuthority } from "./command-permit-validator.js";
import { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { executeRegisteredDomIntent } from "./dom-intent-runtime.js";
import { ExtensionExactTargetRegistry } from "./exact-target-runtime.js";
import type { ExtensionChromeApi, ExtensionNativePort } from "./extension-runtime-types.js";
import type { BrowserGovernedCommand } from "../exact-target/browser-command-actor.js";
import type { BrowserAuthenticationProof } from "../infrastructure/browser-authority-issuer.js";
import type { BrowserCommandPermit } from "../transport/command-permit.js";

type HostBootstrap = Readonly<{ kind: "host-bootstrap"; controllerToken: string; proof: BrowserAuthenticationProof }>;
type ControllerReady = Readonly<{
  kind: "controller-ready";
  sourceChannelToken: string;
  authority: Readonly<{
    authorityRef: string;
    authorityEpoch: number;
    certificateHash: `sha256:${string}`;
    activationTupleHash: `sha256:${string}`;
    executionBindingHash: `sha256:${string}`;
    commandPermitKey: string;
  }>;
}>;
type ControllerCommand = Readonly<{ kind: "controller-command"; sourceChannelToken: string; permit: BrowserCommandPermit; command: BrowserGovernedCommand }>;

export type ExtensionNativePortActor = Readonly<{
  generation: number;
  start(): void;
  close(reasonCode: string): void;
}>;

export const createExtensionNativePortActor = (chromeApi: ExtensionChromeApi, generation: number): ExtensionNativePortActor => {
  const port = chromeApi.runtime.connectNative("com.grasseye.browser_host");
  const debuggerRuntime = new ExtensionDebuggerRuntime(chromeApi);
  const targets = new ExtensionExactTargetRegistry();
  const sourceChannelToken = globalThis.crypto.randomUUID();
  let closed = false;
  let controllerReady = false;

  const close = (_reasonCode = "BROWSER_HOST_UNAVAILABLE"): void => {
    if (closed) return;
    closed = true;
    clearExtensionPermitAuthority();
    port.disconnect();
  };
  const send = (message: unknown): void => { if (!closed) port.postMessage(message); };
  const onMessage = (value: unknown): void => {
    handleControllerFrame(value, { chromeApi, debuggerRuntime, targets, port, sourceChannelToken, isReady: () => controllerReady, setReady: () => { controllerReady = true; }, send, close }).catch((error: unknown) => {
      const command = parseControllerCommand(value);
      if (command) send({ kind: "extension-reply", sourceChannelToken, replyChannelToken: command.permit.replyChannelToken, sequence: command.permit.sequence, errorCode: browserErrorCode(error) });
      else close(browserErrorCode(error));
    });
  };

  return {
    generation,
    start: () => {
      port.onMessage.addListener(onMessage);
      port.onDisconnect.addListener(() => close("BROWSER_HOST_UNAVAILABLE"));
      chromeApi.action.onClicked.addListener((tab) => {
        if (closed || !Number.isInteger(tab.id)) return;
        const tabId = tab.id;
        if (tabId === undefined) return;
        debuggerRuntime.attach(tabId)
          .then(() => {
            const target = targets.claimOperatorTarget(tabId);
            const claim = targets.describeOperatorClaim(target, tab);
            send({ kind: "operator-target-claimed", sourceChannelToken, claim });
          })
          .catch(() => close("BROWSER_DEVTOOLS_CONFLICT"));
      });
      chromeApi.debugger.onDetach.addListener((target) => {
        targets.invalidateTab(target.tabId);
        close("BROWSER_DEVTOOLS_CONFLICT");
      });
    },
    close,
  };
};

type ActorContext = Readonly<{
  chromeApi: ExtensionChromeApi;
  debuggerRuntime: ExtensionDebuggerRuntime;
  targets: ExtensionExactTargetRegistry;
  port: ExtensionNativePort;
  sourceChannelToken: string;
  isReady(): boolean;
  setReady(): void;
  send(message: unknown): void;
  close(reasonCode: string): void;
}>;

const handleControllerFrame = async (value: unknown, context: ActorContext): Promise<void> => {
  const bootstrap = parseBootstrap(value);
  if (bootstrap) {
    context.send({ kind: "extension-hello", controllerToken: bootstrap.controllerToken, sourceChannelToken: context.sourceChannelToken, proof: bootstrap.proof });
    return;
  }
  const ready = parseControllerReady(value);
  if (ready) {
    if (ready.sourceChannelToken !== context.sourceChannelToken) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    setExtensionPermitAuthority(ready.authority);
    context.setReady();
    return;
  }
  const command = parseControllerCommand(value);
  if (!command || !context.isReady() || command.sourceChannelToken !== context.sourceChannelToken) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  await admitExtensionCommand({ kind: command.command.kind, permit: command.permit });
  const target = context.targets.resolve(command.permit.targetRef, command.permit.documentRef);
  const result = await executeCommand(context, target, command.command);
  context.send({ kind: "extension-reply", sourceChannelToken: context.sourceChannelToken, replyChannelToken: command.permit.replyChannelToken, sequence: command.permit.sequence, result });
};

const executeCommand = async (context: ActorContext, target: ReturnType<ExtensionExactTargetRegistry["resolve"]>, command: BrowserGovernedCommand): Promise<unknown> => {
  if (command.kind === "navigate") {
    const url = new URL(command.url);
    if (url.protocol !== "https:") throw new Error("BROWSER_ORIGIN_REJECTED");
    await context.debuggerRuntime.send(target.tabId, "Page.navigate", { url: command.url });
    const next = context.targets.advanceDocument(target.targetRef);
    return {
      documentRef: next.documentRef,
      targetRef: next.targetRef,
      navigationEpoch: next.navigationEpoch,
    };
  }
  if (command.kind === "dom-intent") return executeRegisteredDomIntent(context.debuggerRuntime, target, command.intent);
  if (command.kind === "observe") {
    const root = await context.debuggerRuntime.send(target.tabId, "DOM.getDocument", { depth: 1, pierce: true });
    return { capabilityId: command.capabilityId, root };
  }
  if (command.kind === "wait") {
    if (!Number.isInteger(command.durationMs) || command.durationMs < 0 || command.durationMs > 30_000) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, command.durationMs));
    return { waitedMs: command.durationMs };
  }
  if (command.kind === "close-target") {
    context.targets.remove(target.targetRef);
    await context.debuggerRuntime.detach(target.tabId);
    return { closed: true };
  }
  if (command.kind === "file-input") throw new Error("BROWSER_FILE_GRANT_INVALID");
  if (command.kind === "screenshot") throw new Error("BROWSER_CAPABILITY_REJECTED");
  throw new Error("BROWSER_CAPABILITY_REJECTED");
};

const parseBootstrap = (value: unknown): HostBootstrap | null => isRecord(value) && value.kind === "host-bootstrap" && typeof value.controllerToken === "string" && isRecord(value.proof) ? value as unknown as HostBootstrap : null;
const parseControllerReady = (value: unknown): ControllerReady | null => {
  if (!isRecord(value) || value.kind !== "controller-ready" || typeof value.sourceChannelToken !== "string" || !isRecord(value.authority)) return null;
  const authority = value.authority;
  if (
    typeof authority.authorityRef !== "string"
    || typeof authority.authorityEpoch !== "number"
    || typeof authority.certificateHash !== "string"
    || typeof authority.activationTupleHash !== "string"
    || typeof authority.executionBindingHash !== "string"
    || typeof authority.commandPermitKey !== "string"
  ) return null;
  return value as unknown as ControllerReady;
};
const parseControllerCommand = (value: unknown): ControllerCommand | null => isRecord(value) && value.kind === "controller-command" && typeof value.sourceChannelToken === "string" && isRecord(value.permit) && isRecord(value.command) ? value as unknown as ControllerCommand : null;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const browserErrorCode = (error: unknown): string => error instanceof Error && /^BROWSER_[A-Z_]+$/u.test(error.message) ? error.message : "BROWSER_HOST_UNAVAILABLE";
