import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";

type Finding = { code: string; detail: string; path: string };

export const inspectGeneratedArtifactTruth = (root: string, source: SourceFile): Finding[] => {
  const findings: Finding[] = [];
  const generated = readdirSync(resolve(root, "scripts/audit/generated")).filter((name) => !name.startsWith(".")).sort();
  if (generated.length !== 1 || generated[0] !== "law-registry.generated.json") findings.push({ code: "AUDIT_GENERATED_TRUTH_MULTIPLIED", detail: generated.join(","), path: "scripts/audit/generated" });
  const builder = source.getFunction("buildRegistry");
  const forbiddenCalls = builder?.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) => {
    const expression = call.getExpression();
    if (Node.isIdentifier(expression) && expression.getSymbol()?.getName() === "fetch") return ["fetch"];
    if (!Node.isPropertyAccessExpression(expression)) return [];
    const owner = expression.getExpression();
    if (!Node.isIdentifier(owner)) return [];
    const method = expression.getName();
    const ownerName = owner.getSymbol()?.getName();
    return ((ownerName === "Date" && method === "now") || (ownerName === "Math" && method === "random"))
      ? [`${ownerName}.${method}`]
      : [];
  }) ?? [];
  if (forbiddenCalls.length) findings.push({ code: "AUDIT_REGISTRY_NONDETERMINISTIC", detail: forbiddenCalls.join(","), path: source.getFilePath() });
  return findings;
};
