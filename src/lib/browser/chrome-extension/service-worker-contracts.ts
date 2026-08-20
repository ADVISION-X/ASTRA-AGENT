export interface ChromeTab {
  readonly id?: number;
  readonly windowId?: number;
  readonly url?: string;
  readonly title?: string;
  readonly status?: string;
  readonly active?: boolean;
}

export interface FrameTreeResult {
  readonly frameTree: {
    readonly frame: {
      readonly id: string;
      readonly loaderId: string;
      readonly url: string;
    };
  };
}

export interface RuntimeResult {
  readonly result: { readonly value?: unknown; readonly description?: string };
  readonly exceptionDetails?: unknown;
}
