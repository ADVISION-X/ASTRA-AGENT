import type { Node, SourceFile } from "ts-morph";

import {
	getZodEnumValues as getSharedZodEnumValues,
	hasInterfaceMethod as hasSharedInterfaceMethod,
} from "../_shared/ast-schema-queries.js";
import {
	hasCallExpression as hasSharedCallExpression,
	hasCallExpressionPath as hasSharedCallExpressionPath,
} from "../_shared/ast-helpers.js";

export const getZodEnumValues = (sourceFile: SourceFile, declarationName: string): string[] =>
	getSharedZodEnumValues(sourceFile, declarationName);

export const hasInterfaceMethod = (sourceFile: SourceFile, interfaceName: string, methodName: string): boolean =>
	hasSharedInterfaceMethod(sourceFile, interfaceName, methodName);

export const hasCallExpression = (node: Node, calleeName: string): boolean =>
	hasSharedCallExpression(node, calleeName);

export const hasCallExpressionPath = (node: Node, pathParts: string[]): boolean =>
	hasSharedCallExpressionPath(node, pathParts);