import type { ProductPlugin } from "../../mediator/product-plugin-contract.js";
import { executePaperFactory } from "./flow.js";

export const paperFactoryPlugin: ProductPlugin = {
  pluginId: "s00-paper-factory",
  accepts: [
    { productId: "astra_paper_research", actionId: "prepare_brief" },
    { productId: "astra_paper_research", actionId: "prepare_workspace" },
    { productId: "astra_paper_research", actionId: "build_evidence" },
    { productId: "astra_paper_research", actionId: "compose_manuscript" },
    { productId: "astra_paper_research", actionId: "prepare_delivery" },
    { productId: "astra_paper_research", actionId: "archive_delivery" },
    { productId: "astra_paper_research", actionId: "maintain_workspace" },
  ],
  execute: executePaperFactory,
};
