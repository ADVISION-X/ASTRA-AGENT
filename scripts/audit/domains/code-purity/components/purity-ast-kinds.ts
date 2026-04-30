import { SyntaxKind, ts } from "ts-morph";

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