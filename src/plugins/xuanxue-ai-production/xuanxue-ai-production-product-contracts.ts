import { createHash } from "node:crypto";
import { XuanxueAiProductIdSchema } from "./xuanxue-ai-production.schema.js";
import { XUANXUE_LOCALIZATION_SUPPORTED_PRODUCT_CONTRACTS } from "./xuanxue-ai-production-localization-contract.js";

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
};

export const xuanxueAiProductionProductContractHashV6 = (
  productId: (typeof XuanxueAiProductIdSchema.options)[number],
): `sha256:${string}` => {
  const localization = XUANXUE_LOCALIZATION_SUPPORTED_PRODUCT_CONTRACTS[productId as keyof typeof XUANXUE_LOCALIZATION_SUPPORTED_PRODUCT_CONTRACTS];
  if (localization) return localization as `sha256:${string}`;
  const value = {
    schema_version: "xuanxue-ai-product-contract.v6",
    job_contract_version: `xuanxue-ai-job-contract.${productId}.v6`,
    product_id: productId,
    execution_lane: "supervised_local_gpt_web",
    required_capabilities: ["gpt_web_browser"],
  };
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
};

export const XUANXUE_AI_PRODUCTION_SUPPORTED_PRODUCT_CONTRACT_HASHES_V6 = Object.freeze(
  XuanxueAiProductIdSchema.options.map(xuanxueAiProductionProductContractHashV6),
);
