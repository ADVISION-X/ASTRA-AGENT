const CHATGPT_LOGICAL_ACCESS_INTERVAL_MS = 1_500;

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
}

export const waitForNextChatGptObservation = async (deadline: number): Promise<boolean> => {
  const remaining = deadline - Date.now();
  if (remaining < CHATGPT_LOGICAL_ACCESS_INTERVAL_MS) return false;
  await new Promise<void>((resolve) => globalThis.setTimeout(
    resolve, CHATGPT_LOGICAL_ACCESS_INTERVAL_MS,
  ));
  return true;
};
