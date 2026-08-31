import type { ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { executeOwnedFlow, productSkillHash } from "./flow.js";
import { parseProductResult } from "./result-contract.js";

export const namingFromExistingBaziReportPlugin: ProductPlugin = {
  pluginId: "naming-from-existing-bazi-report", pluginVersion: 7, skillHash: productSkillHash, checkpointSchemaVersion: 2,
  parseResult: parseProductResult,
  accepts: [
    { productId: "naming_from_existing_bazi_report", actionId: "produce" },
    { productId: "naming_from_existing_bazi_report", actionId: "accuracy_challenge" },
    { productId: "naming_from_existing_bazi_report", actionId: "quality_reflection" },
  ],
  execute: executeOwnedFlow,
};
