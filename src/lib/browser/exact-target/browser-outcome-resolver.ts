export type BrowserOutcomeResolutionReceipt = Readonly<{
  schemaVersion: "grasseye.browser.outcome-resolution.v1";
  ownerPluginId: string;
  commandId: string;
  outcome: "TERMINAL_SUCCESS" | "TERMINAL_FAILURE";
  positiveEvidenceRef: string;
  negativeEvidenceRef: string;
  uniqueTargetRef: string;
  boundedAt: string;
}>;

/** Only an owning plugin may resolve UNKNOWN; transport cannot replay it. */
export const assertPluginOutcomeResolution = (
  receipt: BrowserOutcomeResolutionReceipt,
  ownerPluginId: string,
): void => {
  if (receipt.schemaVersion !== "grasseye.browser.outcome-resolution.v1"
    || receipt.ownerPluginId !== ownerPluginId
    || receipt.commandId.length === 0
    || receipt.positiveEvidenceRef.length === 0
    || receipt.negativeEvidenceRef.length === 0
    || receipt.uniqueTargetRef.length === 0
    || Number.isNaN(Date.parse(receipt.boundedAt))) {
    throw new Error("BROWSER_OUTCOME_UNKNOWN");
  }
};
