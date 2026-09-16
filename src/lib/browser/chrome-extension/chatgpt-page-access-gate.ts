import type { TransientDomConfirmationStage } from "../exact-target/browser-target-lease.js";
import { GPT_WEB_ORIGIN } from "../exact-target/browser-site-policy-registry.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { documentState } from "./dom-query-runtime.js";

const CHATGPT_LOGICAL_ACCESS_INTERVAL_MS = 1_500;
const TRANSIENT_DOM_CONFIRMATION_DELAYS_MS = Object.freeze({ 1: 1_500, 2: 3_000 });

export const awaitTransientDomConfirmationStage = async (
  stage: TransientDomConfirmationStage,
): Promise<void> => {
  const durationMs = TRANSIENT_DOM_CONFIRMATION_DELAYS_MS[stage];
  if (durationMs === undefined) throw new Error("BROWSER_CAPABILITY_REJECTED");
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, durationMs));
};

export const readWithTransientDomConfirmation = async <T>(input: Readonly<{
  read(): Promise<Readonly<{ value: T; transient: boolean }>>;
  continuity(): Promise<string>;
}>): Promise<T> => {
  const readBound = async (baseline?: string) => {
    const before = await input.continuity();
    if (baseline !== undefined && before !== baseline) throw new Error("BROWSER_DOCUMENT_INVALID");
    const current = await input.read();
    const after = await input.continuity();
    if (after !== before) throw new Error("BROWSER_DOCUMENT_INVALID");
    return { current, identity: after };
  };
  let { current, identity } = await readBound();
  if (!current.transient) return current.value;
  for (const stage of [1, 2] as const) {
    await awaitTransientDomConfirmationStage(stage);
    ({ current, identity } = await readBound(identity));
    if (!current.transient || stage === 2) return current.value;
  }
  throw new Error("BROWSER_CAPABILITY_REJECTED");
};

export const currentGptPageIdentity = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
): Promise<string> => {
  const url = new URL((await documentState(runtime, tabId)).url);
  if (url.protocol !== "https:" || url.origin !== GPT_WEB_ORIGIN) {
    throw new Error("BROWSER_DOCUMENT_INVALID");
  }
  return `${url.origin}${url.pathname}`;
};

/** One extension-process gate for every authorized ChatGPT logical page access. */
export class ChatGptPageAccessGate {
  private tail: Promise<void> = Promise.resolve();
  private lastAccessStartedAt = performance.now();

  public enter(): Promise<void> {
    const run = async (): Promise<void> => {
      while (true) {
        const remaining = this.lastAccessStartedAt + CHATGPT_LOGICAL_ACCESS_INTERVAL_MS
          - performance.now();
        if (remaining <= 0) break;
        await new Promise<void>((resolve) => globalThis.setTimeout(resolve, Math.ceil(remaining)));
      }
      this.lastAccessStartedAt = performance.now();
    };
    const entered = this.tail.then(run, run);
    this.tail = entered.then(() => undefined, () => undefined);
    return entered;
  }

  public async awaitTransientDomConfirmationStage(
    stage: TransientDomConfirmationStage,
  ): Promise<void> {
    await awaitTransientDomConfirmationStage(stage);
  }
}

export const waitForNextChatGptObservation = async (deadline: number): Promise<boolean> => {
  const remaining = deadline - Date.now();
  if (remaining < CHATGPT_LOGICAL_ACCESS_INTERVAL_MS) return false;
  await new Promise<void>((resolve) => globalThis.setTimeout(
    resolve, CHATGPT_LOGICAL_ACCESS_INTERVAL_MS,
  ));
  return true;
};
