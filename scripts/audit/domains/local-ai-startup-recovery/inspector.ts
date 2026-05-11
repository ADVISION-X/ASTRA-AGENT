/**
 * Local AI Startup Recovery Inspector
 *
 * LAW:  docs/法案辅助文件/GrassEye 唯一启动入口与终端结构化日志施工图.md
 *       §"自动启动 Ollama 实施规格（allowRecovery 合约）"
 *
 * ENFORCES (AST-level, ts-morph, symbol-level, anti-escape):
 *   CHECK-1  scripts/startup/lib/local-ai-runtime-readiness-probe.ts
 *            imports `spawn` from "node:child_process"
 *   CHECK-2  The probe reads GRASSEYE_LOCAL_AI_ALLOW_RECOVERY env var at module level
 *   CHECK-3  There exists a call to spawn() with "ollama" and "serve" as arguments
 *   CHECK-4  That spawn call sets `detached: true` in its options object
 *   CHECK-5  The probe contains a polling / timeout loop (setTimeout or setInterval call)
 *
 * All checks use AST traversal.  No regex.  No string-content heuristics on comment lines.
 */

import { Node, Project, SyntaxKind } from "ts-morph";
import { join } from "node:path";

const PROBE_REL_PATH = "scripts/startup/lib/local-ai-runtime-readiness-probe.ts";

export type LocalAiStartupRecoveryCheckResult = {
  checkId: string;
  question: string;
  status: "PASS" | "FAIL";
  detail: string;
};

export type LocalAiStartupRecoveryInspectorResult = {
  checks: LocalAiStartupRecoveryCheckResult[];
  overallStatus: "PASS" | "FAIL";
};

// ── helpers ──────────────────────────────────────────────────────────────────

function pass(checkId: string, question: string, detail: string): LocalAiStartupRecoveryCheckResult {
  return { checkId, question, status: "PASS", detail };
}

function fail(checkId: string, question: string, detail: string): LocalAiStartupRecoveryCheckResult {
  return { checkId, question, status: "FAIL", detail };
}

// ── main ─────────────────────────────────────────────────────────────────────

export function runLocalAiStartupRecoveryInspector(): LocalAiStartupRecoveryInspectorResult {
  const repoRoot = process.cwd();
  const probeAbsPath = join(repoRoot, PROBE_REL_PATH);

  const project = new Project({
    tsConfigFilePath: join(repoRoot, "tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });
  const sf = project.addSourceFileAtPathIfExists(probeAbsPath);

  if (!sf) {
    const checks: LocalAiStartupRecoveryCheckResult[] = [
      fail("CHECK-1", "probe file exists", `File not found: ${PROBE_REL_PATH}`),
      fail("CHECK-2", "probe reads GRASSEYE_LOCAL_AI_ALLOW_RECOVERY", "File not found — cannot check."),
      fail("CHECK-3", "probe calls spawn('ollama', ['serve', ...])", "File not found — cannot check."),
      fail("CHECK-4", "spawn detached:true is set", "File not found — cannot check."),
      fail("CHECK-5", "probe has polling/timeout loop", "File not found — cannot check."),
    ];
    return { checks, overallStatus: "FAIL" };
  }

  const checks: LocalAiStartupRecoveryCheckResult[] = [];

  // ── CHECK-1: imports spawn from node:child_process ──────────────────────
  {
    const q = "probe imports `spawn` from \"node:child_process\"";
    const importDecl = sf.getImportDeclarations().find((d) => {
      const mod = d.getModuleSpecifierValue();
      return mod === "node:child_process" || mod === "child_process";
    });
    const importsSpawn = importDecl?.getNamedImports().some((n) => n.getName() === "spawn") ?? false;
    checks.push(
      importsSpawn
        ? pass("CHECK-1", q, "spawn imported from node:child_process")
        : fail("CHECK-1", q, `No import of 'spawn' from 'node:child_process' found in ${PROBE_REL_PATH}`)
    );
  }

  // ── CHECK-2: reads GRASSEYE_LOCAL_AI_ALLOW_RECOVERY ─────────────────────
  {
    const q = "probe reads process.env.GRASSEYE_LOCAL_AI_ALLOW_RECOVERY";
    // AST: look for any PropertyAccessExpression whose last name is GRASSEYE_LOCAL_AI_ALLOW_RECOVERY
    // AND is accessed on `process.env` (PropertyAccessExpression chain)
    let found = false;
    sf.forEachDescendant((node) => {
      if (!Node.isPropertyAccessExpression(node)) return;
      if (node.getName() !== "GRASSEYE_LOCAL_AI_ALLOW_RECOVERY") return;
      const expr = node.getExpression();
      if (Node.isPropertyAccessExpression(expr) && expr.getName() === "env") {
        const envExpr = expr.getExpression();
        if (Node.isIdentifier(envExpr) && envExpr.getText() === "process") {
          found = true;
        }
      }
    });
    checks.push(
      found
        ? pass("CHECK-2", q, "process.env.GRASSEYE_LOCAL_AI_ALLOW_RECOVERY access found (AST symbol-level)")
        : fail("CHECK-2", q, `No process.env.GRASSEYE_LOCAL_AI_ALLOW_RECOVERY access in ${PROBE_REL_PATH}. The allowRecovery contract is broken.`)
    );
  }

  // ── CHECK-3: calls spawn("ollama", ...) ──────────────────────────────────
  {
    const q = "probe calls spawn(\"ollama\", [\"serve\", ...])";
    let spawnCallNode: Node | undefined;
    sf.forEachDescendant((node) => {
      if (spawnCallNode) return;
      if (!Node.isCallExpression(node)) return;
      const expr = node.getExpression();
      // Must be bare `spawn(...)` identifier call — not spawn.something
      if (!Node.isIdentifier(expr) || expr.getText() !== "spawn") return;
      const args = node.getArguments();
      if (args.length < 2) return;
      // First arg must be string literal "ollama"
      const firstArg = args[0];
      const firstArgText = Node.isStringLiteral(firstArg) ? firstArg.getLiteralText() : undefined;
      if (firstArgText !== "ollama") return;
      // Second arg must be an ArrayLiteralExpression containing string "serve"
      const secondArg = args[1];
      if (!Node.isArrayLiteralExpression(secondArg)) return;
      const hasServe = secondArg.getElements().some(
        (el) => Node.isStringLiteral(el) && el.getLiteralText() === "serve"
      );
      if (!hasServe) return;
      spawnCallNode = node;
    });
    checks.push(
      spawnCallNode
        ? pass("CHECK-3", q, "spawn(\"ollama\", [\"serve\", ...]) call found (AST symbol-level)")
        : fail("CHECK-3", q, `No spawn("ollama", ["serve", ...]) call found in ${PROBE_REL_PATH}. Ollama auto-start is not implemented.`)
    );
  }

  // ── CHECK-4: spawn call has detached:true ────────────────────────────────
  {
    const q = "spawn call uses detached:true";
    let detachedFound = false;
    sf.forEachDescendant((node) => {
      if (detachedFound) return;
      if (!Node.isCallExpression(node)) return;
      const expr = node.getExpression();
      if (!Node.isIdentifier(expr) || expr.getText() !== "spawn") return;
      const args = node.getArguments();
      if (args.length < 3) return;
      const optionsArg = args[2];
      // Must be an ObjectLiteralExpression
      if (!Node.isObjectLiteralExpression(optionsArg)) return;
      // Look for property `detached` with value `true`
      optionsArg.getProperties().forEach((prop) => {
        if (!Node.isPropertyAssignment(prop)) return;
        const key = prop.getNameNode();
        const keyText = Node.isIdentifier(key) ? key.getText() : undefined;
        if (keyText !== "detached") return;
        const val = prop.getInitializer();
        if (val && val.getKind() === SyntaxKind.TrueKeyword) {
          detachedFound = true;
        }
      });
    });
    checks.push(
      detachedFound
        ? pass("CHECK-4", q, "spawn options object contains detached:true (AST symbol-level)")
        : fail("CHECK-4", q, `spawn call in ${PROBE_REL_PATH} does not set detached:true. Probe may hold the child process reference — violates allowRecovery contract.`)
    );
  }

  // ── CHECK-5: has polling / timeout loop ──────────────────────────────────
  {
    const q = "probe contains polling/timeout loop (setTimeout or setInterval)";
    let timeoutCallFound = false;
    sf.forEachDescendant((node) => {
      if (timeoutCallFound) return;
      if (!Node.isCallExpression(node)) return;
      const expr = node.getExpression();
      const name = Node.isIdentifier(expr) ? expr.getText() : undefined;
      if (name === "setTimeout" || name === "setInterval") {
        timeoutCallFound = true;
      }
    });
    checks.push(
      timeoutCallFound
        ? pass("CHECK-5", q, "setTimeout/setInterval polling call found (AST symbol-level)")
        : fail("CHECK-5", q, `No setTimeout/setInterval found in ${PROBE_REL_PATH}. Polling wait loop is missing — probe cannot reliably wait for Ollama startup.`)
    );
  }

  const overallStatus: "PASS" | "FAIL" = checks.every((c) => c.status === "PASS") ? "PASS" : "FAIL";
  return { checks, overallStatus };
}
