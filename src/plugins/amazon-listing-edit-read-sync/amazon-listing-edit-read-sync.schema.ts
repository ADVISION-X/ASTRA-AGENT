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

export const AmazonListingEditReadSyncTargetModeSchema = z.enum([
  "inventory",
  "asin",
  "sku",
  "parent",
  "child",
  "all-inventory",
]);

export type AmazonListingEditReadSyncTargetMode = z.infer<typeof AmazonListingEditReadSyncTargetModeSchema>;

export const AmazonListingEditReadSyncTargetSchema = z.object({
  asin: z.string().trim().regex(/^B[0-9A-Z]{9}$/).optional(),
  sku: z.string().trim().min(1).max(128).optional(),
  parentAsin: z.string().trim().regex(/^B[0-9A-Z]{9}$/).optional(),
  parentSku: z.string().trim().min(1).max(128).optional(),
  childAsin: z.string().trim().regex(/^B[0-9A-Z]{9}$/).optional(),
  childSku: z.string().trim().min(1).max(128).optional(),
}).strict();

export type AmazonListingEditReadSyncTarget = z.infer<typeof AmazonListingEditReadSyncTargetSchema>;

const AmazonListingEditReadSyncInputBaseSchema = z.object({
  site: z.string().min(1).max(120),
  requestId: z.string().min(1).max(160),
  marketplace: z.enum(["amazon.ae", "amazon.sa", "amazon.com", "amazon.co.uk", "amazon.co.jp"]).default("amazon.ae"),
  safetyMode: z.enum(["inventory-only", "single-sku-search-only", "single-sku-sku-central-only", "single-sku-edit-tabs", "all-inventory-edit-tabs"]).default("inventory-only"),
  scope: z.enum(["visible-inventory-page", "all-inventory-pages"]).default("visible-inventory-page"),
  targetMode: AmazonListingEditReadSyncTargetModeSchema.default("inventory"),
  target: AmazonListingEditReadSyncTargetSchema.default({}),
  requireParentChildProof: z.boolean().default(true),
  maxItems: z.number().int().min(1).max(200).default(1),
  productType: z.string().min(1).max(80).optional(),
  stopOnFirstIssue: z.boolean().default(true),
  tabs: z.array(AmazonListingEditReadSyncTabSchema).min(1).max(5).default([...AmazonListingEditReadSyncAllTabs]),
}).strict();

type AmazonListingEditReadSyncInputCandidate = z.infer<typeof AmazonListingEditReadSyncInputBaseSchema>;

const refineTargetRequirements = (input: AmazonListingEditReadSyncInputCandidate, context: z.RefinementCtx): void => {
  if (input.targetMode === "asin" && !input.target.asin) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["target", "asin"], message: "asin target mode requires target.asin" });
  }
  if (input.targetMode === "sku" && !input.target.sku) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["target", "sku"], message: "sku target mode requires target.sku" });
  }
  if (input.targetMode === "parent" && !input.target.parentAsin && !input.target.parentSku) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["target"], message: "parent target mode requires target.parentAsin or target.parentSku" });
  }
  if (input.targetMode === "child" && !input.target.childAsin && !input.target.childSku && !input.target.asin && !input.target.sku) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["target"], message: "child target mode requires child or item ASIN/SKU" });
  }
};

const refineSafetyModeRequirements = (input: AmazonListingEditReadSyncInputCandidate, context: z.RefinementCtx): void => {
  if (input.targetMode === "all-inventory" && input.safetyMode !== "all-inventory-edit-tabs") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["safetyMode"],
      message: "all-inventory target mode requires all-inventory-edit-tabs safetyMode",
    });
  }
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
};

export const AmazonListingEditReadSyncInputSchema = AmazonListingEditReadSyncInputBaseSchema.superRefine((input, context) => {
  refineTargetRequirements(input, context);
  refineSafetyModeRequirements(input, context);
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
  readonly parentAsin: string | null;
  readonly parentSku: string | null;
  readonly evidenceRef: string;
};

export type AmazonListingEditReadSyncTargetResolution = {
  readonly mode: AmazonListingEditReadSyncTargetMode;
  readonly status: "matched" | "not_found" | "ambiguous" | "parent_not_proven" | "child_parent_mismatch" | "not_required";
  readonly reason: string | null;
  readonly candidateCount: number;
  readonly requested: AmazonListingEditReadSyncTarget;
  readonly matchedParent: AmazonListingEditReadSyncInventoryItem | null;
  readonly matchedChild: AmazonListingEditReadSyncInventoryItem | null;
  readonly evidenceRefs: readonly string[];
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
  readonly targetResolution: AmazonListingEditReadSyncTargetResolution;
  readonly inventoryItems: readonly AmazonListingEditReadSyncInventoryItem[];
  readonly items: readonly AmazonListingEditReadSyncItemResult[];
  readonly diagnostic?: AmazonListingEditReadSyncDiagnostic;
  readonly createdAt: string;
  readonly updatedAt: string;
};
