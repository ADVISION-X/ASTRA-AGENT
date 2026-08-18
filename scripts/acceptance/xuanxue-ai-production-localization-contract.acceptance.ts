import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH,
  XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS,
  expectedLocalizationProviderProfile,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-localization-contract.js";
import {
  resolveXuanxueAiProductionProfile,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production.profile.js";

const expected = [
  ["localization_report_translation", "report_translation"],
  ["localization_article_translation", "article_translation"],
  ["localization_static_review_candidate", "localization_candidate"],
  ["localization_static_review_selector", "localization_selector"],
] as const;

for (const [product, stage] of expected) {
  const profile = resolveXuanxueAiProductionProfile(product);
  assert.equal(profile.stages.length, 1, `${product} must be one stage`);
  assert.equal(profile.stages[0]?.stageId, stage);
  assert.equal(profile.finalStageId, stage);
}

assert.equal(
  expectedLocalizationProviderProfile("candidate_a").reasoning_effort,
  "xhigh",
);
for (const role of [
  "candidate_b", "selector_first", "selector_swap", "consistency",
  "report_translation", "article_translation",
] as const) {
  assert.equal(expectedLocalizationProviderProfile(role).reasoning_effort, "high");
}

const projection = JSON.parse(readFileSync(
  path.resolve("artifacts/contracts/localization-production-contract.v1.json"),
  "utf8",
)) as { contract_manifest_hash: string; products: Record<string, string> };
assert.equal(
  projection.contract_manifest_hash,
  XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH,
);
for (const [productId, contract] of Object.entries(XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS)) {
  assert.equal(projection.products[productId], contract.product_contract_hash);
}

const cloudClient = readFileSync(
  path.resolve("src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-client.ts"),
  "utf8",
);
assert.match(cloudClient, /XuanxueAiProductionCloudClaimedJobSchema\.safeParse/u);
assert.match(cloudClient, /nackMalformedClaim/u);

const feed = readFileSync(
  path.resolve("src/plugins/xuanxue-ai-production/xuanxue-ai-production-feed.ts"),
  "utf8",
);
assert.match(feed, /providerExecutionProfile\?\.reasoning_effort/u);
assert.match(feed, /localizationRole !== "selector_swap"/u);

const stage = readFileSync(
  path.resolve("src/plugins/xuanxue-ai-production/xuanxue-ai-production-stage-execution.ts"),
  "utf8",
);
assert.match(stage, /XUANXUE_AI_PRODUCTION_LOCALIZATION_MODEL_IDENTITY_MISMATCH/u);
assert.match(stage, /XUANXUE_AI_PRODUCTION_LOCALIZATION_PROVIDER_TRANSCRIPT_INVALID/u);

process.stdout.write(
  "[ACCEPTANCE] localization contract definition PASS: four single-stage products, seven frozen roles, claim isolation, profile-driven feed and evidence gates are declared.\n",
);
