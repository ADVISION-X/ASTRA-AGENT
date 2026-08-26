import type { BrowserAuthorityFrame } from "../transport/browser-authority-frame-codec.js";
import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS } from "../protocol/generated/browser-protocol.generated.js";
import { browserCommandErrorCode, decrypt } from "./websocket-actor-crypto.js";

type TargetClaimCompletion = Readonly<{
  targetRef: string;
  documentRef: string;
  resolve(): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof globalThis.setTimeout>;
}>;

export class TargetClaimAwaiter {
  private completion: TargetClaimCompletion | null = null;

  public begin(input: { targetRef: string; documentRef: string; send(): Promise<void> }): Promise<void> {
    if (this.completion) throw new Error("BROWSER_PAIRING_IN_PROGRESS");
    return new Promise<void>((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => {
        this.fail("BROWSER_AUTHENTICATION_INCOMPLETE");
      }, BROWSER_COMMAND_DEFAULT_DEADLINE_MS);
      this.completion = { ...input, resolve, reject, timeout };
      void input.send().catch((error: unknown) => this.fail(browserCommandErrorCode(error)));
    });
  }

  public accept(body: Record<string, unknown>): void {
    const completion = this.completion;
    if (!completion || body.targetRef !== completion.targetRef || body.documentRef !== completion.documentRef) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    this.completion = null;
    globalThis.clearTimeout(completion.timeout);
    completion.resolve();
  }

  public fail(reasonCode: string): void {
    const completion = this.completion;
    if (!completion) return;
    this.completion = null;
    globalThis.clearTimeout(completion.timeout);
    completion.reject(new Error(reasonCode));
  }
}

export const acceptTargetClaimAcknowledgement = async (input: {
  serverToClientKey: CryptoKey | null;
  claims: TargetClaimAwaiter;
  frame: BrowserAuthorityFrame;
  expectedEpoch: number;
}): Promise<void> => {
  if (!input.serverToClientKey || input.frame.epoch !== input.expectedEpoch) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  const body = await decrypt(input.serverToClientKey, "server-to-client", input.frame);
  input.claims.accept(body);
};
