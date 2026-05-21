export interface BrowserMediaSourcePort {
  evaluateActiveTab<T>(input: {
    script: string;
    description: string;
    abortSignal?: AbortSignal;
  }): Promise<T>;
}
