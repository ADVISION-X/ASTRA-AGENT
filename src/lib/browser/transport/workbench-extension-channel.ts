import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type { BrowserCommandPort, BrowserCommandReply, BrowserGovernedCommand } from "../exact-target/browser-command-actor.js";
import type { BrowserCommandPermit } from "./command-permit.js";
import type { BrowserAuthenticationProof } from "../infrastructure/browser-authority-issuer.js";

export const WORKBENCH_PAGE_ORIGIN = "http://127.0.0.1";
export const WORKBENCH_PAGE_PATH = "/";
export const WORKBENCH_EXTENSION_CHANNEL_PORT_NAME = "grasseye-browser-authority-v1";

type ControllerReadyFrame = Readonly<{
  kind: "controller-ready";
  sourceChannelToken: string;
  authority: Readonly<{
    authorityRef: string;
    authorityEpoch: number;
    certificateHash: `sha256:${string}`;
    channelSessionHash: `sha256:${string}`;
    commandPermitKey: string;
  }>;
}>;

type ExtensionHelloFrame = Readonly<{
  kind: "extension-hello";
  sourceChannelToken: string;
  extensionId: string;
  extensionVersion: string;
}>;

type ExtensionReplyFrame = Readonly<{
  kind: "extension-reply";
  sourceChannelToken: string;
  replyChannelToken: string;
  sequence: number;
  result?: unknown;
  errorCode?: string;
}>;

export type BrowserOperatorTargetClaim = Readonly<{
  targetRef: string;
  documentRef: string;
  navigationEpoch: number;
  url: string;
  title: string;
}>;

type OperatorTargetClaimFrame = Readonly<{
  kind: "operator-target-claimed";
  sourceChannelToken: string;
  claim: BrowserOperatorTargetClaim;
}>;

type IncomingFrame = ExtensionHelloFrame | ExtensionReplyFrame | OperatorTargetClaimFrame;
type PendingReply = Readonly<{ resolve(reply: BrowserCommandReply): void; reject(error: Error): void }>;

export type WorkbenchExtensionChannelRequest = Readonly<{
  operation: "open" | "inbound" | "next";
  grant?: string;
  frame?: unknown;
}>;

export type WorkbenchExtensionChannelResponse = Readonly<{
  pageSessionGrant?: string;
  extensionId?: string;
  portName?: string;
  frame?: unknown | null;
}>;

export type WorkbenchExtensionChannelOptions = Readonly<{
  authenticate(input: Readonly<{ extensionId: string; extensionVersion: string; pageSessionHash: `sha256:${string}`; sourceChannelToken: string }>): BrowserAuthenticationProof;
  authorityContext(): ControllerReadyFrame["authority"];
  onOperatorTargetClaim(claim: BrowserOperatorTargetClaim): void;
  onDisconnect(reasonCode: string): void;
}>;

type ActivePageSession = {
  grant: string;
  hash: `sha256:${string}`;
  expiresAt: number;
  sourceChannelToken: string | null;
  outbound: unknown[];
  pending: Map<string, PendingReply>;
};

const PAGE_SESSION_TTL_MS = 300_000;
const COMMAND_REPLY_TIMEOUT_MS = 30_000;
const MAX_PENDING_REPLIES = 16;
const MAX_OUTBOUND_FRAMES = 32;

/**
 * The sole controller-side page relay. The three App routes only call this
 * narrow facade; no page code receives a Browser command authority.
 */
export class WorkbenchExtensionChannel implements BrowserCommandPort {
  private session: ActivePageSession | null = null;

  public constructor(private readonly options: WorkbenchExtensionChannelOptions) {}

  public start(): void {
    this.revokeCurrent("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
  }

  public stop(reasonCode = "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"): void {
    this.revokeCurrent(reasonCode);
  }

  public async handle(input: WorkbenchExtensionChannelRequest): Promise<WorkbenchExtensionChannelResponse> {
    if (input.operation === "open") return this.open();
    if (input.operation === "next") return this.next(input.grant);
    return this.inbound(input.grant, input.frame);
  }

  public async send(permit: BrowserCommandPermit, command: BrowserGovernedCommand): Promise<BrowserCommandReply> {
    const session = this.currentSession();
    const sourceChannelToken = session.sourceChannelToken;
    if (!sourceChannelToken) throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    const key = replyKey(permit.replyChannelToken, permit.sequence);
    if (session.pending.has(key)) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    if (session.pending.size >= MAX_PENDING_REPLIES || session.outbound.length >= MAX_OUTBOUND_FRAMES) {
      throw new Error("BROWSER_BACKPRESSURE");
    }
    return new Promise<BrowserCommandReply>((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => {
        if (!session.pending.delete(key)) return;
        reject(new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"));
      }, COMMAND_REPLY_TIMEOUT_MS);
      session.pending.set(key, {
        resolve: (reply) => {
          globalThis.clearTimeout(timeout);
          resolve(reply);
        },
        reject: (error) => {
          globalThis.clearTimeout(timeout);
          reject(error);
        },
      });
      session.outbound.push({ kind: "controller-command", sourceChannelToken, permit, command });
    });
  }

  public revokeCurrent(reasonCode: string): void {
    const session = this.session;
    this.session = null;
    for (const pending of session?.pending.values() ?? []) pending.reject(new Error(reasonCode));
    if (session) this.options.onDisconnect(reasonCode);
  }

  private open(): WorkbenchExtensionChannelResponse {
    const current = this.session;
    if (current && current.expiresAt > Date.now()) {
      if (current.sourceChannelToken) throw new Error("BROWSER_PAGE_SESSION_REBIND_FORBIDDEN");
      return { pageSessionGrant: current.grant, extensionId: "emkmbecadncngofidjgocmifhbonifgm", portName: WORKBENCH_EXTENSION_CHANNEL_PORT_NAME };
    }
    this.revokeCurrent("BROWSER_PAGE_SESSION_EXPIRED");
    const grant = randomBytes(32).toString("base64url");
    this.session = {
      grant,
      hash: hashGrant(grant),
      expiresAt: Date.now() + PAGE_SESSION_TTL_MS,
      sourceChannelToken: null,
      outbound: [],
      pending: new Map(),
    };
    return { pageSessionGrant: grant, extensionId: "emkmbecadncngofidjgocmifhbonifgm", portName: WORKBENCH_EXTENSION_CHANNEL_PORT_NAME };
  }

  private inbound(grant: string | undefined, value: unknown): WorkbenchExtensionChannelResponse {
    const session = this.assertGrant(grant);
    const frame = parseIncomingFrame(value);
    if (frame.kind === "extension-hello") {
      if (session.sourceChannelToken !== null || !isOpaqueToken(frame.sourceChannelToken)) {
        this.revokeCurrent("BROWSER_AUTH_TRANSCRIPT_INVALID");
        throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
      }
      this.options.authenticate({
        extensionId: frame.extensionId,
        extensionVersion: frame.extensionVersion,
        pageSessionHash: session.hash,
        sourceChannelToken: frame.sourceChannelToken,
      });
      session.sourceChannelToken = frame.sourceChannelToken;
      this.enqueue(session, { kind: "controller-ready", sourceChannelToken: frame.sourceChannelToken, authority: this.options.authorityContext() });
      return {};
    }
    if (frame.sourceChannelToken !== session.sourceChannelToken) {
      this.revokeCurrent("BROWSER_AUTH_TRANSCRIPT_INVALID");
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    if (frame.kind === "operator-target-claimed") {
      this.options.onOperatorTargetClaim(frame.claim);
      return {};
    }
    const pending = session.pending.get(replyKey(frame.replyChannelToken, frame.sequence));
    if (!pending) {
      this.revokeCurrent("BROWSER_AUTH_TRANSCRIPT_INVALID");
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    session.pending.delete(replyKey(frame.replyChannelToken, frame.sequence));
    if (frame.errorCode) pending.reject(new Error(frame.errorCode));
    else pending.resolve({ replyChannelToken: frame.replyChannelToken, sequence: frame.sequence, result: frame.result });
    return {};
  }

  private next(grant: string | undefined): WorkbenchExtensionChannelResponse {
    const session = this.assertGrant(grant);
    return { frame: session.outbound.shift() ?? null };
  }

  private currentSession(): ActivePageSession {
    const session = this.session;
    if (!session || session.expiresAt <= Date.now()) {
      this.revokeCurrent("BROWSER_PAGE_SESSION_EXPIRED");
      throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    }
    return session;
  }

  private assertGrant(grant: string | undefined): ActivePageSession {
    const session = this.currentSession();
    if (!grant || !matchesGrant(grant, session.grant)) {
      this.revokeCurrent("BROWSER_AUTH_TRANSCRIPT_INVALID");
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    return session;
  }

  private enqueue(session: ActivePageSession, frame: unknown): void {
    if (session.outbound.length >= MAX_OUTBOUND_FRAMES) {
      this.revokeCurrent("BROWSER_BACKPRESSURE");
      throw new Error("BROWSER_BACKPRESSURE");
    }
    session.outbound.push(frame);
  }
}

const parseIncomingFrame = (value: unknown): IncomingFrame => {
  if (!isRecord(value) || typeof value.kind !== "string" || typeof value.sourceChannelToken !== "string") throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  if (value.kind === "extension-hello" && typeof value.extensionId === "string" && typeof value.extensionVersion === "string") {
    return { kind: "extension-hello", sourceChannelToken: value.sourceChannelToken, extensionId: value.extensionId, extensionVersion: value.extensionVersion };
  }
  if (value.kind === "operator-target-claimed" && isOperatorClaim(value.claim)) {
    return { kind: "operator-target-claimed", sourceChannelToken: value.sourceChannelToken, claim: value.claim };
  }
  if (value.kind === "extension-reply" && typeof value.replyChannelToken === "string" && typeof value.sequence === "number" && (value.errorCode === undefined || typeof value.errorCode === "string")) {
    return { kind: "extension-reply", sourceChannelToken: value.sourceChannelToken, replyChannelToken: value.replyChannelToken, sequence: value.sequence, ...(value.result === undefined ? {} : { result: value.result }), ...(value.errorCode === undefined ? {} : { errorCode: value.errorCode }) };
  }
  throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
};
const isOperatorClaim = (value: unknown): value is BrowserOperatorTargetClaim => isRecord(value)
  && typeof value.targetRef === "string" && typeof value.documentRef === "string" && typeof value.navigationEpoch === "number"
  && typeof value.url === "string" && typeof value.title === "string";
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isOpaqueToken = (value: string): boolean => value.length >= 16 && value.length <= 256;
const replyKey = (token: string, sequence: number): string => `${token}:${sequence}`;
const hashGrant = (value: string): `sha256:${string}` => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const matchesGrant = (candidate: string, expected: string): boolean => {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
};
