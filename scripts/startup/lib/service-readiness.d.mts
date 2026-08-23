export function waitForWorkbenchHealth(input: {
  baseUrl: string;
  attempts?: number;
  delayMs?: number;
  expectedSourceFingerprint?: string;
  toFailureReason(error: unknown): string;
  onStarted?(input: { healthUrl: string }): void;
  onPassed?(input: {
    healthUrl: string;
    contentType: string;
    status: "healthy";
    attempt: number;
    durationMs: number;
  }): void;
}): Promise<void>;
