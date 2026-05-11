import { runScreenshotInspector } from "./inspector.js";

const results = runScreenshotInspector();
let overallPass = true;

console.log("\n=== Screenshot Capability Inspector ===\n");
for (const check of results) {
  const icon = check.status === "PASS" ? "✅" : check.status === "WARN" ? "⚠️" : "❌";
  console.log(`${icon} [${check.id}] ${check.label}`);
  console.log(`       → ${check.detail}`);
  if (check.status === "FAIL") overallPass = false;
}

console.log(`\n${overallPass ? "✅ PASS" : "❌ FAIL"}: Screenshot Capability Inspector\n`);
process.exit(overallPass ? 0 : 1);
