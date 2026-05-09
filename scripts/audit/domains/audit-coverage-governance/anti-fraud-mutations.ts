export type AntiFraudMutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
  command: string[];
  detection: "command-fails" | "summary-law-hash-changes" | "summary-blueprint-hash-changes" | "summary-final-verdict-blocked" | "generated-tamper-rejected";
};

export const AUDIT_COVERAGE_ANTI_FRAUD_MUTATIONS: AntiFraudMutation[] = [
  {
    name: "weaken-open-local-program-law-requirement",
    file: ".github/instructions/cursor-rules/modules/module-open-capability.instructions.md",
    search: "- `open-local-workbench` must not be used to represent macOS local program launch.",
    replace: "- `open-local-workbench` may be reviewed manually for macOS local program launch.",
    command: ["npm", "run", "audit:coverage"],
    detection: "summary-law-hash-changes",
  },
  {
    name: "remove-open-inspector-law-coverage",
    file: "scripts/audit/domains/open-capability/manifest.json",
    search: "\"GRASSEYE-OPEN-CAPABILITY-009-V1\"",
    replace: "\"MUTATED-GRASSEYE-OPEN-CAPABILITY-009-V1\"",
    command: ["npm", "run", "audit:coverage"],
    detection: "summary-final-verdict-blocked",
  },
  {
    name: "introduce-warning-only-p0-blueprint-requirement",
    file: "docs/法案辅助文件/GrassEye Open 能力组施工图.md",
    search: "mustNotCreate:",
    replace: "warning-only P0 optionalCheck:",
    command: ["npm", "run", "audit:coverage"],
    detection: "summary-final-verdict-blocked",
  },
  {
    name: "downgrade-debug-loop-import-graph-to-includes",
    file: "scripts/audit/domains/audit-coverage-governance/enforcement-strength-classifier.ts",
    search: "return \"LEVEL_5_AST_SYMBOL_IMPORT_GRAPH_NEGATIVE_PROOF\";",
    replace: "return \"LEVEL_1_TEXT_INCLUDES_PATH_EXISTS\";",
    command: ["npm", "run", "audit:coverage"],
    detection: "summary-final-verdict-blocked",
  },
  {
    name: "generated-summary-tamper",
    file: "scripts/audit/generated/audit-coverage-summary.generated.json",
    search: "\"finalVerdict\": \"PASS\",",
    replace: "\"finalVerdict\": \"BLOCKED\",",
    command: ["npm", "run", "audit:coverage"],
    detection: "generated-tamper-rejected",
  },
  {
    name: "delete-open-owner-audit-package-script",
    file: "package.json",
    search: "    \"audit:open\": \"node --import tsx scripts/audit/domains/open-capability/run-inspector.ts\",",
    replace: "    \"audit:open:mutated\": \"node --import tsx scripts/audit/domains/open-capability/run-inspector.ts\",",
    command: ["npm", "run", "audit:coverage"],
    detection: "summary-final-verdict-blocked",
  },
];
