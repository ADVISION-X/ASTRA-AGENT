import assert from "node:assert/strict";
import { Project } from "ts-morph";

import { resolveCallsInSourceFile } from "../audit/domains/runtime-log-spine/ast/ast-call-resolver.js";

const project = new Project({ useInMemoryFileSystem: true });
const aliasMutant = project.createSourceFile("/src/alias-mutant.ts", "const escaped = console.error; escaped('secret');\n");
const unrelated = project.createSourceFile("/src/unrelated.ts", "const consoleLike = { error: (_v: string) => undefined }; consoleLike.error('ok');\n");
assert.ok(resolveCallsInSourceFile(aliasMutant, "src/alias-mutant.ts").some((call) => call.kind === "console-call"));
assert.ok(resolveCallsInSourceFile(unrelated, "src/unrelated.ts").every((call) => call.kind !== "console-call"));
console.log("runtime-log-spine-ast-anti-escape-acceptance-ok");
