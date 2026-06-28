import type {
  AmazonListingEditReadSyncInput,
  AmazonListingEditReadSyncInventoryItem,
  AmazonListingEditReadSyncTab,
} from "./amazon-listing-edit-read-sync.schema.js";

const MARKETPLACE_INVENTORY_URL: Record<AmazonListingEditReadSyncInput["marketplace"], string> = {
  "amazon.ae": "https://sellercentral.amazon.ae/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
  "amazon.sa": "https://sellercentral.amazon.sa/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
  "amazon.com": "https://sellercentral.amazon.com/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
  "amazon.co.uk": "https://sellercentral.amazon.co.uk/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
  "amazon.co.jp": "https://sellercentral.amazon.co.jp/myinventory/inventory?fulfilledBy=all&page=1&pageSize=25&sort=date_created_desc&status=all",
};

const MARKETPLACE_HOST: Record<AmazonListingEditReadSyncInput["marketplace"], string> = {
  "amazon.ae": "https://sellercentral.amazon.ae",
  "amazon.sa": "https://sellercentral.amazon.sa",
  "amazon.com": "https://sellercentral.amazon.com",
  "amazon.co.uk": "https://sellercentral.amazon.co.uk",
  "amazon.co.jp": "https://sellercentral.amazon.co.jp",
};

export const inventoryUrlForPage = (
  marketplace: AmazonListingEditReadSyncInput["marketplace"],
  page: number,
): string => {
  const url = new URL(MARKETPLACE_INVENTORY_URL[marketplace]);
  url.searchParams.set("page", String(page));
  return url.href;
};

export const pageUrlPath = (rawUrl: string): string | null => {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
};

export const editTabUrl = (
  mission: AmazonListingEditReadSyncInput,
  item: AmazonListingEditReadSyncInventoryItem,
  tab: AmazonListingEditReadSyncTab,
): string | null => {
  if (!mission.productType) return null;
  const url = new URL(`${MARKETPLACE_HOST[mission.marketplace]}/abis/listing/edit/${tab}`);
  url.searchParams.set("ref_", "obo_el_skuc_ac");
  url.searchParams.set("productType", mission.productType);
  url.searchParams.set("sku", item.sku);
  url.searchParams.set("asin", item.asin);
  url.hash = tab;
  return url.href;
};
