import type { SourceFile } from "ts-morph";

import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";

export function isThinAbilityGroup(sourceFile: SourceFile): boolean {
  return hasCallExpressionPath(sourceFile, ["PageStateAbilityInputSchema", "safeParse"])
    && hasCallExpression(sourceFile, "executePageState")
    && !hasCallExpression(sourceFile, "createPageStateRegistry")
    && !hasCallExpression(sourceFile, "createSystemPageStateClock")
    && !hasCallExpression(sourceFile, "createDefaultPageStateProfilePort");
}