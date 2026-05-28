export const AMAZON_TAX_INVOICE_DOWNLOAD_EVIDENCE_STEP_IDS = [
  "AID-01",
  "AID-02",
  "AID-03",
  "AID-04",
  "AID-05",
  "AID-06",
  "AID-07",
  "AID-08",
  "AID-09",
  "AID-10",
  "AID-11",
] as const;

export type AmazonTaxInvoiceDownloadEvidenceStepId =
  (typeof AMAZON_TAX_INVOICE_DOWNLOAD_EVIDENCE_STEP_IDS)[number];
