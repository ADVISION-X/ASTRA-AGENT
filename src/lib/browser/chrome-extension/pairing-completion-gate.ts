type PairingCompletion = Readonly<{
  resolve(): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof globalThis.setTimeout>;
}>;

export class PairingCompletionGate {
  private completion: PairingCompletion | null = null;

  public isActive(): boolean {
    return this.completion !== null;
  }

  public begin(timeoutMs: number, onTimeout: () => void): Promise<void> {
    if (this.completion) throw new Error("BROWSER_PAIRING_IN_PROGRESS");
    return new Promise<void>((resolve, reject) => {
      const timeout = globalThis.setTimeout(onTimeout, timeoutMs);
      this.completion = { resolve, reject, timeout };
    });
  }

  public complete(): void {
    const completion = this.take();
    completion?.resolve();
  }

  public fail(reasonCode: string): void {
    const completion = this.take();
    completion?.reject(new Error(reasonCode));
  }

  private take(): PairingCompletion | null {
    const completion = this.completion;
    if (!completion) return null;
    this.completion = null;
    globalThis.clearTimeout(completion.timeout);
    return completion;
  }
}
