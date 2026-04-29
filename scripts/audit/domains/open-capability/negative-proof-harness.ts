import { readFile, unlink, writeFile } from "node:fs/promises";

import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { pathFromRepoRoot } from "../../core/paths.js";

type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
};

const INSPECTOR_ENTRY = "scripts/audit/domains/open-capability/inspector.ts";
const EXPORT_STAR_MUTATION = `export ${"*"} from "./schema.js";`;
const AS_ANY_MUTATION = `const mutatedAny = navigation as ${"any"};`;

const MUTATIONS: Mutation[] = [
  {
    name: "url gate mutation",
    file: "src/capabilities/open/runtime/open-executor.ts",
    search: "const urlSafety = evaluateUrlSafety({",
    replace: 'const urlSafety = { ok: true, failureCode: null, reason: null, normalizedUrl: "https://mutated.invalid", hostname: "www.tiktok.com", scheme: "https", decision: { status: "allow", reason: null, normalizedUrl: "https://mutated.invalid", hostname: "www.tiktok.com", scheme: "https" } };\n  // mutated gate removed\n  ({',
  },
  {
    name: "session gate mutation",
    file: "src/capabilities/open/runtime/open-executor.ts",
    search: "const sessionGate = await evaluateRealChromeSession({",
    replace: 'const sessionGate = { ok: true, failureCode: null, status: "failed", reason: null, sessionSnapshot: createUnavailableSession("mutated session gate"), decision: { status: "allow", reason: null, browserMode: "real_chrome_persistent", profileStatus: "profile_ready", profileVerificationStatus: "operator_verified" } };\n  // mutated gate removed\n  ({',
  },
  {
    name: "post-open gate mutation",
    file: "src/capabilities/open/runtime/open-executor.ts",
    search: "const postOpenState = evaluatePostOpenState({",
    replace: 'const postOpenState = { status: "success", failureCode: null, reason: null, decision: { status: "success", classification: "platform_feed", reason: null, openedUrl: navigation.afterSession.currentUrl, pageTitleAfter: navigation.afterSession.currentTitle, pageStateHandoffRequired: true }, dataQualityFlags: [] };\n  // mutated post-open gate removed\n  ({',
  },
  {
    name: "proof builder mutation",
    file: "src/capabilities/open/runtime/open-result-builder.ts",
    search: "runtimeProof: buildOpenProof({",
    replace: "runtimeProof: buildOpenProofRemoved({",
  },
  {
    name: "fake dispatch mutation",
    file: "src/capabilities/open/runtime/open-dispatch-failure.ts",
    search: "targetProfileRef: null,",
    replace: 'targetProfileRef: "open-target-profile:mutated",',
  },
  {
    name: "fake allow decision mutation",
    file: "src/capabilities/open/runtime/open-dispatch-failure.ts",
    search: 'status: "block",\n      reason: input.reason,\n      targetProfileRef: null,',
    replace: 'status: "allow",\n      reason: input.reason,\n      targetProfileRef: null,',
  },
  {
    name: "login success mutation",
    file: "src/capabilities/open/runtime/post-open-state-gate.ts",
    search: 'classification: "login_wall",',
    replace: 'classification: "platform_feed",',
  },
  {
    name: "wrong domain success mutation",
    file: "src/capabilities/open/runtime/post-open-state-gate.ts",
    search: 'classification: "wrong_domain",',
    replace: 'classification: "platform_feed",',
  },
  {
    name: "export star mutation",
    file: "src/capabilities/open/index.ts",
    search: 'export type { OpenBrowserPort } from "./ports/open-browser-port.js";',
    replace: `export type { OpenBrowserPort } from "./ports/open-browser-port.js";\n${EXPORT_STAR_MUTATION}`,
  },
  {
    name: "forbidden import mutation",
    file: "src/capabilities/open/runtime/open-executor.ts",
    search: 'import { evaluateUrlSafety } from "./url-safety-gate.js";',
    replace: 'import { evaluateUrlSafety } from "./url-safety-gate.js";\nimport type { ScreenshotAbilityGroup } from "../../screenshot/contract.js";',
  },
  {
    name: "cookie read mutation",
    file: "src/capabilities/open/runtime/open-executor.ts",
    search: "function makeDataFlag(code: string, severity: OpenDataQualityFlag[\"severity\"], reason: string): OpenDataQualityFlag {",
    replace: 'function makeDataFlag(code: string, severity: OpenDataQualityFlag["severity"], reason: string): OpenDataQualityFlag {\n  const mutatedCookie = document.cookie;\n  void mutatedCookie;',
  },
  {
    name: "as-any mutation",
    file: "src/capabilities/open/runtime/open-executor.ts",
    search: "  const postOpenState = evaluatePostOpenState({",
    replace: `  ${AS_ANY_MUTATION}\n  const postOpenState = evaluatePostOpenState({`,
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

  if (!original.includes(mutation.search)) {
    throw new Error(`Mutation seed not found for ${mutation.name} in ${mutation.file}`);
  }

  const mutated = original.replace(mutation.search, mutation.replace);
  await writeFile(filePath, mutated, "utf8");

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
    throw new Error("Baseline open-capability inspector must pass before negative proof.");
  }

  for (const mutation of MUTATIONS) {
    await mutateAndVerify(mutation);
    process.stdout.write(`[NEGATIVE-PROOF] PASS ${mutation.name}\n`);
  }
}

void main();