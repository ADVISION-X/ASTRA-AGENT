import assert from "node:assert/strict";
import { ModuleKind, ModuleResolutionKind, Project, ScriptTarget } from "ts-morph";

import { inspectOwnerFilesystemMutation } from "../audit/domains/audit-system/owner-filesystem-mutation-inspector.js";

const projectFor = (sourceText: string, helperText?: string): Project => {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      module: ModuleKind.NodeNext,
      moduleResolution: ModuleResolutionKind.NodeNext,
      target: ScriptTarget.ES2022,
    },
  });
  project.createSourceFile("/repo/scripts/audit/domains/writer-escape/inspector.ts", sourceText);
  if (helperText) project.createSourceFile("/repo/scripts/audit/shared/writer-helper.ts", helperText);
  return project;
};

assert.deepEqual(inspectOwnerFilesystemMutation(projectFor(`
  import { existsSync, readFileSync } from "node:fs";
  export const inspect = (path: string) => existsSync(path) ? readFileSync(path) : undefined;
`)), [], "proven read-only filesystem APIs must remain allowed");

const attacks: Array<[string, string | undefined]> = [
  ['import { copyFile } from "node:fs"; copyFile("a", "b", () => {});', undefined],
  ['import * as fs from "node:fs"; fs.cpSync("a", "b");', undefined],
  ['import { createWriteStream } from "fs"; createWriteStream("a");', undefined],
  ['import { truncate } from "node:fs/promises"; void truncate("a", 0);', undefined],
  ['import * as fs from "node:fs"; const { link } = fs; link("a", "b", () => {});', undefined],
  ['import * as fs from "node:fs"; const method = "writeFileSync"; const persist = fs[method]; persist("a", "b");', undefined],
  ['import * as fs from "node:fs"; const persist = fs.copyFileSync.bind(fs); persist("a", "b");', undefined],
  ['import { persist } from "../../shared/writer-helper.js"; persist();', 'import { writeFileSync } from "node:fs"; export const persist = () => writeFileSync("a", "b");'],
];

for (const [index, [sourceText, helperText]] of attacks.entries()) {
  const findings = inspectOwnerFilesystemMutation(projectFor(sourceText, helperText));
  assert.ok(findings.some((finding) => finding.code === "AUDIT_OWNER_FILESYSTEM_MUTATION"), `filesystem mutation attack ${index} must fail closed`);
}

process.stdout.write("audit-owner-filesystem-writer-acceptance-ok\n");
