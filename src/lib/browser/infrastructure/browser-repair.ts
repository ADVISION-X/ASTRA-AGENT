export type BrowserRepairResult = Readonly<{ repaired: boolean; reasonCode: string }>;

export const requireFreshBrowserChain = (reasonCode: string): BrowserRepairResult => ({
  repaired: false,
  reasonCode,
});
