import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(sourceDir, "dist");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
for (const name of [
  "protocol",
  "service-worker-session-crypto",
  "service-worker-command-execution",
  "atomic-dom-command",
  "service-worker-interaction-commands",
  "service-worker-keyboard",
  "service-worker-native-transport",
  "service-worker",
]) {
  const source = await readFile(path.join(sourceDir, `${name}.ts`), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      strict: true,
    },
    fileName: `${name}.ts`,
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter((diagnostic) =>
    diagnostic.category === ts.DiagnosticCategory.Error);
  if (errors.length > 0) {
    throw new Error(`extension TypeScript transpile failed: ${errors.map((item) => item.messageText).join("; ")}`);
  }
  await writeFile(path.join(distDir, `${name}.js`), result.outputText, { mode: 0o600 });
}
await writeFile(
  path.join(distDir, "manifest.json"),
  await readFile(path.join(sourceDir, "manifest.json")),
  { mode: 0o600 },
);
process.stdout.write(`${JSON.stringify({ status: "PASS", distDir })}\n`);
