import { AmazonInvoiceUploadMissionInputSchema } from "../../src/plugins/amazon-invoice-upload/mission.schema.js";
import { runDomAutomationInspector } from "../audit/domains/dom-automation/inspector.js";

const mission = AmazonInvoiceUploadMissionInputSchema.parse({
  missionType: "amazon_invoice_upload",
  marketplace: "AE",
  amazonOrderId: "123-1234567-1234567",
  invoiceNo: "INV-1",
  invoicePdfPath: "/tmp/invoice.pdf",
  sellerCentralEntryUrl: "https://sellercentral.amazon.ae/orders-v3",
  requireHumanFinalSubmit: true,
});

const result = await runDomAutomationInspector({ repoRoot: process.cwd() });
const hasReviewFields = mission.requireHumanFinalSubmit === true
  && result.findings.every((finding) => finding.lawId !== "GRASSEYE-DOM-009-V1");

if (!hasReviewFields) {
  process.stdout.write("[AMAZON-INVOICE-UPLOAD-SMOKE][FAIL] review-required dry-run contract is incomplete\n");
  process.exit(1);
}

process.stdout.write("[AMAZON-INVOICE-UPLOAD-SMOKE][PASS] mission schema and DOM boundary dry-run checks passed\n");
