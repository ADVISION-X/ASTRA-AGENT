import { strict as assert } from "node:assert";

import {
  AmazonProductSyncAllRequiredFields,
} from "../../src/plugins/amazon-product-sync/amazon-product-sync.schema.js";
import {
  AmazonProductFeeSyncAllRequiredFields,
  AmazonProductFeeSyncInputSchema,
} from "../../src/plugins/amazon-product-fee-sync/amazon-product-fee-sync.schema.js";
import {
  buildInventoryFeeExtractionScript,
  buildInventoryFeeSearchProbeScript,
  deriveAmazonFeeResidual,
  parseAmazonFeeMoney,
} from "../../src/plugins/amazon-product-fee-sync/amazon-product-fee-sync.dom-scripts.js";

const fixtureSku = "DL-UG6I-2OWL";

assert.deepEqual(AmazonProductFeeSyncAllRequiredFields, ["totalAmazonFee", "fbaFulfillmentFee"]);
assert.equal(AmazonProductSyncAllRequiredFields.includes("totalAmazonFee" as never), false);
assert.equal(AmazonProductSyncAllRequiredFields.includes("fbaFulfillmentFee" as never), false);

assert.deepEqual(parseAmazonFeeMoney("AED22.25"), { amount: "22.25", currency: "AED", status: "visible" });
assert.deepEqual(parseAmazonFeeMoney("AED 22.25"), { amount: "22.25", currency: "AED", status: "visible" });
assert.deepEqual(parseAmazonFeeMoney("AED1,234.56"), { amount: "1234.56", currency: "AED", status: "visible" });
assert.deepEqual(parseAmazonFeeMoney("--"), { amount: null, currency: null, status: "not_visible" });

const residual = deriveAmazonFeeResidual(parseAmazonFeeMoney("AED22.25"), parseAmazonFeeMoney("AED9.50"));
assert.deepEqual(residual, {
  amount: "12.75",
  currency: "AED",
  status: "derived_total_minus_fba_not_referral",
});

const validInput = AmazonProductFeeSyncInputSchema.parse({
  site: "on-the-way",
  requestId: "fee-sync-acceptance",
  marketplace: "amazon.ae",
  items: [
    {
      sourceKeyType: "sku",
      sourceKey: fixtureSku,
      sellerSku: fixtureSku,
      requiredFields: ["totalAmazonFee", "fbaFulfillmentFee"],
    },
  ],
});
assert.equal(validInput.items.length, 1);

assert.equal(AmazonProductFeeSyncInputSchema.safeParse({
  site: "on-the-way",
  requestId: "fee-sync-too-many",
  marketplace: "amazon.ae",
  items: [validInput.items[0], validInput.items[0]],
}).success, false);

assert.equal(AmazonProductFeeSyncInputSchema.safeParse({
  site: "on-the-way",
  requestId: "fee-sync-missing-field",
  marketplace: "amazon.ae",
  items: [{ ...validInput.items[0], requiredFields: ["totalAmazonFee"] }],
}).success, false);

const probeScript = buildInventoryFeeSearchProbeScript();
assert.match(probeScript, /form#sc-global-search-form/);
assert.match(probeScript, /topGlobalSearchExcluded/);
assert.match(probeScript, /搜索 SKU、商品名称\/关键词、FNSKU、ASIN、UPC\/EAN/);

const extractionScript = buildInventoryFeeExtractionScript(fixtureSku);
assert.match(extractionScript, /ProductDetails-module__container/);
assert.match(extractionScript, /JanusSplitBox-module__row/);
assert.match(extractionScript, /总费用/);
assert.match(extractionScript, /亚马逊物流费用/);
assert.match(extractionScript, /not_visible_in_current_dom/);
assert.match(extractionScript, /derived_total_minus_fba_not_referral/);

console.log("amazon-product-fee-sync acceptance passed");
