import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const files = [
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.schema.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.parser.ts",
] as const;

const retiredSupplementAlias = decode("b3B0aW9uYWxDb250ZW50");
let supplementalContentSeen = false;
for (const file of files) {
  const text = readFileSync(file, "utf8");
  supplementalContentSeen = supplementalContentSeen || text.includes("supplementalContent");
  assert(!text.includes(retiredSupplementAlias), `${file} must not contain the retired supplemental alias.`);
}
assert(supplementalContentSeen, "PromptBundle prompt/schema/parser path must contain supplementalContent.");

process.stdout.write("[ACCEPTANCE][deep-research-promptbundle-field-consistency] PASS\n");
