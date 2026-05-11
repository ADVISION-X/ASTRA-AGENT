import { runGeometryGuardInspector } from "./inspector.js";

const { pass, results } = runGeometryGuardInspector();

console.log("\n=== Geometry Guard Capability Inspector ===\n");
for (const result of results) {
  console.log(result.message);
}

console.log(`\nOverall: ${pass ? "✅ PASS" : "❌ FAIL"}\n`);

if (!pass) {
  process.exit(1);
}
