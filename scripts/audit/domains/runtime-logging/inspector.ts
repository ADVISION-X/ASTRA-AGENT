// Runtime Logging Inspector — full ts-morph AST enforcement.
// ZERO regex on source text. Every production check is AST-level, symbol-level,
// or structured property-declaration-level.
//
// Checks:
//   RLOG-FILE-001  src/lib/runtime-logs file count <= 8  (fs)
//   RLOG-FILE-002  Law file has active Runtime Log Spine laws  (text — .md has no AST)
//   RLOG-AST-001   RuntimeLogEvent interface has required property declarations  (AST)
//   RLOG-AST-002   mode.ts has FLOW / DEBUG / TRACE as actual StringLiteral nodes  (AST)
//   RLOG-AST-003   redactRuntimeLogPayload is a named export in redaction.ts  (AST/symbol)
//   RLOG-AST-004   No console.* calls in AI files — with alias/destructure tracking  (AST)
//   RLOG-AST-005   Every emit() call site in governed files has traceId ObjectProperty  (AST)
//   RLOG-AST-006   AI four-piece events exist as actual emit() call sites  (AST)
//   RLOG-AST-007   traceId value never resolves to randomUUID symbol  (AST + symbol)
//   RLOG-AST-008   runtimeLogger passed to createConfiguredAiAbilityGroup  (AST)
//   RLOG-AST-009   RuntimeLogger has isDebugEnabled / isTraceEnabled methods  (AST)
//   RLOG-AST-010   All 22 boundary event types have emit() call sites in src/**  (AST)
//   RLOG-AST-011   Heavy payload tokens in emit() args inside isTraceEnabled() guard  (AST)

import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";
import { getAuditProject } from "../../core/ts-morph.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { RUNTIME_LOGGING_CONFIG } from "./config.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RlogStatus = "PASS" | "FAIL";

export type RlogCheck = {
  checkId: string;
  question: string;
  status: RlogStatus;
  detail: string;
};

export type RuntimeLoggingInspectorResult = {
  checks: RlogCheck[];
  hardFails: number;
  pass: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relPath(sf: SourceFile): string {
  return toRepoRelativePath(sf.getFilePath());
}

function countFilesInDir(relDir: string): number {
  const dir = join(pathFromRepoRoot("."), relDir);
  if (!existsSync(dir)) return 0;
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && /\.(ts|js|mjs|json)$/.test(d.name))
    .length;
}

function getSfOrNull(project: Project, relFilePath: string): SourceFile | undefined {
  const abs = pathFromRepoRoot(relFilePath);
  return project.getSourceFile(abs) ?? project.addSourceFileAtPathIfExists(abs) ?? undefined;
}

function pass(checkId: string, question: string, detail: string): RlogCheck {
  return { checkId, question, status: "PASS", detail };
}

function fail(checkId: string, question: string, detail: string): RlogCheck {
  return { checkId, question, status: "FAIL", detail };
}

// ─── RLOG-FILE-001: runtime-logs file count ───────────────────────────────────

function checkRlogFileCount(): RlogCheck {
  const count = countFilesInDir("src/lib/runtime-logs");
  const limit = RUNTIME_LOGGING_CONFIG.maxRuntimeLogFiles;
  if (count === 0)
    return fail("RLOG-FILE-001", "src/lib/runtime-logs exists and has files?", "Directory missing or empty.");
  if (count > limit)
    return fail("RLOG-FILE-001", "src/lib/runtime-logs file count <= 8?", `${count} files — exceeds limit ${limit}.`);
  return pass("RLOG-FILE-001", "src/lib/runtime-logs file count <= 8?", `${count} file(s) (limit: ${limit}).`);
}

// ─── RLOG-FILE-002: Law file (markdown, no ts-morph) ─────────────────────────

function checkLawFile(): RlogCheck {
  const lawPath = pathFromRepoRoot(
    ".github/instructions/cursor-rules/modules/module-structured-logging.instructions.md",
  );
  if (!existsSync(lawPath))
    return fail("RLOG-FILE-002", "module-structured-logging law file exists?", "Law file not found on disk.");

  const text = readFileSync(lawPath, "utf8");
  const hasSpine = text.includes("Runtime Log Spine");
  const hasActive = /status:\s*active/i.test(text);
  const hasRetired = /status:\s*retired/i.test(text);

  if (!hasActive)
    return fail("RLOG-FILE-002", "Law file is active Runtime Log Spine?", "No 'status: active' found in law file.");
  if (hasRetired)
    return fail("RLOG-FILE-002", "Law file is active Runtime Log Spine?", "Retired law still present — file was not replaced.");
  if (!hasSpine)
    return fail("RLOG-FILE-002", "Law file is active Runtime Log Spine?", "'Runtime Log Spine' branding missing from active law file.");

  return pass("RLOG-FILE-002", "Law file is active Runtime Log Spine?", "Law file active, no retired laws, branding present.");
}

// ─── RLOG-AST-001: RuntimeLogEvent interface property declarations ────────────

function checkSchemaInterface(project: Project): RlogCheck {
  const sf = getSfOrNull(project, "src/lib/runtime-logs/schema.ts");
  if (!sf)
    return fail("RLOG-AST-001", "RuntimeLogEvent has required property declarations (AST)?", "schema.ts not found.");

  // Collect all declared property names from either interface or type-alias object literal
  const declaredNames: string[] = [];

  const iface = sf.getInterface("RuntimeLogEvent");
  if (iface) {
    declaredNames.push(...iface.getProperties().map((p) => p.getName()));
  } else {
    const typeAlias = sf.getTypeAlias("RuntimeLogEvent");
    if (!typeAlias)
      return fail("RLOG-AST-001", "RuntimeLogEvent has required property declarations (AST)?", "RuntimeLogEvent not declared in schema.ts.");

    // TypeAlias with an object type literal: type RuntimeLogEvent = { ... }
    const typeNode = typeAlias.getTypeNode();
    if (typeNode && Node.isTypeLiteral(typeNode)) {
      declaredNames.push(...typeNode.getProperties().map((p) => p.getName()));
    }
  }

  const missing = RUNTIME_LOGGING_CONFIG.requiredSchemaFields.filter((f) => !declaredNames.includes(f));

  if (missing.length > 0)
    return fail(
      "RLOG-AST-001",
      "RuntimeLogEvent has required property declarations (AST)?",
      `Missing property declarations: ${missing.join(", ")}`,
    );

  return pass(
    "RLOG-AST-001",
    "RuntimeLogEvent has required property declarations (AST)?",
    `All ${RUNTIME_LOGGING_CONFIG.requiredSchemaFields.length} required properties declared in RuntimeLogEvent.`,
  );
}

// ─── RLOG-AST-002: mode.ts has FLOW / DEBUG / TRACE StringLiteral nodes ───────

function checkModeStringLiterals(project: Project): RlogCheck {
  const sf = getSfOrNull(project, "src/lib/runtime-logs/mode.ts");
  if (!sf)
    return fail("RLOG-AST-002", "mode.ts has FLOW/DEBUG/TRACE StringLiteral nodes (AST)?", "mode.ts not found.");

  // Collect all string literal values in the file
  const stringValues = new Set<string>();
  sf.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.StringLiteral) {
      stringValues.add(node.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralText());
    }
  });

  const missing = RUNTIME_LOGGING_CONFIG.requiredModes.filter((m) => !stringValues.has(m));
  if (missing.length > 0)
    return fail(
      "RLOG-AST-002",
      "mode.ts has FLOW/DEBUG/TRACE StringLiteral nodes (AST)?",
      `Mode string literals missing: ${missing.join(", ")}`,
    );

  return pass(
    "RLOG-AST-002",
    "mode.ts has FLOW/DEBUG/TRACE StringLiteral nodes (AST)?",
    "FLOW, DEBUG, TRACE all present as string literal nodes.",
  );
}

// ─── RLOG-AST-003: redactRuntimeLogPayload is a named export ─────────────────

function checkRedactionExport(project: Project): RlogCheck {
  const sf = getSfOrNull(project, "src/lib/runtime-logs/redaction.ts");
  if (!sf)
    return fail("RLOG-AST-003", "redactRuntimeLogPayload exported from redaction.ts (AST/symbol)?", "redaction.ts not found.");

  const exportMap = sf.getExportedDeclarations();
  const fn = RUNTIME_LOGGING_CONFIG.redactionFunctionName;

  if (!exportMap.has(fn))
    return fail(
      "RLOG-AST-003",
      "redactRuntimeLogPayload exported from redaction.ts (AST/symbol)?",
      `'${fn}' not in exported declarations of redaction.ts.`,
    );

  return pass(
    "RLOG-AST-003",
    "redactRuntimeLogPayload exported from redaction.ts (AST/symbol)?",
    `'${fn}' confirmed as exported symbol.`,
  );
}

// ─── RLOG-AST-004: No console.* in AI files (+ alias escape detection) ────────

function checkConsoleInAiFiles(project: Project): RlogCheck {
  const violations: string[] = [];

  const AI_FILES = [
    "src/capabilities/ai/runtime/model-call.ts",
    "src/capabilities/ai/children/visual-mission-judge-once.ts",
    "src/capabilities/ai/ability-group.ts",
    "src/lib/online-ai/gemini-client.ts",
  ];

  for (const relFilePath of AI_FILES) {
    const sf = getSfOrNull(project, relFilePath);
    if (!sf) continue;

    // Pass 1: collect console aliases
    const consoleAliases = new Set<string>(["console"]);
    sf.forEachDescendant((node) => {
      if (!Node.isVariableDeclaration(node)) return;
      const init = node.getInitializer();
      if (!init) return;

      if (Node.isIdentifier(init) && init.getText() === "console") {
        const nameNode = node.getNameNode();
        if (Node.isIdentifier(nameNode)) {
          consoleAliases.add(nameNode.getText());
          violations.push(`${relFilePath}:${node.getStartLineNumber()} console alias \`${nameNode.getText()} = console\``);
        }
        return;
      }
      if (Node.isObjectBindingPattern(node.getNameNode()) && Node.isIdentifier(init) && init.getText() === "console") {
        for (const elem of node.getNameNode().asKindOrThrow(SyntaxKind.ObjectBindingPattern).getElements()) {
          consoleAliases.add(elem.getName());
          violations.push(`${relFilePath}:${node.getStartLineNumber()} console destructure alias { ${elem.getName()} }`);
        }
        return;
      }
      if (Node.isPropertyAccessExpression(init)) {
        const obj = init.getExpression();
        if (Node.isIdentifier(obj) && obj.getText() === "console") {
          const nameNode = node.getNameNode();
          if (Node.isIdentifier(nameNode)) {
            consoleAliases.add(nameNode.getText());
            violations.push(`${relFilePath}:${node.getStartLineNumber()} console method alias \`${nameNode.getText()} = console.${init.getName()}\``);
          }
        }
      }
    });

    // Pass 2: check call expressions
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const expr = node.getExpression();
      if (!Node.isPropertyAccessExpression(expr)) return;
      const obj = expr.getExpression();
      if (!Node.isIdentifier(obj)) return;
      if (!consoleAliases.has(obj.getText())) return;
      violations.push(`${relFilePath}:${node.getStartLineNumber()} ${obj.getText()}.${expr.getName()}() call`);
    });
  }

  if (violations.length > 0)
    return fail(
      "RLOG-AST-004",
      "No console.* (+ aliases) in AI files (AST)?",
      `${violations.length} violation(s): ${violations.slice(0, 4).join(" | ")}`,
    );

  return pass("RLOG-AST-004", "No console.* (+ aliases) in AI files (AST)?", "Zero console calls in all AI files.");
}

// ─── RLOG-AST-005: Every emit() call site in governed files has traceId ───────

function checkEmitTraceId(project: Project): RlogCheck {
  const violations: string[] = [];

  const GOVERNED_DIRS = [
    ...RUNTIME_LOGGING_CONFIG.aiSourcePaths,
    "src/lib/runtime-logs",
    "src/lib/local-runtime",
  ];

  for (const relDir of GOVERNED_DIRS) {
    const absDir = pathFromRepoRoot(relDir);
    if (!existsSync(absDir)) continue;

    for (const sf of project.getSourceFiles()) {
      const r = relPath(sf);
      if (!r.startsWith(relDir + "/") && r !== relDir) continue;
      if (r.endsWith(".d.ts")) continue;

      sf.forEachDescendant((node) => {
        if (!Node.isCallExpression(node)) return;
        const expr = node.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return;
        if (expr.getName() !== "emit") return;

        const args = node.getArguments();
        if (args.length === 0) return;

        const arg = args[0];
        if (!Node.isObjectLiteralExpression(arg)) return;

        const hasTraceId = arg.getProperties().some(
          (p) =>
            (Node.isPropertyAssignment(p) || Node.isShorthandPropertyAssignment(p)) &&
            p.getName() === "traceId",
        );

        if (!hasTraceId) {
          violations.push(`${r}:${node.getStartLineNumber()} emit() missing traceId field`);
        }
      });
    }
  }

  if (violations.length > 0)
    return fail(
      "RLOG-AST-005",
      "Every emit() call site has traceId property (AST)?",
      `${violations.length} emit() call(s) missing traceId: ${violations.slice(0, 4).join(" | ")}`,
    );

  return pass(
    "RLOG-AST-005",
    "Every emit() call site has traceId property (AST)?",
    "All emit() call sites confirmed to have traceId property.",
  );
}

// ─── RLOG-AST-006: AI four-piece events have actual emit() call sites ─────────

function checkAiFourPieceEmitSites(project: Project): RlogCheck {
  // Collect all string literal values from ObjectLiteralExpressions that are
  // arguments to emit() calls in the AI source dirs.
  const foundEventTypes = new Set<string>();

  const SCAN_DIRS = [...RUNTIME_LOGGING_CONFIG.aiSourcePaths, "src/lib/runtime-logs"];

  for (const sf of project.getSourceFiles()) {
    const r = relPath(sf);
    if (!SCAN_DIRS.some((d) => r.startsWith(d + "/"))) continue;

    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const expr = node.getExpression();
      if (!Node.isPropertyAccessExpression(expr)) return;
      if (expr.getName() !== "emit") return;

      const args = node.getArguments();
      if (args.length === 0) return;
      const arg = args[0];
      if (!Node.isObjectLiteralExpression(arg)) return;

      // Look for eventType property — value must be a StringLiteral
      const eventTypeProp = arg.getProperty("eventType");
      if (!eventTypeProp || !Node.isPropertyAssignment(eventTypeProp)) return;
      const init = eventTypeProp.getInitializer();
      if (!init) return;

      // Direct string literal: emit({ eventType: "AI_REQUEST_DEBUG", ... })
      if (Node.isStringLiteral(init)) {
        foundEventTypes.add(init.getLiteralText());
        return;
      }

      // Identifier referencing a string constant: const EVT = "AI_REQUEST_DEBUG"; emit({ eventType: EVT })
      if (Node.isIdentifier(init)) {
        const defs = init.getDefinitions();
        for (const def of defs) {
          const decl = def.getDeclarationNode();
          if (decl && Node.isVariableDeclaration(decl)) {
            const val = decl.getInitializer();
            if (val && Node.isStringLiteral(val)) {
              foundEventTypes.add(val.getLiteralText());
            }
          }
        }
      }

      // Property-access constant: EventTypes.AI_REQUEST_DEBUG
      if (Node.isPropertyAccessExpression(init)) {
        const sym = init.getNameNode().getSymbol();
        const decl = sym?.getDeclarations()[0];
        if (decl && Node.isPropertyAssignment(decl)) {
          const val = decl.getInitializer();
          if (val && Node.isStringLiteral(val)) {
            foundEventTypes.add(val.getLiteralText());
          }
        }
      }
    });
  }

  const missing = RUNTIME_LOGGING_CONFIG.aiRequiredEventTypes.filter((e) => !foundEventTypes.has(e));
  if (missing.length > 0)
    return fail(
      "RLOG-AST-006",
      "AI four-piece events all have emit() call sites (AST)?",
      `Missing emit() call sites for: ${missing.join(", ")}`,
    );

  return pass(
    "RLOG-AST-006",
    "AI four-piece events all have emit() call sites (AST)?",
    `All four AI events (${RUNTIME_LOGGING_CONFIG.aiRequiredEventTypes.join(", ")}) confirmed as emit() call sites.`,
  );
}

// ─── RLOG-AST-007: traceId value never resolves to randomUUID symbol ──────────
//
// Symbol-level check: follows import declarations to confirm that any identifier
// named "randomUUID" (or bound to it) is not the crypto.randomUUID symbol AND
// is not used as a traceId initializer in any emit() call in governed files.

function checkNoRandomUuidAsTraceId(project: Project): RlogCheck {
  const violations: string[] = [];

  const GOVERNED_FILES = [
    "src/capabilities/ai/runtime/model-call.ts",
    "src/capabilities/ai/children/visual-mission-judge-once.ts",
    "src/lib/online-ai/gemini-client.ts",
  ];

  for (const relFilePath of GOVERNED_FILES) {
    const sf = getSfOrNull(project, relFilePath);
    if (!sf) continue;

    // Build a set of local names that ARE bound to crypto.randomUUID
    const cryptoRandomUuidNames = new Set<string>();

    for (const importDecl of sf.getImportDeclarations()) {
      const moduleSpec = importDecl.getModuleSpecifierValue();
      // Only flag the actual crypto module
      if (moduleSpec !== "node:crypto" && moduleSpec !== "crypto") continue;

      for (const namedImport of importDecl.getNamedImports()) {
        if (namedImport.getName() === "randomUUID") {
          // Alias: import { randomUUID as uid } from 'node:crypto'
          const alias = namedImport.getAliasNode()?.getText();
          cryptoRandomUuidNames.add(alias ?? "randomUUID");
        }
      }

      // Default import: import crypto from 'node:crypto'
      const defaultImport = importDecl.getDefaultImport();
      if (defaultImport) {
        // crypto.randomUUID() — track the namespace
        cryptoRandomUuidNames.add(defaultImport.getText() + ".randomUUID");
      }
    }

    // Walk all emit() calls and check traceId initializer
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const expr = node.getExpression();
      if (!Node.isPropertyAccessExpression(expr)) return;
      if (expr.getName() !== "emit") return;

      const args = node.getArguments();
      if (args.length === 0) return;
      const arg = args[0];
      if (!Node.isObjectLiteralExpression(arg)) return;

      const traceIdProp = arg.getProperty("traceId");
      if (!traceIdProp || !Node.isPropertyAssignment(traceIdProp)) return;

      const init = traceIdProp.getInitializer();
      if (!init) return;

      // Helper: does this expression call a crypto.randomUUID-bound name?
      function callsRandomUuid(expr_: typeof init): boolean {
        // Direct call: randomUUID()
        if (Node.isCallExpression(expr_)) {
          const callee = expr_.getExpression();
          if (Node.isIdentifier(callee) && cryptoRandomUuidNames.has(callee.getText())) return true;
          // method call: crypto.randomUUID()
          if (Node.isPropertyAccessExpression(callee)) {
            const obj = callee.getExpression();
            const method = callee.getName();
            if (Node.isIdentifier(obj) && method === "randomUUID") {
              // check if obj is the crypto default import
              const sym = obj.getSymbol();
              const decl = sym?.getDeclarations()[0];
              if (decl && Node.isImportClause(decl)) return true;
            }
          }
        }

        // Nullish coalescing / binary: a ?? randomUUID() or randomUUID() ?? b
        if (Node.isBinaryExpression(expr_)) {
          return callsRandomUuid(expr_.getLeft()) || callsRandomUuid(expr_.getRight());
        }

        // Conditional: x ? randomUUID() : y
        if (Node.isConditionalExpression(expr_)) {
          return callsRandomUuid(expr_.getWhenTrue()) || callsRandomUuid(expr_.getWhenFalse());
        }

        return false;
      }

      if (callsRandomUuid(init)) {
        violations.push(
          `${relFilePath}:${node.getStartLineNumber()} traceId uses crypto.randomUUID() — traceId must propagate from mission context`,
        );
      }
    });
  }

  if (violations.length > 0)
    return fail(
      "RLOG-AST-007",
      "traceId never sourced from randomUUID symbol (AST + symbol)?",
      violations.join(" | "),
    );

  return pass(
    "RLOG-AST-007",
    "traceId never sourced from randomUUID symbol (AST + symbol)?",
    "No emit() call site uses crypto.randomUUID as traceId source.",
  );
}

// ─── RLOG-AST-008: runtimeLogger passed to createConfiguredAiAbilityGroup ─────

function checkRuntimeLoggerInjection(project: Project): RlogCheck {
  const sf = getSfOrNull(project, "src/lib/local-runtime/workbench-assembly.ts");
  if (!sf)
    return fail(
      "RLOG-AST-008",
      "runtimeLogger passed to createConfiguredAiAbilityGroup (AST)?",
      "workbench-assembly.ts not found.",
    );

  let found = false;

  sf.forEachDescendant((node) => {
    if (found) return;
    if (!Node.isCallExpression(node)) return;
    const expr = node.getExpression();
    if (!Node.isIdentifier(expr)) return;
    if (expr.getText() !== "createConfiguredAiAbilityGroup") return;

    const args = node.getArguments();
    if (args.length === 0) return;
    const arg = args[0];
    if (!Node.isObjectLiteralExpression(arg)) return;

    const hasRuntimeLogger = arg.getProperties().some(
      (p) =>
        (Node.isPropertyAssignment(p) || Node.isShorthandPropertyAssignment(p)) &&
        p.getName() === "runtimeLogger",
    );

    if (hasRuntimeLogger) found = true;
  });

  if (!found)
    return fail(
      "RLOG-AST-008",
      "runtimeLogger passed to createConfiguredAiAbilityGroup (AST)?",
      "createConfiguredAiAbilityGroup called without runtimeLogger in argument object — AI events silently dropped.",
    );

  return pass(
    "RLOG-AST-008",
    "runtimeLogger passed to createConfiguredAiAbilityGroup (AST)?",
    "runtimeLogger confirmed as argument property in createConfiguredAiAbilityGroup call.",
  );
}

// ─── RLOG-AST-009: RuntimeLogger type has isDebugEnabled / isTraceEnabled ─────

function checkLoggerHelperMethods(project: Project): RlogCheck {
  const sf = getSfOrNull(project, "src/lib/runtime-logs/logger.ts");
  if (!sf)
    return fail(
      "RLOG-AST-009",
      "RuntimeLogger has isDebugEnabled/isTraceEnabled methods (AST)?",
      "logger.ts not found.",
    );

  // RuntimeLogger is a type alias with a TypeLiteral in this project.
  const typeAlias = sf.getTypeAlias("RuntimeLogger");
  if (!typeAlias)
    return fail(
      "RLOG-AST-009",
      "RuntimeLogger has isDebugEnabled/isTraceEnabled methods (AST)?",
      "RuntimeLogger type alias not found in logger.ts.",
    );

  const typeNode = typeAlias.getTypeNode();
  if (!typeNode || !Node.isTypeLiteral(typeNode))
    return fail(
      "RLOG-AST-009",
      "RuntimeLogger has isDebugEnabled/isTraceEnabled methods (AST)?",
      "RuntimeLogger type node is not a TypeLiteral.",
    );

  // Use getMembers() to cover both PropertySignature and MethodSignature;
  // filter to named members only (excludes CallSignature, IndexSignature, etc.)
  const declaredNames = typeNode
    .getMembers()
    .filter((m): m is Extract<typeof m, { getName(): string }> =>
      Node.isPropertySignature(m) || Node.isMethodSignature(m),
    )
    .map((m) => m.getName());
  const missing = RUNTIME_LOGGING_CONFIG.loggerHelperMethods.filter(
    (m) => !declaredNames.includes(m),
  );

  if (missing.length > 0)
    return fail(
      "RLOG-AST-009",
      "RuntimeLogger has isDebugEnabled/isTraceEnabled methods (AST)?",
      `RuntimeLogger is missing helper methods: ${missing.join(", ")}`,
    );

  return pass(
    "RLOG-AST-009",
    "RuntimeLogger has isDebugEnabled/isTraceEnabled methods (AST)?",
    `isDebugEnabled and isTraceEnabled confirmed as RuntimeLogger members.`,
  );
}

// ─── RLOG-AST-010: All boundary event types have emit() call sites in src/** ──
//
// Scans all src/** SourceFiles for:
//   a) obj.emit({ eventType: ... }) method calls
//   b) emitRuntimeLog({ eventType: ... }) standalone function calls
// Collects eventType string values from those calls. Handles StringLiteral,
// Identifier→definition, PropertyAccessExpression→symbol, and ConditionalExpression
// (ternary) by traversing both branches. Excludes event-types.ts.

function extractEventTypeStrings(init: Node, out: Set<string>): void {
  if (Node.isStringLiteral(init)) {
    out.add(init.getLiteralText());
    return;
  }
  // Strip type assertion (as ...) and parenthesized wrappers
  if (Node.isAsExpression(init)) {
    extractEventTypeStrings(init.getExpression(), out);
    return;
  }
  if (Node.isParenthesizedExpression(init)) {
    extractEventTypeStrings(init.getExpression(), out);
    return;
  }
  if (Node.isConditionalExpression(init)) {
    extractEventTypeStrings(init.getWhenTrue(), out);
    extractEventTypeStrings(init.getWhenFalse(), out);
    return;
  }
  // Handle binary expressions (e.g. ?? and || operators) — both sides may yield event types
  if (Node.isBinaryExpression(init)) {
    extractEventTypeStrings(init.getLeft(), out);
    extractEventTypeStrings(init.getRight(), out);
    return;
  }
  if (Node.isIdentifier(init)) {
    const defs = init.getDefinitions();
    for (const def of defs) {
      const decl = def.getDeclarationNode();
      if (decl && Node.isVariableDeclaration(decl)) {
        const val = decl.getInitializer();
        if (val) extractEventTypeStrings(val, out);
      }
    }
    return;
  }
  if (Node.isPropertyAccessExpression(init)) {
    const sym = init.getNameNode().getSymbol();
    const decl = sym?.getDeclarations()[0];
    if (decl && Node.isPropertyAssignment(decl)) {
      const val = decl.getInitializer();
      if (val) extractEventTypeStrings(val, out);
    }
  }
}

function checkBoundaryEventEmitSites(project: Project): RlogCheck {
  const foundEventTypes = new Set<string>();

  for (const sf of project.getSourceFiles()) {
    const r = relPath(sf);
    // Only production src code; skip event-types.ts (the registry) and .d.ts
    if (!r.startsWith("src/")) continue;
    if (r.endsWith("event-types.ts")) continue;
    if (r.endsWith(".d.ts")) continue;

    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;

      const expr = node.getExpression();

      // Accept both obj.emit(...) and emitRuntimeLog(...)
      const isMethodEmit =
        Node.isPropertyAccessExpression(expr) && expr.getName() === "emit";
      const isStandaloneEmit =
        Node.isIdentifier(expr) && expr.getText() === "emitRuntimeLog";

      if (!isMethodEmit && !isStandaloneEmit) return;

      const args = node.getArguments();
      if (args.length === 0) return;
      const arg = args[0];
      if (!Node.isObjectLiteralExpression(arg)) return;

      const eventTypeProp = arg.getProperty("eventType");
      if (!eventTypeProp) return;

      let init: Node | undefined;
      if (Node.isPropertyAssignment(eventTypeProp)) {
        init = eventTypeProp.getInitializer();
      } else if (Node.isShorthandPropertyAssignment(eventTypeProp)) {
        // { eventType } shorthand — the variable name IS the identifier to resolve
        init = eventTypeProp.getNameNode();
      }
      if (!init) return;

      extractEventTypeStrings(init, foundEventTypes);
    });
  }

  const missing = RUNTIME_LOGGING_CONFIG.boundaryEventTypes.filter(
    (e) => !foundEventTypes.has(e),
  );

  if (missing.length > 0)
    return fail(
      "RLOG-AST-010",
      "All boundary event types have emit() call sites in src/** (AST)?",
      `Missing emit() call sites for: ${missing.join(", ")}`,
    );

  return pass(
    "RLOG-AST-010",
    "All boundary event types have emit() call sites in src/** (AST)?",
    `All ${RUNTIME_LOGGING_CONFIG.boundaryEventTypes.length} boundary event types confirmed as emit() call sites.`,
  );
}

// ─── RLOG-AST-011: Heavy payload tokens must be inside isTraceEnabled() guard ─
//
// Scan all src/** files for emit() calls. If the argument object has a direct
// property whose name is in heavyPayloadTokens, the emit() call must be enclosed
// in an if-statement whose condition includes an isTraceEnabled() call expression.

function checkHeavyPayloadGuards(project: Project): RlogCheck {
  const violations: string[] = [];

  for (const sf of project.getSourceFiles()) {
    const r = relPath(sf);
    if (!r.startsWith("src/")) continue;
    if (r.endsWith(".d.ts")) continue;

    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const expr = node.getExpression();
      if (!Node.isPropertyAccessExpression(expr)) return;
      if (expr.getName() !== "emit") return;

      const args = node.getArguments();
      if (args.length === 0) return;
      const arg = args[0];
      if (!Node.isObjectLiteralExpression(arg)) return;

      // Check if any direct property of the argument is a heavy token
      const hasHeavyToken = arg.getProperties().some((p) => {
        if (Node.isPropertyAssignment(p) || Node.isShorthandPropertyAssignment(p)) {
          return (RUNTIME_LOGGING_CONFIG.heavyPayloadTokens as readonly string[]).includes(p.getName());
        }
        return false;
      });

      if (!hasHeavyToken) return;

      // Heavy token found — verify it is inside an isTraceEnabled() if-guard
      let ancestor = node.getParent();
      let guarded = false;
      while (ancestor) {
        if (Node.isIfStatement(ancestor)) {
          const condText = ancestor.getExpression().getText();
          if (condText.includes("isTraceEnabled")) {
            guarded = true;
            break;
          }
        }
        ancestor = ancestor.getParent();
      }

      if (!guarded) {
        violations.push(
          `${r}:${node.getStartLineNumber()} emit() has heavy payload token without isTraceEnabled() guard`,
        );
      }
    });
  }

  if (violations.length > 0)
    return fail(
      "RLOG-AST-011",
      "Heavy payload tokens in emit() args guarded by isTraceEnabled() (AST)?",
      `${violations.length} unguarded heavy token(s): ${violations.slice(0, 3).join(" | ")}`,
    );

  return pass(
    "RLOG-AST-011",
    "Heavy payload tokens in emit() args guarded by isTraceEnabled() (AST)?",
    "No unguarded heavy payload tokens found in emit() call arguments.",
  );
}

// ─── Inspector entry point ────────────────────────────────────────────────────

export function runRuntimeLoggingInspector(): RuntimeLoggingInspectorResult {
  const project = getAuditProject();
  project.addSourceFilesFromTsConfig(pathFromRepoRoot("tsconfig.json"));

  const checks: RlogCheck[] = [
    checkRlogFileCount(),
    checkLawFile(),
    checkSchemaInterface(project),
    checkModeStringLiterals(project),
    checkRedactionExport(project),
    checkConsoleInAiFiles(project),
    checkEmitTraceId(project),
    checkAiFourPieceEmitSites(project),
    checkNoRandomUuidAsTraceId(project),
    checkRuntimeLoggerInjection(project),
    checkLoggerHelperMethods(project),
    checkBoundaryEventEmitSites(project),
    checkHeavyPayloadGuards(project),
  ];

  const hardFails = checks.filter((c) => c.status === "FAIL").length;

  return { checks, hardFails, pass: hardFails === 0 };
}
