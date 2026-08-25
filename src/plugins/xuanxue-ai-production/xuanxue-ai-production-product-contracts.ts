export type LocalOrderStageSource = Readonly<{
  stageId: string;
}>;

export type LocalOrderSource = Readonly<{
  productId: string;
  productContractHash: string;
  materials: readonly LocalOrderStageSource[];
}>;

export type GeneratedStageContract = Readonly<{
  stage_id: string;
  ordinal: number;
  depends_on_stage_ids: readonly string[];
  continuation_from_stage_id: string | null;
  generated_inputs_from_stage_ids: readonly string[];
}>;

export type GeneratedProductNode = Readonly<{
  node_id: string;
  join_binding: "cloud_order_declared";
  order_contract: Readonly<{
    allowed_stage_ids: readonly string[];
    final_stage_id: string;
    stages: readonly GeneratedStageContract[];
  }>;
}>;

const assertHash = (value: string): void => {
  if (!/^sha256:[a-f0-9]{64}$/u.test(value)) {
    throw new Error("XUANXUE_PRODUCT_EXECUTION_CONTRACT_HASH_INVALID");
  }
};

export const xuanxueLocalOrderNode = (
  order: LocalOrderSource,
): GeneratedProductNode => {
  assertHash(order.productContractHash);
  const stageIds = order.materials.map((material) => material.stageId);
  if (!order.productId.trim()
    || stageIds.length === 0
    || new Set(stageIds).size !== stageIds.length
    || stageIds.some((stageId) => !stageId.trim())) {
    throw new Error("XUANXUE_PRODUCT_EXECUTION_LOCAL_ORDER_INVALID");
  }
  const stages = stageIds.map((stageId, ordinal) => {
    const previous = ordinal === 0 ? null : stageIds[ordinal - 1]!;
    return Object.freeze({
      stage_id: stageId,
      ordinal,
      depends_on_stage_ids: previous ? Object.freeze([previous]) : Object.freeze([]),
      continuation_from_stage_id: previous,
      generated_inputs_from_stage_ids: previous ? Object.freeze([previous]) : Object.freeze([]),
    });
  });
  return Object.freeze({
    node_id: `${order.productId}:${stageIds.join("+")}`,
    join_binding: "cloud_order_declared",
    order_contract: Object.freeze({
      allowed_stage_ids: Object.freeze(stageIds),
      final_stage_id: stageIds.at(-1)!,
      stages: Object.freeze(stages),
    }),
  });
};

export const assertXuanxueProductContractHash = (
  order: LocalOrderSource,
  productContractHash: string,
): void => {
  assertHash(productContractHash);
  if (order.productContractHash !== productContractHash) {
    throw new Error("XUANXUE_PRODUCT_EXECUTION_CONTRACT_HASH_MISMATCH");
  }
};
