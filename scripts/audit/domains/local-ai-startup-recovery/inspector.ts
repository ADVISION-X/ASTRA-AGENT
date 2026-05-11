/**
 * Local AI Startup Recovery Inspector
 *
 * LAW:  docs/法案辅助文件/GrassEye 唯一启动入口与终端结构化日志施工图.md
 *       §"自动启动 Ollama 实施规格（allowRecovery 合约）"
 *       docs/法案辅助文件/GrassEye 本地模型选型施工图.md
 *       §"Local AI 模型输入图片安全边界"
 *
 * ENFORCES (AST-level, ts-morph, symbol-level, anti-escape):
 *   CHECK-1  scripts/startup/lib/local-ai-runtime-readiness-probe.ts
 *            imports `spawn` from "node:child_process"
 *   CHECK-2  The probe reads GRASSEYE_LOCAL_AI_ALLOW_RECOVERY env var at module level
 *   CHECK-3  There exists a call to spawn() with "ollama" and "serve" as arguments
 *   CHECK-4  That spawn call sets `detached: true` in its options object
 *   CHECK-5  The probe contains a polling / timeout loop (setTimeout or setInterval call)
 *   CHECK-6  src/lib/local-ai/model-safe-image.ts exists
 *   CHECK-7  MAX_VISION_IMAGE_LONG_EDGE_PX = 1120 is declared in model-safe-image.ts (AST)
 *   CHECK-8  sharp().metadata() call exists in model-safe-image.ts (AST)
 *   CHECK-9  sharp().resize() with fit:"inside" and withoutEnlargement:true exists (AST)
 *   CHECK-10 No writeFile / copyFile calls in model-safe-image.ts (no writes to disk)
 *   CHECK-11 call-local-model.ts AI_REQUEST_DEBUG contains wasResized image dimension info
 *
 * All checks use AST traversal.  No regex.  No string-content heuristics on comment lines.
 */

import { Node, Project, SyntaxKind } from "ts-morph";
import { join } from "node:path";
import { existsSync } from "node:fs";

const PROBE_REL_PATH = "scripts/startup/lib/local-ai-runtime-readiness-probe.ts";
const MODEL_SAFE_IMAGE_REL_PATH = "src/lib/local-ai/model-safe-image.ts";
const CALL_LOCAL_MODEL_REL_PATH = "src/lib/local-ai/call-local-model.ts";

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

  // ── CHECK-6: model-safe-image.ts exists ──────────────────────────────────
  {
    const q = "src/lib/local-ai/model-safe-image.ts exists";
    const absPath = join(repoRoot, MODEL_SAFE_IMAGE_REL_PATH);
    const exists = existsSync(absPath);
    checks.push(
      exists
        ? pass("CHECK-6", q, `${MODEL_SAFE_IMAGE_REL_PATH} found on disk`)
        : fail("CHECK-6", q, `${MODEL_SAFE_IMAGE_REL_PATH} not found. Image normalization gate is missing.`)
    );
  }

  // ── Checks 7–10 require model-safe-image.ts to be parseable ─────────────
  const msiAbsPath = join(repoRoot, MODEL_SAFE_IMAGE_REL_PATH);
  const msiSf = project.addSourceFileAtPathIfExists(msiAbsPath);

  if (!msiSf) {
    checks.push(
      fail("CHECK-7", "MAX_VISION_IMAGE_LONG_EDGE_PX = 1120 declared (AST)", `${MODEL_SAFE_IMAGE_REL_PATH} not parseable — cannot check.`),
      fail("CHECK-8", "sharp().metadata() call exists (AST)", `${MODEL_SAFE_IMAGE_REL_PATH} not parseable — cannot check.`),
      fail("CHECK-9", "sharp resize with fit:inside and withoutEnlargement:true (AST)", `${MODEL_SAFE_IMAGE_REL_PATH} not parseable — cannot check.`),
      fail("CHECK-10", "no writeFile/copyFile calls in model-safe-image.ts (no disk writes)", `${MODEL_SAFE_IMAGE_REL_PATH} not parseable — cannot check.`),
    );
  } else {
    // ── CHECK-7: MAX_VISION_IMAGE_LONG_EDGE_PX = 1120 ─────────────────────
    {
      const q = "MAX_VISION_IMAGE_LONG_EDGE_PX = 1120 declared in model-safe-image.ts";
      let found = false;
      msiSf.forEachDescendant((node) => {
        if (found) return;
        // Look for: export const MAX_VISION_IMAGE_LONG_EDGE_PX = 1120
        if (!Node.isVariableDeclaration(node)) return;
        const nameNode = node.getNameNode();
        if (!Node.isIdentifier(nameNode)) return;
        if (nameNode.getText() !== "MAX_VISION_IMAGE_LONG_EDGE_PX") return;
        const init = node.getInitializer();
        if (!init) return;
        // Value must be numeric literal 1120
        if (Node.isNumericLiteral(init) && init.getLiteralText() === "1120") {
          found = true;
        }
      });
      checks.push(
        found
          ? pass("CHECK-7", q, "MAX_VISION_IMAGE_LONG_EDGE_PX = 1120 found (AST symbol-level)")
          : fail("CHECK-7", q, `MAX_VISION_IMAGE_LONG_EDGE_PX = 1120 not found in ${MODEL_SAFE_IMAGE_REL_PATH}. Pixel dimension gate is missing or wrong value.`)
      );
    }

    // ── CHECK-8: sharp().metadata() call ──────────────────────────────────
    {
      const q = "sharp().metadata() call exists in model-safe-image.ts";
      let found = false;
      msiSf.forEachDescendant((node) => {
        if (found) return;
        if (!Node.isCallExpression(node)) return;
        const expr = node.getExpression();
        // PropertyAccessExpression: <expr>.metadata
        if (!Node.isPropertyAccessExpression(expr)) return;
        if (expr.getName() !== "metadata") return;
        found = true;
      });
      checks.push(
        found
          ? pass("CHECK-8", q, ".metadata() call found (AST symbol-level)")
          : fail("CHECK-8", q, `No .metadata() call found in ${MODEL_SAFE_IMAGE_REL_PATH}. Pixel dimension reading is missing.`)
      );
    }

    // ── CHECK-9: resize({ fit:"inside", withoutEnlargement:true }) ─────────
    {
      const q = "sharp().resize() with fit:\"inside\" and withoutEnlargement:true exists";
      let fitInsideFound = false;
      let noEnlargeFound = false;

      msiSf.forEachDescendant((node) => {
        if (!Node.isCallExpression(node)) return;
        const expr = node.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) return;
        if (expr.getName() !== "resize") return;
        const args = node.getArguments();
        const optArg = args[0];
        if (!optArg || !Node.isObjectLiteralExpression(optArg)) return;

        optArg.getProperties().forEach((prop) => {
          if (!Node.isPropertyAssignment(prop)) return;
          const keyNode = prop.getNameNode();
          const key = Node.isIdentifier(keyNode) ? keyNode.getText() : undefined;
          const val = prop.getInitializer();
          if (!val) return;
          if (key === "fit" && Node.isStringLiteral(val) && val.getLiteralText() === "inside") {
            fitInsideFound = true;
          }
          if (key === "withoutEnlargement" && val.getKind() === SyntaxKind.TrueKeyword) {
            noEnlargeFound = true;
          }
        });
      });

      const ok = fitInsideFound && noEnlargeFound;
      checks.push(
        ok
          ? pass("CHECK-9", q, `resize({ fit:"inside", withoutEnlargement:true }) found (AST symbol-level)`)
          : fail("CHECK-9", q,
              `resize options incomplete in ${MODEL_SAFE_IMAGE_REL_PATH}: ` +
              `fit:"inside"=${fitInsideFound}, withoutEnlargement:true=${noEnlargeFound}. ` +
              `Resize must maintain aspect ratio and never enlarge.`
            )
      );
    }

    // ── CHECK-10: no writeFile / copyFile calls (no disk writes) ──────────
    {
      const q = "no writeFile/copyFile calls in model-safe-image.ts (model input stays in-memory)";
      const forbidden = ["writeFile", "copyFile", "createWriteStream"];
      const found: string[] = [];
      msiSf.forEachDescendant((node) => {
        if (!Node.isCallExpression(node)) return;
        const expr = node.getExpression();
        const name = Node.isIdentifier(expr)
          ? expr.getText()
          : Node.isPropertyAccessExpression(expr)
          ? expr.getName()
          : undefined;
        if (name && forbidden.includes(name)) {
          found.push(name);
        }
      });
      checks.push(
        found.length === 0
          ? pass("CHECK-10", q, "No disk-write calls found — model input stays in-memory (AST)")
          : fail("CHECK-10", q, `Forbidden disk-write calls found in ${MODEL_SAFE_IMAGE_REL_PATH}: ${found.join(", ")}. Model input must not be written to disk.`)
      );
    }
  }

  // ── CHECK-11: call-local-model.ts AI_REQUEST_DEBUG includes wasResized ───
  {
    const q = "call-local-model.ts AI_REQUEST_DEBUG includes image dimension / wasResized metadata";
    const clmAbsPath = join(repoRoot, CALL_LOCAL_MODEL_REL_PATH);
    const clmSf = project.addSourceFileAtPathIfExists(clmAbsPath);

    if (!clmSf) {
      checks.push(
        fail("CHECK-11", q, `${CALL_LOCAL_MODEL_REL_PATH} not found — cannot check AI_REQUEST_DEBUG metadata.`)
      );
    } else {
      // Look for string literal "wasResized" or identifier wasResized anywhere in the file.
      let wasResizedFound = false;
      clmSf.forEachDescendant((node) => {
        if (wasResizedFound) return;
        if (Node.isStringLiteral(node) && node.getLiteralText().toLowerCase().includes("wasresized")) {
          wasResizedFound = true;
        }
        if (Node.isIdentifier(node) && node.getText() === "wasResized") {
          wasResizedFound = true;
        }
      });
      checks.push(
        wasResizedFound
          ? pass("CHECK-11", q, "wasResized image metadata found in call-local-model.ts (AST symbol-level)")
          : fail("CHECK-11", q, `No wasResized reference found in ${CALL_LOCAL_MODEL_REL_PATH}. AI_REQUEST_DEBUG must include per-image normalization proof.`)
      );
    }
  }

  const overallStatus: "PASS" | "FAIL" = checks.every((c) => c.status === "PASS") ? "PASS" : "FAIL";
  return { checks, overallStatus };
}
