import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { Project } from "ts-morph";

import { inspectSystemSecurityProject } from "../audit/domains/system-security/inspector.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const inspect = (path: string, source: string) => {
  const project = new Project({ useInMemoryFileSystem: true });
  project.createSourceFile(path, source);
  return inspectSystemSecurityProject(project);
};

assert.deepEqual(inspect("src/safe.ts", `
  const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";
  export async function load(response: Response) {
    const raw = await response.json() as unknown;
    if (!isRecord(raw) || raw.ok !== true) throw new Error("EXTERNAL_RESPONSE_INVALID");
    return raw;
  }
`), []);

assert.ok(inspect("src/leak.ts", "export const leak = (sessionToken: string) => console.error(sessionToken);")
  .some((finding) => finding.checkId === "system-security/sensitive-console-flow"));
assert.ok(inspect("src/forgery.ts", "export const load = async (response: Response) => await response.json() as { ok: true };")
  .some((finding) => finding.checkId === "system-security/external-response-type-forgery"));
assert.ok(inspect("src/lib/local-runtime/production/cloud-contract.ts", "export type CloudOrder = { selector: string };")
  .some((finding) => finding.checkId === "system-security/cloud-browser-control-field"));
assert.ok(inspect("src/lib/browser/chrome-extension/actor.ts", "import { credential } from '../../local-runtime/production/credential.js'; export { credential };")
  .some((finding) => finding.checkId === "system-security/extension-owner-bypass"));
assert.ok(inspect("src/lib/local-runtime/production/cloud-client.ts", "export const run = () => { try { throw new Error('blocked'); } catch { return true; } };")
  .some((finding) => finding.checkId === "system-security/unsafe-catch-fallback"));
assert.ok(inspect("src/final-action.ts", "export const decide = (aiResponse: string) => publish(aiResponse);")
  .some((finding) => finding.checkId === "system-security/ai-irreversible-final-action"));

console.log("system-security-acceptance-ok");
emitQualityProofObservation({ lawId: "LAW-SYSTEM-SECURITY-001-V13", evidenceMode: "exam.golden", clauses: ["forbidden:0","forbidden:1","forbidden:2","forbidden:3","forbidden:4","forbidden:5","summary"], locator: "acceptance:system-security:attack-mutants", observedValue: "sensitive-flow type-forgery cloud-control extension-owner-bypass AI-final-action and unsafe-fallback mutants rejected" });
