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
export const REPORT_PATH = "scripts/audit/generated/code-purity-report.generated.json";
export const PRODUCTION_CODE_ROOT = "src";
export const ACTIVE_ROOTS = [PRODUCTION_CODE_ROOT, "scripts"];
export const ACTIVE_FILES: string[] = [];
export const DISASTER_LINE_THRESHOLD = 800;

export const CODE_PURITY_LAW_IDS = [
  "GRASSEYE-CODE-PURITY-001-V1",
  "GRASSEYE-CODE-PURITY-002-V1",
  "GRASSEYE-CODE-PURITY-003-V1",
  "GRASSEYE-CODE-PURITY-004-V1",
  "GRASSEYE-CODE-PURITY-005-V1",
  "GRASSEYE-CODE-PURITY-006-V1",
  "GRASSEYE-CODE-PURITY-007-V1",
  "GRASSEYE-CODE-PURITY-008-V1",
  "GRASSEYE-CODE-PURITY-009-V1",
  "GRASSEYE-CODE-PURITY-010-V1",
  "GRASSEYE-CODE-PURITY-011-V1",
  "GRASSEYE-CODE-PURITY-012-V1",
  "GRASSEYE-CODE-PURITY-013-V1",
  "GRASSEYE-CODE-PURITY-014-V1",
] as const;

export const FILE_LIMITS = {
  ordinary: 300,
  runtime: 300,
  appHandler: 250,
  orchestrationCoordinator: 300,
  auditInspector: 250,
  auditPhase: 350,
  schemaType: 500,
} as const;

export const FUNCTION_LIMITS = {
  lines: 40,
  statements: 35,
  parameters: 4,
  returns: 5,
  depth: 3,
  complexity: 8,
  switchCases: 8,
  ifChain: 5,
} as const;

export const CLASS_LIMITS = {
  methods: 12,
  fields: 12,
  totalMembers: 24,
  constructorParameters: 6,
  publicMethods: 10,
} as const;

export const IMPORT_EXPORT_LIMITS = {
  importDeclarations: 15,
  importSources: 12,
  crossOwnerImports: 2,
  ownerBoundaries: 3,
  exports: 8,
} as const;

export const LAW_PHASE_SUMMARIES: PurityPhaseSummary[] = [
  {
    lawId: "GRASSEYE-CODE-PURITY-001-V1",
    name: "file-size-limits",
    okSummary: "Active source files stay within category hard limits.",
    failedSummary: "Active source files still exceed code-purity file-size hard limits.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-002-V1",
    name: "touched-file-rule",
    okSummary: "Touched active files stay within hard limits.",
    failedSummary: "Touched active files still exceed their hard limits.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-003-V1",
    name: "function-shape-limits",
    okSummary: "Functions stay small, shallow, and single-purpose.",
    failedSummary: "One or more functions exceed line, parameter, nesting, or complexity limits.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-004-V1",
    name: "class-object-limits",
    okSummary: "Classes and objects stay under god-object limits.",
    failedSummary: "One or more classes or objects exceed member or constructor limits.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-005-V1",
    name: "owner-boundary-limits",
    okSummary: "Owner-boundary counting stays at real capability granularity.",
    failedSummary: "Cross-owner imports or owner boundaries still exceed code-purity limits.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-006-V1",
    name: "import-export-purity",
    okSummary: "Import/export structures stay narrow and barrel-free.",
    failedSummary: "Import/export structures still exceed limits or hide coupling through barrels.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-007-V1",
    name: "single-role-files",
    okSummary: "Files stay role-local without schema/runtime bucket mixing.",
    failedSummary: "One or more files still mix broad roles behind neutral structure.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-008-V1",
    name: "dead-code-cleanup",
    okSummary: "Active source truth is free of fake paths, debug scatter, and dead-code leftovers.",
    failedSummary: "Fake paths, debug scatter, placeholder success, or dead code still exist in active source truth.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-009-V1",
    name: "refactor-direction",
    okSummary: "Refactor direction avoids compatibility bridges and duplicate active paths.",
    failedSummary: "Compatibility bridges or legacy duplicate routes still exist in active source truth.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-010-V1",
    name: "disaster-file-queue",
    okSummary: "Disaster files are identified and queued for physical split.",
    failedSummary: "Disaster files still exist without blocking inventory or remediation queue evidence.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-011-V1",
    name: "real-enforcement-coverage",
    okSummary: "All active code-purity laws have inspector coverage, runner execution, and negative proof.",
    failedSummary: "One or more active code-purity laws lack real coverage or negative proof.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-012-V1",
    name: "anti-escape",
    okSummary: "Type escapes, directives, dynamic imports, and wrapper laundering are blocked.",
    failedSummary: "Type escapes, directives, dynamic imports, or laundering patterns still exist.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-013-V1",
    name: "inventory-output",
    okSummary: "Code-purity writes actionable inventories and split plans.",
    failedSummary: "Code-purity did not produce the required inventories, remediation queue, or split plan.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-014-V1",
    name: "physical-split-direction",
    okSummary: "Remediation direction prefers physical deletion and physical splitting.",
    failedSummary: "Active source still relies on bridges, wrappers, or cosmetic refactor direction.",
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