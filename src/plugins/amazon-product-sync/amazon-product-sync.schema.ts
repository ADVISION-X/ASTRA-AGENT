import { z } from "zod";

export const AmazonProductSyncRequiredFieldSchema = z.enum(["mainImage", "asin", "availableInventory", "actualInventory"]);
export type AmazonProductSyncRequiredField = z.infer<typeof AmazonProductSyncRequiredFieldSchema>;

export const AmazonProductSyncAllRequiredFields = [
  "mainImage",
  "asin",
  "availableInventory",
  "actualInventory",
] as const;

const containsAllProductUpdateFields = (fields: readonly AmazonProductSyncRequiredField[]): boolean =>
  AmazonProductSyncAllRequiredFields.every((field) => fields.includes(field));

export const AmazonProductSyncItemSchema = z.object({
  sourceKeyType: z.enum(["sku", "asin"]),
  sourceKey: z.string().min(1).max(128),
  sellerSku: z.string().min(1).max(128),
  requiredFields: z.array(AmazonProductSyncRequiredFieldSchema).min(1).max(4),
  mainImageUpload: z.object({
    endpoint: z.string().url(),
    token: z.string().min(1),
  }).strict().optional(),
}).strict().superRefine((item, context) => {
  if (
    item.requiredFields.length !== AmazonProductSyncAllRequiredFields.length
    || !containsAllProductUpdateFields(item.requiredFields)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["requiredFields"],
      message: "Amazon product update must request mainImage, asin, availableInventory, and actualInventory.",
    });
  }
});

export const AmazonProductSyncInputSchema = z.object({
  site: z.string().min(1).max(120),
  requestId: z.string().min(1).max(160),
  marketplace: z.enum(["amazon.ae", "amazon.sa", "amazon.com", "amazon.co.uk", "amazon.co.jp"]).default("amazon.ae"),
  scope: z.string().min(1).max(80).default("selected-skus"),
  closeAmazonTabOnCompletion: z.boolean().default(false),
  items: z.array(AmazonProductSyncItemSchema).length(1, "Amazon product sync task must contain exactly one SKU item; website side owns the SKU queue."),
}).strict();

export type AmazonProductSyncInput = z.infer<typeof AmazonProductSyncInputSchema>;

export type AmazonProductSyncTaskStatus =
  | "queued"
  | "running"
  | "success"
  | "partial_success"
  | "review_required"
  | "login_required"
  | "captcha_or_2fa_required"
  | "failed";

export type AmazonProductSyncItemStatus =
  | "matched"
  | "not_found"
  | "ambiguous"
  | "blocked"
  | "parse_failed"
  | "skipped";

export type AmazonProductSyncItemDiagnostic = {
  readonly authGate: "none" | "login_required" | "captcha_or_2fa_required" | "review_required";
  readonly detectedState: string;
  readonly diagnosticStage: string;
  readonly pageTitle: string | null;
  readonly pageUrlPath: string | null;
};

export type AmazonProductSyncMainImageUploadResult = {
  readonly status: "uploaded" | "failed" | "not_configured" | "not_found";
  readonly imageUrl: string | null;
  readonly mediaId: string | null;
  readonly imageSha256: string | null;
  readonly reason: string | null;
};

export type AmazonProductSyncResultItem = {
  readonly sellerSku: string;
  readonly sourceKeyType: "sku" | "asin";
  readonly sourceKey: string;
  readonly requestedFields: readonly AmazonProductSyncRequiredField[];
  readonly missingRequestedFields: readonly AmazonProductSyncRequiredField[];
  readonly status: AmazonProductSyncItemStatus;
  readonly asinSnapshot: string | null;
  readonly sellerCentralTitleSnapshot: string | null;
  readonly sellerCentralMainImageEvidenceRef: string | null;
  readonly mainImageUpload: AmazonProductSyncMainImageUploadResult | null;
  readonly listingStatus: string | null;
  readonly availableFbaUnits: number | null;
  readonly actualInventoryUnits: number | null;
  readonly inboundUnits: number | null;
  readonly unfulfillableUnits: number | null;
  readonly reservedUnits: number | null;
  readonly sales30dSnapshot: number | null;
  readonly snapshotAt: string;
  readonly rowEvidenceRef: string | null;
  readonly reason: string | null;
  readonly diagnostic?: AmazonProductSyncItemDiagnostic;
};

export type AmazonProductSyncTaskRecord = {
  readonly taskId: string;
  readonly site: string;
  readonly requestId: string;
  readonly marketplace: AmazonProductSyncInput["marketplace"];
  readonly ok: boolean;
  readonly status: AmazonProductSyncTaskStatus;
  readonly reason: string | null;
  readonly reachedStep: string;
  readonly items: readonly AmazonProductSyncResultItem[];
  readonly createdAt: string;
  readonly updatedAt: string;
};
