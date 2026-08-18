import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH,
  XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_VERSION,
  XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS,
  XUANXUE_LOCALIZATION_SUPPORTED_PRODUCT_CONTRACTS,
  expectedLocalizationProviderProfile,
} from "../../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-localization-contract.js";

const root = process.cwd();
const projectionPath = path.join(
  root,
  "artifacts/contracts/localization-production-contract.v1.json",
);

const criticalRuntimeFiles = [
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production.schema.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production.profile.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-contract.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-client.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-worker.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-staging.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-feed.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-stage-execution.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-result.ts",
] as const;

const forbiddenLegacyIds = [
  "localization_candidate_a",
  "localization_candidate_b",
  "localization_selector_first",
  "localization_selector_swap",
  "localization_consistency",
] as const;

export function inspectXuanxueLocalizationContract(): void {
  const projection = JSON.parse(readFileSync(projectionPath, "utf8")) as {
    schema_version: string;
    contract_manifest_hash: string;
    products: Record<string, string>;
    roles: Record<string, string>;
  };
  assert.equal(
    projection.schema_version,
    XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_VERSION,
  );
  assert.equal(
    projection.contract_manifest_hash,
    XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH,
  );
  assert.deepEqual(
    Object.keys(projection.products).sort(),
    Object.keys(XUANXUE_LOCALIZATION_SUPPORTED_PRODUCT_CONTRACTS).sort(),
  );
  for (const [productId, contractHash] of Object.entries(
    XUANXUE_LOCALIZATION_SUPPORTED_PRODUCT_CONTRACTS,
  )) {
    assert.equal(projection.products[productId], contractHash);
  }
  for (const role of [
    "candidate_a", "candidate_b", "selector_first", "selector_swap",
    "consistency", "report_translation", "article_translation",
  ] as const) {
    assert.equal(projection.roles[role], expectedLocalizationProviderProfile(role).profile_hash);
  }
  assert.deepEqual(
    XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS.localization_static_review_candidate.roles,
    ["candidate_a", "candidate_b"],
  );
  assert.deepEqual(
    XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS.localization_static_review_selector.roles,
    ["selector_first", "selector_swap", "consistency"],
  );
  for (const relative of criticalRuntimeFiles) {
    const source = readFileSync(path.join(root, relative), "utf8");
    assert.equal(
      source.includes('"localization_static_review"'),
      false,
      `${relative} reintroduced legacy localization_static_review product`,
    );
    for (const legacy of forbiddenLegacyIds) {
      assert.equal(
        source.includes(`\"${legacy}\"`),
        false,
        `${relative} reintroduced legacy stage ${legacy}`,
      );
    }
  }
  const client = readFileSync(
    path.join(root, "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-client.ts"),
    "utf8",
  );
  assert.match(client, /safeParse\(rawJob\)/u);
  assert.match(client, /nackMalformedClaim/u);
  assert.doesNotMatch(client, /\.map\(\(job\)\s*=>\s*XuanxueAiProductionCloudClaimedJobSchema\.parse/u);
  const worker = readFileSync(
    path.join(root, "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-worker.ts"),
    "utf8",
  );
  assert.match(worker, /first heartbeat is a semantic contract handshake/u);
  const execution = readFileSync(
    path.join(root, "src/plugins/xuanxue-ai-production/xuanxue-ai-production-stage-execution.ts"),
    "utf8",
  );
  assert.match(execution, /localizationProviderEvidenceFailure/u);
  assert.match(execution, /providerTranscriptHash/u);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  inspectXuanxueLocalizationContract();
  process.stdout.write("[AUDIT] xuanxue localization contract static inspection PASS\n");
}
