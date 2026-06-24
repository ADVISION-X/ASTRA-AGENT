import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { ExtractedRow } from "./amazon-product-sync.flow.js";
import type {
  AmazonProductSyncInput,
  AmazonProductSyncMainImageUploadResult,
  AmazonProductSyncRequiredField,
} from "./amazon-product-sync.schema.js";

const normalizeSku = (value: string): string => value.trim().toUpperCase();
const mainImageDownloadTimeoutMs = 10_000;
const mainImageUploadTimeoutMs = 30_000;

export const redactedEvidenceRef = (taskId: string, sku: string): string =>
  `evidence://amazon-product-sync/${taskId}/${encodeURIComponent(normalizeSku(sku))}`;

export const hasRequiredField = (
  inputItem: AmazonProductSyncInput["items"][number],
  field: AmazonProductSyncRequiredField,
): boolean => inputItem.requiredFields.includes(field);

export const captureMainImageEvidenceRef = async (
  browser: BrowserController,
  input: {
    readonly taskId: string;
    readonly sellerSku: string;
    readonly row: ExtractedRow;
  },
): Promise<string | null> => {
  if (!input.row.imagePresent) return null;
  const capture = await browser.screenshotRegion({
    regionLabel: `amazon-product-sync main image evidence ${input.sellerSku}`,
    contentLines: [
      `taskId=${input.taskId}`,
      `sellerSku=${input.sellerSku}`,
      "field=mainImage",
    ],
    captureProfile: "observation_lightweight",
  });
  return `${redactedEvidenceRef(input.taskId, input.sellerSku)}/main-image/${capture.browserActionId}`;
};

const missingMainImageUpload = (
  status: AmazonProductSyncMainImageUploadResult["status"],
  reason: string,
): AmazonProductSyncMainImageUploadResult => ({
  status,
  imageUrl: null,
  mediaId: null,
  imageSha256: null,
  reason,
});

export const downloadMainImageBytes = async (
  imageSrc: string,
): Promise<{ readonly bytes: Uint8Array; readonly mimeType: string } | null> => {
  try {
    const response = await fetchWithTimeout(imageSrc, {}, mainImageDownloadTimeoutMs);
    if (!response.ok) return null;
    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (mimeType !== "image/jpeg" && mimeType !== "image/png" && mimeType !== "image/webp") return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength <= 0 || bytes.byteLength > 800 * 1024) return null;
    return { bytes, mimeType };
  } catch {
    return null;
  }
};

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const readMainImageUploadResponse = (payload: unknown): AmazonProductSyncMainImageUploadResult => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return missingMainImageUpload("failed", "main_image_upload_response_invalid");
  }
  const record = payload as Readonly<Record<string, unknown>>;
  const imageUrl = typeof record.imageUrl === "string" && record.imageUrl.trim() ? record.imageUrl.trim() : null;
  const mediaId = typeof record.mediaId === "string" && record.mediaId.trim() ? record.mediaId.trim() : null;
  const imageSha256 = typeof record.imageSha256 === "string" && record.imageSha256.trim() ? record.imageSha256.trim() : null;
  if (!imageUrl || !mediaId) {
    return missingMainImageUpload("failed", "main_image_upload_response_missing_image_url_or_media_id");
  }
  return { status: "uploaded", imageUrl, mediaId, imageSha256, reason: null };
};

export const uploadMainImage = async (
  inputItem: AmazonProductSyncInput["items"][number],
  row: ExtractedRow,
  taskId: string,
): Promise<AmazonProductSyncMainImageUploadResult | null> => {
  if (!hasRequiredField(inputItem, "mainImage")) return null;
  if (!inputItem.mainImageUpload) return missingMainImageUpload("not_configured", "main_image_upload_endpoint_not_configured");
  if (!row.imageSrc) return missingMainImageUpload("not_found", "seller_central_main_image_src_not_found");
  const downloaded = await downloadMainImageBytes(row.imageSrc);
  if (!downloaded) return missingMainImageUpload("failed", "seller_central_main_image_download_failed");
  const response = await postMainImageUpload(inputItem, downloaded, taskId);
  if (!response) return missingMainImageUpload("failed", "main_image_upload_request_failed");
  if (!response.ok) return missingMainImageUpload("failed", `main_image_upload_failed:${response.status}`);
  const payload = await response.json() as unknown;
  return readMainImageUploadResponse(payload);
};

const postMainImageUpload = async (
  inputItem: AmazonProductSyncInput["items"][number],
  downloaded: { readonly bytes: Uint8Array; readonly mimeType: string },
  taskId: string,
): Promise<Response | null> => {
  try {
    return await fetchWithTimeout(inputItem.mainImageUpload?.endpoint ?? "", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-amzmgr-agent-product-image-token": inputItem.mainImageUpload?.token ?? "",
      },
      body: JSON.stringify({
        agentTaskId: taskId,
        sellerSku: inputItem.sellerSku,
        imageMimeType: downloaded.mimeType,
        imageBase64: Buffer.from(downloaded.bytes).toString("base64"),
      }),
    }, mainImageUploadTimeoutMs);
  } catch {
    return null;
  }
};
