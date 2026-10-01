import type { ProductionRoutePolicy, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { productResultValidation as result } from "../../mediator/product-plugin-contract.js";

const BAZI_CHART_INTERPRETATION_RESULT_FIELDS = [
  "schema_version", "chart_ref", "chart_version", "chart_hash",
  "bazi_pdf_semantic_manifest_ref", "manifest_hash",
  "report_summary", "interpretation_blocks", "citations",
  "uncertainties", "limitations", "safety_notes", "covered_semantic_anchor_refs",
] as const;

export const parseProductResult = (
  task: WebsiteAgentTask,
  value: unknown,
  route: ProductionRoutePolicy,
  _phase: "draft" | "final" = "final",
): Readonly<Record<string, unknown>> => {
  if (task.product_id !== "bazi_chart_interpretation") throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  if (route.relation_kind === "review") return result.parseReview(JSON.stringify(value));
  const output = result.object(value, "AGENT_RESULT_OBJECT_REQUIRED");
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  result.exact(output, BAZI_CHART_INTERPRETATION_RESULT_FIELDS, "BAZI_CHART_INTERPRETATION_RESULT_FIELDS_INVALID");
  result.locked(output, task, ["chart_ref", "chart_version", "chart_hash", "bazi_pdf_semantic_manifest_ref"]);
  if (output.manifest_hash !== task.parameters.bazi_pdf_semantic_manifest_hash) {
    throw new Error("BAZI_CHART_INTERPRETATION_MANIFEST_HASH_LOCK_INVALID");
  }
  result.commonReport(output, "report_summary", "interpretation_blocks");
  const declared = result.stringArray(output.covered_semantic_anchor_refs, "BAZI_CHART_INTERPRETATION_COVERAGE_INVALID", true);
  const anchors: string[] = [];
  const blockIds: string[] = [];
  for (const value of result.array(output.interpretation_blocks, "BAZI_CHART_INTERPRETATION_BLOCKS_INVALID", true)) {
    const block = result.object(value, "BAZI_CHART_INTERPRETATION_BLOCK_INVALID");
    result.exact(block, ["block_id", "semantic_anchor_refs", "candidate_scope", "evidence_refs", "citation_ids", "professional_markdown", "reader_explanation_markdown"], "BAZI_CHART_INTERPRETATION_BLOCK_FIELDS_INVALID");
    blockIds.push(result.text(block.block_id, "BAZI_CHART_INTERPRETATION_BLOCK_ID_INVALID"));
    result.text(block.professional_markdown, "AGENT_RESULT_DUAL_LAYER_INVALID");
    result.text(block.reader_explanation_markdown, "AGENT_RESULT_DUAL_LAYER_INVALID");
    anchors.push(...result.stringArray(block.semantic_anchor_refs, "BAZI_CHART_INTERPRETATION_ANCHORS_INVALID", true));
    if (block.candidate_scope !== "all") result.stringArray(block.candidate_scope, "BAZI_CHART_INTERPRETATION_SCOPE_INVALID", true);
    result.stringArray(block.evidence_refs, "BAZI_CHART_INTERPRETATION_EVIDENCE_INVALID");
    result.stringArray(block.citation_ids, "BAZI_CHART_INTERPRETATION_CITATIONS_INVALID");
  }
  if (new Set(blockIds).size !== blockIds.length || new Set(declared).size !== declared.length
    || JSON.stringify([...new Set(anchors)].sort()) !== JSON.stringify([...declared].sort())) {
    throw new Error("BAZI_CHART_INTERPRETATION_COVERAGE_INVALID");
  }
  return Object.freeze(output);
};
