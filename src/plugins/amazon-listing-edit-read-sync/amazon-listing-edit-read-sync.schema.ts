import { z } from "zod";

export const AmazonListingEditReadSyncTabSchema = z.enum([
  "product_details",
  "images",
  "variations",
  "offer",
  "safety_and_compliance",
]);

export type AmazonListingEditReadSyncTab = z.infer<typeof AmazonListingEditReadSyncTabSchema>;

export const AmazonListingEditReadSyncAllTabs = [
  "product_details",
  "images",
  "variations",
  "offer",
  "safety_and_compliance",
] as const;

export const AmazonListingEditReadSyncInputSchema = z.object({
  site: z.string().min(1).max(120),
  requestId: z.string().min(1).max(160),
  marketplace: z.enum(["amazon.ae", "amazon.sa", "amazon.com", "amazon.co.uk", "amazon.co.jp"]).default("amazon.ae"),
  safetyMode: z.enum(["inventory-only", "single-sku-search-only", "single-sku-sku-central-only", "single-sku-edit-tabs", "all-inventory-edit-tabs"]).default("inventory-only"),
  scope: z.enum(["visible-inventory-page", "all-inventory-pages"]).default("visible-inventory-page"),
  maxItems: z.number().int().min(1).max(200).default(1),
  productType: z.string().min(1).max(80).optional(),
  stopOnFirstIssue: z.boolean().default(true),
  tabs: z.array(AmazonListingEditReadSyncTabSchema).min(1).max(5).default([...AmazonListingEditReadSyncAllTabs]),
}).strict().superRefine((input, context) => {
  if (input.safetyMode.startsWith("single-sku") && input.maxItems !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxItems"],
      message: "single SKU safety modes require maxItems=1",
    });
  }
  if (input.safetyMode === "all-inventory-edit-tabs" && input.scope !== "all-inventory-pages") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scope"],
      message: "all-inventory-edit-tabs requires scope=all-inventory-pages",
    });
  }
});

export type AmazonListingEditReadSyncInput = z.infer<typeof AmazonListingEditReadSyncInputSchema>;

export type AmazonListingEditReadSyncTaskStatus =
  | "queued"
  | "running"
  | "success"
  | "partial_success"
  | "review_required"
  | "login_required"
  | "captcha_or_2fa_required"
  | "failed";

export type AmazonListingEditReadSyncItemStatus = "matched" | "blocked" | "not_found" | "parse_failed";

export type AmazonListingEditReadSyncPageState =
  | "ready"
  | "login_required"
  | "captcha_or_2fa_required"
  | "review_required";

export type AmazonListingEditReadSyncInventoryItem = {
  readonly asin: string;
  readonly sku: string;
  readonly title: string | null;
  readonly rowKind: "parent" | "child" | "single" | "unknown";
  readonly evidenceRef: string;
};

export type AmazonListingEditReadSyncControl = {
  readonly name: string | null;
  readonly label: string | null;
  readonly value: string | null;
  readonly tagName: string;
  readonly type: string | null;
};

export type AmazonListingEditReadSyncTabRead = {
  readonly tab: AmazonListingEditReadSyncTab;
  readonly status: "read" | "blocked" | "not_available";
  readonly reason: string | null;
  readonly pageUrlPath: string | null;
  readonly pageTitle: string | null;
  readonly headings: readonly string[];
  readonly visibleText: string | null;
  readonly tabLabels: readonly string[];
  readonly controls: readonly AmazonListingEditReadSyncControl[];
  readonly imageUrls: readonly string[];
  readonly saveActionLabels: readonly string[];
  readonly evidenceRef: string | null;
};

export type AmazonListingEditReadSyncItemResult = {
  readonly asin: string;
  readonly sku: string;
  readonly status: AmazonListingEditReadSyncItemStatus;
  readonly reason: string | null;
  readonly fnsku: string | null;
  readonly skuCentralUrlPath: string | null;
  readonly tabs: readonly AmazonListingEditReadSyncTabRead[];
  readonly evidenceRef: string;
};

export type AmazonListingEditReadSyncDiagnostic = {
  readonly authGate: "none" | "login_required" | "captcha_or_2fa_required" | "review_required";
  readonly detectedState: AmazonListingEditReadSyncPageState;
  readonly diagnosticStage: string;
  readonly pageTitle: string | null;
  readonly pageUrlPath: string | null;
};

export type AmazonListingEditReadSyncTaskRecord = {
  readonly taskId: string;
  readonly site: string;
  readonly requestId: string;
  readonly marketplace: AmazonListingEditReadSyncInput["marketplace"];
  readonly ok: boolean;
  readonly status: AmazonListingEditReadSyncTaskStatus;
  readonly reason: string | null;
  readonly reachedStep: string;
  readonly inventoryItems: readonly AmazonListingEditReadSyncInventoryItem[];
  readonly items: readonly AmazonListingEditReadSyncItemResult[];
  readonly diagnostic?: AmazonListingEditReadSyncDiagnostic;
  readonly createdAt: string;
  readonly updatedAt: string;
};
