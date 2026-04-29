import type { BrowserSessionSnapshot, OpenBrowserNavigationResult } from "../contract.js";

export interface OpenBrowserPort {
  getSessionSnapshot(): Promise<BrowserSessionSnapshot>;
  open(input: { url: string; title: string | null }): Promise<OpenBrowserNavigationResult>;
}