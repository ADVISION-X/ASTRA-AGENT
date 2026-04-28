import { SyntaxKind, ts, type ArrowFunction, type ConstructorDeclaration, type FunctionDeclaration, type FunctionExpression, type MethodDeclaration } from "ts-morph";

export type PurityFunctionNode =
  | ArrowFunction
  | ConstructorDeclaration
  | FunctionDeclaration
  | FunctionExpression
  | MethodDeclaration;

export interface CommentToken {
  line: number;
  text: string;
}

export interface PurityPhaseSummary {
  lawId: string;
  name: string;
  okSummary: string;
  failedSummary: string;
}

export const BLUEPRINT_PATH = "docs/法案辅助文件/GrassEye 代码纯洁度施工图.md";
export const PRODUCTION_CODE_ROOT = "src";
export const ACTIVE_ROOTS = [PRODUCTION_CODE_ROOT, "scripts"];
export const ACTIVE_FILES: string[] = [];

export const LAW_PHASE_SUMMARIES: PurityPhaseSummary[] = [
  {
    lawId: "GRASSEYE-CODE-PURITY-003-V1",
    name: "cleanup-hygiene",
    okSummary: "Active files are free of console.log scatter, bad TODO hygiene, and commented-out code.",
    failedSummary: "Debug scatter, TODO drift, or commented-out code exists in the active scope.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-004-V1",
    name: "refactor-direction",
    okSummary: "Active scope contains no compatibility-bridge style files.",
    failedSummary: "Compatibility-bridge style files still exist in the active code-purity scope.",
  },
];

export const FUNCTION_DECISION_KINDS = new Set([
  SyntaxKind.CaseClause,
  SyntaxKind.CatchClause,
  SyntaxKind.ConditionalExpression,
  SyntaxKind.DoStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.IfStatement,
  SyntaxKind.SwitchStatement,
  SyntaxKind.WhileStatement,
]);

export const COMMENT_CODE_KINDS = new Set([
  ts.SyntaxKind.Block,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.ExportAssignment,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.ExpressionStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ReturnStatement,
  ts.SyntaxKind.SwitchStatement,
  ts.SyntaxKind.ThrowStatement,
  ts.SyntaxKind.TryStatement,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.WhileStatement,
]);