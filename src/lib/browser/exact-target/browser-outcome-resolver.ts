export type BrowserOutcomeResolutionReceipt = Readonly<{
  schemaVersion: "grasseye.browser.outcome-resolution.v1";
  ownerPluginId: string;
  commandId: string;
  outcome: "TERMINAL_SUCCESS" | "TERMINAL_FAILURE";
  mutationOutcome: "dispatched";
  positiveEvidenceRef: string;
  negativeEvidenceRef: string;
  uniqueTargetRef: string;
  boundedAt: string;
}>;

/** The owning plugin may submit fresh read-only facts; Browser alone validates and settles its WAL. */
export const assertOwningPluginReconciliationEvidence = (
  receipt: BrowserOutcomeResolutionReceipt,
  ownerPluginId: string,
): void => {
  if (receipt.schemaVersion !== "grasseye.browser.outcome-resolution.v1"
    || receipt.ownerPluginId !== ownerPluginId
    || receipt.commandId.length === 0
    || receipt.mutationOutcome !== "dispatched"
    || receipt.positiveEvidenceRef.length === 0
    || receipt.negativeEvidenceRef.length === 0
    || receipt.positiveEvidenceRef === receipt.negativeEvidenceRef
    || receipt.uniqueTargetRef.length === 0
    || Number.isNaN(Date.parse(receipt.boundedAt))) {
    throw new Error("BROWSER_RECONCILIATION_RECEIPT_INVALID");
  }
};
