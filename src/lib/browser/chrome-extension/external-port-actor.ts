import { admitExtensionCommand } from "./command-registry.js";
import { clearExtensionPermitAuthority, setExtensionPermitAuthority } from "./command-permit-validator.js";
import { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { executeRegisteredDomIntent } from "./dom-intent-runtime.js";
import { ExtensionExactTargetRegistry } from "./exact-target-runtime.js";
import { readExtensionChromeApi, type ExtensionChromeApi, type ExtensionExternalPort } from "./extension-runtime-types.js";
import type { BrowserGovernedCommand } from "../exact-target/browser-command-actor.js";
import type { BrowserCommandPermit } from "../transport/command-permit.js";

const WORKBENCH_PAGE_PATH = "/";
const WORKBENCH_EXTENSION_CHANNEL_PORT_NAME = "grasseye-browser-authority-v1";

type ControllerReady = Readonly<{ kind: "controller-ready"; sourceChannelToken: string; authority: Readonly<{ authorityRef: string; authorityEpoch: number; certificateHash: `sha256:${string}`; channelSessionHash: `sha256:${string}`; commandPermitKey: string }> }>;
type ControllerCommand = Readonly<{ kind: "controller-command"; sourceChannelToken: string; permit: BrowserCommandPermit; command: BrowserGovernedCommand }>;

export class ExtensionExternalPortActor {
  private readonly debuggerRuntime: ExtensionDebuggerRuntime;
  private readonly targets = new ExtensionExactTargetRegistry();
  private readonly sourceChannelToken = globalThis.crypto.randomUUID();
  private closed = false;
  private grantAccepted = false;
  private authorityReady = false;

  public constructor(private readonly chromeApi: ExtensionChromeApi, private readonly port: ExtensionExternalPort) {
    this.debuggerRuntime = new ExtensionDebuggerRuntime(chromeApi);
  }

  public start(): void {
    this.port.onMessage.addListener((value) => this.handle(value).catch((error: unknown) => this.replyOrRevoke(value, error)));
    this.port.onDisconnect.addListener(() => {
      this.revokeCurrent("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    });
    this.chromeApi.action.onClicked.addListener((tab) => this.claimOperatorTarget(tab));
    this.chromeApi.debugger.onDetach.addListener((target) => {
      this.targets.invalidateTab(target.tabId);
      this.revokeCurrent("BROWSER_DEVTOOLS_CONFLICT");
    });
  }

  private async handle(value: unknown): Promise<void> {
    if (!this.grantAccepted) {
      const pageSessionGrant = parsePageSessionGrant(value);
      assertPageSessionGrant(pageSessionGrant);
      this.grantAccepted = true;
      this.send({ kind: "extension-hello", sourceChannelToken: this.sourceChannelToken, extensionId: this.chromeApi.runtime.id, extensionVersion: this.chromeApi.runtime.getManifest().version });
      return;
    }
    const ready = parseControllerReady(value);
    if (ready) {
      if (ready.sourceChannelToken !== this.sourceChannelToken) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
      setExtensionPermitAuthority(ready.authority);
      this.authorityReady = true;
      return;
    }
    const command = parseControllerCommand(value);
    if (!command || !this.authorityReady || command.sourceChannelToken !== this.sourceChannelToken) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    await admitExtensionCommand({ kind: command.command.kind, permit: command.permit });
    const target = this.targets.resolve(command.permit.targetRef, command.permit.documentRef);
    const result = await this.execute(target, command.command);
    this.send({ kind: "extension-reply", sourceChannelToken: this.sourceChannelToken, replyChannelToken: command.permit.replyChannelToken, sequence: command.permit.sequence, result });
  }

  private claimOperatorTarget(tab: Readonly<{ id?: number; url?: string; title?: string }>): void {
    if (this.closed || !this.authorityReady || !Number.isInteger(tab.id)) return;
    const tabId = tab.id;
    if (tabId === undefined) return;
    this.debuggerRuntime.attach(tabId)
      .then(() => {
        const target = this.targets.claimOperatorTarget(tabId);
        this.send({ kind: "operator-target-claimed", sourceChannelToken: this.sourceChannelToken, claim: this.targets.describeOperatorClaim(target, tab) });
      })
      .catch(() => this.revokeCurrent("BROWSER_DEVTOOLS_CONFLICT"));
  }

  private async execute(target: ReturnType<ExtensionExactTargetRegistry["resolve"]>, command: BrowserGovernedCommand): Promise<unknown> {
    if (command.kind === "navigate") {
      if (new URL(command.url).protocol !== "https:") throw new Error("BROWSER_ORIGIN_REJECTED");
      await this.debuggerRuntime.send(target.tabId, "Page.navigate", { url: command.url });
      const next = this.targets.advanceDocument(target.targetRef);
      return { documentRef: next.documentRef, targetRef: next.targetRef, navigationEpoch: next.navigationEpoch };
    }
    if (command.kind === "dom-intent") return executeRegisteredDomIntent(this.debuggerRuntime, target, command.intent);
    if (command.kind === "observe") return { capabilityId: command.capabilityId, root: await this.debuggerRuntime.send(target.tabId, "DOM.getDocument", { depth: 1, pierce: true }) };
    if (command.kind === "wait") {
      if (!Number.isInteger(command.durationMs) || command.durationMs < 0 || command.durationMs > 30_000) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, command.durationMs));
      return { waitedMs: command.durationMs };
    }
    if (command.kind === "close-target") {
      this.targets.remove(target.targetRef);
      await this.debuggerRuntime.detach(target.tabId);
      return { closed: true };
    }
    if (command.kind === "file-input") throw new Error("BROWSER_FILE_GRANT_INVALID");
    throw new Error("BROWSER_CAPABILITY_REJECTED");
  }

  private replyOrRevoke(value: unknown, error: unknown): void {
    const command = parseControllerCommand(value);
    if (command) {
      this.send({ kind: "extension-reply", sourceChannelToken: this.sourceChannelToken, replyChannelToken: command.permit.replyChannelToken, sequence: command.permit.sequence, errorCode: browserErrorCode(error) });
      return;
    }
    this.revokeCurrent(browserErrorCode(error));
  }

  private send(value: unknown): void {
    if (!this.closed) this.port.postMessage(value);
  }

  private revokeCurrent(_reasonCode: string): void {
    if (this.closed) return;
    this.closed = true;
    this.authorityReady = false;
    clearExtensionPermitAuthority();
    this.port.disconnect();
  }
}

export const assertExactWorkbenchPortSender = (port: ExtensionExternalPort): void => {
  if (port.name !== WORKBENCH_EXTENSION_CHANNEL_PORT_NAME || !port.sender?.url) throw new Error("BROWSER_ORIGIN_REJECTED");
  const senderUrl = new URL(port.sender.url);
  if (senderUrl.protocol !== "http:" || senderUrl.hostname !== "127.0.0.1" || senderUrl.pathname !== WORKBENCH_PAGE_PATH) throw new Error("BROWSER_ORIGIN_REJECTED");
};

export const assertPageSessionGrant = (pageSessionGrant: string): void => {
  if (!/^[A-Za-z0-9_-]{32,}$/u.test(pageSessionGrant)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
};

const chrome = readExtensionChromeApi();
if (chrome) {
  chrome.runtime.onConnectExternal.addListener((port) => {
    try {
      assertExactWorkbenchPortSender(port);
      new ExtensionExternalPortActor(chrome, port).start();
    } catch {
      port.disconnect();
    }
  });
}

const parsePageSessionGrant = (value: unknown): string => {
  if (!isRecord(value) || value.kind !== "workbench-page-open" || typeof value.pageSessionGrant !== "string") throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return value.pageSessionGrant;
};
const isHash = (value: unknown): value is `sha256:${string}` => typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);
const parseControllerReady = (value: unknown): ControllerReady | null => isRecord(value) && value.kind === "controller-ready" && typeof value.sourceChannelToken === "string" && isRecord(value.authority)
  && typeof value.authority.authorityRef === "string" && typeof value.authority.authorityEpoch === "number" && isHash(value.authority.certificateHash) && isHash(value.authority.channelSessionHash) && typeof value.authority.commandPermitKey === "string"
  ? { kind: "controller-ready", sourceChannelToken: value.sourceChannelToken, authority: value.authority as ControllerReady["authority"] } : null;
const parseControllerCommand = (value: unknown): ControllerCommand | null => isRecord(value) && value.kind === "controller-command" && typeof value.sourceChannelToken === "string" && isRecord(value.permit) && isRecord(value.command)
  && typeof value.permit.replyChannelToken === "string" && typeof value.permit.sequence === "number" && typeof value.command.kind === "string"
  ? { kind: "controller-command", sourceChannelToken: value.sourceChannelToken, permit: value.permit as BrowserCommandPermit, command: value.command as BrowserGovernedCommand } : null;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const browserErrorCode = (error: unknown): string => error instanceof Error && /^BROWSER_[A-Z_]+$/u.test(error.message) ? error.message : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE";
