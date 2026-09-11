import type { SharedExecutionContext } from "../mediator/product-plugin-contract.js";

export const baziRevisionInstruction = (context: SharedExecutionContext): readonly string[] =>
  context.resultRevision.revision === 0 ? [] : Object.freeze([
    `Website 已授权结果修订 ${context.resultRevision.revision}；只修正该拒绝回执指出的问题：${JSON.stringify(context.resultRevision.priorRejection)}`,
  ]);
