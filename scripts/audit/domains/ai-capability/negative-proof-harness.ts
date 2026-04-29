import { readFile, unlink, writeFile } from "node:fs/promises";

import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { pathFromRepoRoot } from "../../core/paths.js";

type Mutation = {
  name: string;
  file: string;
  mode?: "replace" | "write";
  search?: string;
  replace?: string;
  content?: string;
};

const INSPECTOR_ENTRY = "scripts/audit/domains/ai-capability/inspector.ts";

const MUTATIONS: Mutation[] = [
  {
    name: "provider gate mutation",
    file: "src/capabilities/ai/runtime/ai-executor.ts",
    search: "evaluateAiProviderPolicy(inputGate.request, input.childContract)",
    replace: '({ decision: "allow", reason: null })',
  },
  {
    name: "schema gate mutation",
    file: "src/capabilities/ai/runtime/ai-executor.ts",
    search: "resolveAiSchemaContract(inputGate.request, promptContract)",
    replace: '({ decision: "resolved", reason: null, schemaId: "mutated", outputSchema: null })',
  },
  {
    name: "quality gate mutation",
    file: "src/capabilities/ai/runtime/ai-executor.ts",
    search: "evaluateAiQualityGate({",
    replace: "evaluateAiQualityGateRemoved({",
  },
  {
    name: "proof builder mutation",
    file: "src/capabilities/ai/runtime/ai-result-builder.ts",
    search: "buildAiRuntimeProof({",
    replace: "buildAiRuntimeProofRemoved({",
  },
  {
    name: "invalid-success mutation",
    file: "src/capabilities/ai/runtime/ai-executor.ts",
    search: 'status: qualityDecision.decision === "review_required" ? "review_required" : "failed"',
    replace: 'status: "success"',
  },
  {
    name: "child-schema-shell mutation",
    file: "src/capabilities/ai/children/local-text-ai/schema.ts",
    search: 'export const LocalTextAiChildInputSchema = LocalTextAiInputSchema.describe("local-text-ai child input");',
    replace: 'export { LocalTextAiInputSchema as LocalTextAiChildInputSchema } from "../../schema.js";',
  },
  {
    name: "future-placeholder mutation",
    file: "src/capabilities/ai/children/future-api-ai/schema.ts",
    search: 'export const FutureApiAiChildInputSchema = z.never().describe("future-api-ai has no executable input while law is frozen");',
    replace: 'export const FutureApiAiSchemaPlaceholder = "future-api-ai";',
  },
  {
    name: "fake-dispatch mutation",
    file: "src/capabilities/ai/runtime/ai-dispatch-failure.ts",
    search: 'const rawInputRef = buildStableAiRef("ai-raw-input", [missionId, sessionId, taskType, input.failureReason]);',
    replace: 'const rawInputRef = "invalid-session";',
  },
  {
    name: "paid gateway mutation",
    file: "src/capabilities/ai/children/paid-analysis-ai/implementation.ts",
    search: 'import { executeAiChild } from "../../runtime/ai-executor.js";',
    replace: 'import { executeAiChild } from "../../runtime/ai-executor.js";\nimport { LocalAiGateway } from "../../../lib/local-ai/local-ai-gateway.js";',
  },
  {
    name: "internal gateway mutation",
    file: "src/capabilities/ai/children/internal-schema-validator/implementation.ts",
    search: 'import { executeAiChild } from "../../runtime/ai-executor.js";',
    replace: 'import { executeAiChild } from "../../runtime/ai-executor.js";\nimport { LocalAiGateway } from "../../../lib/local-ai/local-ai-gateway.js";',
  },
  {
    name: "export star mutation",
    file: "src/capabilities/ai/index.ts",
    search: 'export { listAiChildren } from "./registry.js";',
    replace: 'export { listAiChildren } from "./registry.js";\nexport * from "./schema.js";',
  },
  {
    name: "forbidden import mutation",
    file: "src/capabilities/ai/runtime/ai-executor.ts",
    search: 'import { resolveAiSchemaContract, validateAiInternalCandidate, validateAiRuntimeOutput } from "./ai-schema-gate.js";',
    replace: 'import { resolveAiSchemaContract, validateAiInternalCandidate, validateAiRuntimeOutput } from "./ai-schema-gate.js";\nimport type { MouseClickAbilityGroup } from "../../mouse-click/contract.js";',
  },
  {
    name: "as-any mutation",
    file: "src/capabilities/ai/runtime/ai-executor.ts",
    search: "const runtimeResult = AiRuntimeExecutionOutputSchema.parse(await input.context.runtime.execute(inputGate.request));",
    replace: "const runtimeResult = AiRuntimeExecutionOutputSchema.parse(await input.context.runtime.execute(inputGate.request));\n  const mutatedEscape = runtimeResult as any;",
  },
];

async function runInspector(): Promise<{ passed: boolean; violationCount: number }> {
  await buildAuditArtifacts();
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector(INSPECTOR_ENTRY);
  const result = await inspector(context);
  return { passed: result.passed, violationCount: result.violationCount };
}

async function mutateAndVerify(mutation: Mutation): Promise<void> {
  const filePath = pathFromRepoRoot(mutation.file);
  let original = "";
  let existed = false;

  try {
    original = await readFile(filePath, "utf8");
    existed = true;
  } catch {
    existed = false;
  }

  if (mutation.mode === "write") {
    await writeFile(filePath, mutation.content ?? "", "utf8");
  } else {
    if (!mutation.search || mutation.replace === undefined) {
      throw new Error(`Replace mutation is missing search/replace for ${mutation.name}`);
    }
    if (!original.includes(mutation.search)) {
      throw new Error(`Mutation seed not found for ${mutation.name} in ${mutation.file}`);
    }
    const mutated = original.replace(mutation.search, mutation.replace);
    await writeFile(filePath, mutated, "utf8");
  }

  try {
    const result = await runInspector();
    if (result.passed || result.violationCount === 0) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
  } finally {
    if (existed) {
      await writeFile(filePath, original, "utf8");
    } else {
      await unlink(filePath);
    }
  }

  const restored = await runInspector();
  if (!restored.passed) {
    throw new Error(`Rollback verification failed for ${mutation.name}`);
  }
}

async function main(): Promise<void> {
  const baseline = await runInspector();
  if (!baseline.passed) {
    throw new Error("Baseline ai-capability inspector must pass before negative proof.");
  }

  for (const mutation of MUTATIONS) {
    await mutateAndVerify(mutation);
    process.stdout.write(`[NEGATIVE-PROOF] PASS ${mutation.name}\n`);
  }
}

void main();
