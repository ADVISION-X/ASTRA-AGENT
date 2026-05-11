/**
 * browser-open-port.ts — Port boundary for opening URLs in a governed browser.
 *
 * Open calls this port. Open does not implement browser logic.
 * The port implementation lives in lib/browser or lib/local-runtime.
 */

// ─── Port Types ─────────────────────────────────────────────────────────────

export interface BrowserOpenResult {
  ok: boolean;
  currentUrl?: string;
  currentTitle?: string;
  browserSessionRef?: string;
  navigationStartedAt?: string;
  navigationEndedAt?: string;
  failureMessage?: string;
}

export interface RawBrowserOpenObservation {
  currentUrl?: string;
  currentTitle?: string;
  browserSessionRef?: string;
  navigationStartedAt?: string;
  navigationEndedAt?: string;
  rawRuntimeSignals?: Record<string, unknown>;
}

/**
 * BrowserOpenPort — the only port Open is allowed to call for browser actions.
 *
 * Open may NOT call click, scroll, type, screenshot, or AI ports.
 */
export interface BrowserOpenPort {
  openUrl(input: { url: string; timeoutMs?: number }): Promise<BrowserOpenResult>;
  readRawObservation?(): Promise<RawBrowserOpenObservation>;
}

/**
 * WorkbenchOpenPort — port for opening the local workbench entry.
 */
export interface WorkbenchOpenPort {
  openWorkbench(input: { url: string; timeoutMs?: number }): Promise<BrowserOpenResult>;
}
