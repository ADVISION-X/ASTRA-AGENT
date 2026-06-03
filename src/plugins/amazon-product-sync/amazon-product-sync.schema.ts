import { z } from "zod";

export const AmazonProductSyncItemSchema = z.object({
  sourceKeyType: z.enum(["sku", "asin"]),
  sourceKey: z.string().min(1).max(128),
  sellerSku: z.string().min(1).max(128),
}).strict();

export const AmazonProductSyncInputSchema = z.object({
  requestId: z.string().min(1).max(160),
  marketplace: z.enum(["amazon.ae", "amazon.sa", "amazon.com", "amazon.co.uk", "amazon.co.jp"]).default("amazon.ae"),
  scope: z.string().min(1).max(80).default("selected-skus"),
  requestedAt: z.string().min(1),
  items: z.array(AmazonProductSyncItemSchema).min(1).max(250),
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
  | "parse_failed"
  | "skipped";

export type AmazonProductSyncResultItem = {
  readonly sellerSku: string;
  readonly sourceKeyType: "sku" | "asin";
  readonly sourceKey: string;
  readonly status: AmazonProductSyncItemStatus;
  readonly asinSnapshot: string | null;
  readonly sellerCentralTitleSnapshot: string | null;
  readonly sellerCentralMainImageEvidenceRef: string | null;
  readonly listingStatus: string | null;
  readonly availableFbaUnits: number | null;
  readonly inboundUnits: number | null;
  readonly unfulfillableUnits: number | null;
  readonly reservedUnits: number | null;
  readonly sales30dSnapshot: number | null;
  readonly snapshotAt: string;
  readonly rowEvidenceRef: string | null;
  readonly reason: string | null;
};

export type AmazonProductSyncTaskRecord = {
  readonly taskId: string;
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

