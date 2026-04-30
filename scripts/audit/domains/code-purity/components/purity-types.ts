import type { ArrowFunction, ConstructorDeclaration, FunctionDeclaration, FunctionExpression, MethodDeclaration } from "ts-morph";

export type PurityFunctionNode =
  | ArrowFunction
  | ConstructorDeclaration
  | FunctionDeclaration
  | FunctionExpression
  | MethodDeclaration;

export type CommentToken = {
  line: number;
  text: string;
};

export type PurityPhaseSummary = {
  lawId: string;
  name: string;
  okSummary: string;
  failedSummary: string;
};