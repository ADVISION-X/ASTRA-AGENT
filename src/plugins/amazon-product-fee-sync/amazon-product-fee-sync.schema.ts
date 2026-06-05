import { z } from "zod";

export const AmazonProductFeeSyncRequiredFieldSchema = z.enum(["totalAmazonFee", "fbaFulfillmentFee"]);
export type AmazonProductFeeSyncRequiredField = z.infer<typeof AmazonProductFeeSyncRequiredFieldSchema>;

export const AmazonProductFeeSyncAllRequiredFields = [
  "totalAmazonFee",
  "fbaFulfillmentFee",
] as const;

const containsAllFeeFields = (fields: readonly AmazonProductFeeSyncRequiredField[]): boolean =>
  AmazonProductFeeSyncAllRequiredFields.every((field) => fields.includes(field));

export const AmazonProductFeeSyncItemSchema = z.object({
  sourceKeyType: z.enum(["sku", "asin"]),
  sourceKey: z.string().min(1).max(128),
  sellerSku: z.string().min(1).max(128),
  requiredFields: z.array(AmazonProductFeeSyncRequiredFieldSchema).min(2).max(2),
}).strict().superRefine((item, context) => {
  if (
    item.requiredFields.length !== AmazonProductFeeSyncAllRequiredFields.length
    || !containsAllFeeFields(item.requiredFields)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["requiredFields"],
      message: "Amazon product fee sync must request totalAmazonFee and fbaFulfillmentFee together.",
    });
  }
});

export const AmazonProductFeeSyncInputSchema = z.object({
  site: z.string().min(1).max(120),
  requestId: z.string().min(1).max(160),
  marketplace: z.enum(["amazon.ae", "amazon.sa", "amazon.com", "amazon.co.uk", "amazon.co.jp"]).default("amazon.ae"),
  scope: z.string().min(1).max(80).default("selected-skus"),
  items: z.array(AmazonProductFeeSyncItemSchema).length(1, "Amazon product fee sync task must contain exactly one SKU item; website side owns the SKU queue."),
}).strict();

export type AmazonProductFeeSyncInput = z.infer<typeof AmazonProductFeeSyncInputSchema>;

export type AmazonProductFeeSyncTaskStatus =
  | "queued"
  | "running"
  | "success"
  | "partial_success"
  | "review_required"
  | "login_required"
  | "captcha_or_2fa_required"
  | "failed";

export type AmazonProductFeeSyncItemStatus =
  | "matched"
  | "not_found"
  | "ambiguous"
  | "blocked"
  | "parse_failed";

export type AmazonProductFeeSyncDiagnostic = {
  readonly authGate: "none" | "login_required" | "captcha_or_2fa_required" | "review_required";
  readonly detectedState: string;
  readonly diagnosticStage: string;
  readonly pageTitle: string | null;
  readonly pageUrlPath: string | null;
};

export type AmazonProductFeeMoneyEvidence = {
  readonly amount: string | null;
  readonly currency: string | null;
  readonly sourceLabel: string;
  readonly rawText: string | null;
  readonly status: "visible" | "not_visible" | "parse_failed";
};

export type AmazonProductFeeResidualEvidence = {
  readonly amount: string | null;
  readonly currency: string | null;
  readonly status: "derived_total_minus_fba_not_referral" | "not_derived_missing_inputs" | "currency_mismatch";
};

export type AmazonProductReferralFeeEvidence = {
  readonly amount: string | null;
  readonly currency: string | null;
  readonly status: "not_visible_in_current_dom" | "visible";
};

export type AmazonProductFeeSyncResultItem = {
  readonly sellerSku: string;
  readonly sourceKeyType: "sku" | "asin";
  readonly sourceKey: string;
  readonly requestedFields: readonly AmazonProductFeeSyncRequiredField[];
  readonly missingRequestedFields: readonly AmazonProductFeeSyncRequiredField[];
  readonly status: AmazonProductFeeSyncItemStatus;
  readonly totalAmazonFee: AmazonProductFeeMoneyEvidence;
  readonly fbaFulfillmentFee: AmazonProductFeeMoneyEvidence;
  readonly amazonNonFulfillmentFeeResidual: AmazonProductFeeResidualEvidence;
  readonly referralFee: AmazonProductReferralFeeEvidence;
  readonly snapshotAt: string;
  readonly rowEvidenceRef: string | null;
  readonly feeEvidenceRef: string | null;
  readonly reason: string | null;
  readonly diagnostic?: AmazonProductFeeSyncDiagnostic;
};

export type AmazonProductFeeSyncTaskRecord = {
  readonly taskId: string;
  readonly site: string;
  readonly requestId: string;
  readonly marketplace: AmazonProductFeeSyncInput["marketplace"];
  readonly ok: boolean;
  readonly status: AmazonProductFeeSyncTaskStatus;
  readonly reason: string | null;
  readonly reachedStep: string;
  readonly items: readonly AmazonProductFeeSyncResultItem[];
  readonly createdAt: string;
  readonly updatedAt: string;
};
