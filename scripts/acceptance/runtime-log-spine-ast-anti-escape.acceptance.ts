import assert from "../audit/shared/governance-exam-assert.js";
import { directOutputViolations } from "../audit/domains/runtime-log-spine/inspector.js";

assert.deepEqual(directOutputViolations("const escaped = console.error; escaped('secret');\n", "src/alias-mutant.ts"), [1]);
assert.deepEqual(directOutputViolations("process['stderr'].write('secret');\n", "src/dynamic-mutant.ts"), [1]);
assert.deepEqual(directOutputViolations("const method = 'error'; console[method]('secret');\n", "src/computed-mutant.ts"), [1]);
assert.deepEqual(directOutputViolations("const c = console; c.error('secret');\n", "src/alias-object-mutant.ts"), [1]);
assert.deepEqual(directOutputViolations("const { error } = console; error('secret');\n", "src/destructure-mutant.ts"), [1]);
assert.deepEqual(directOutputViolations("const { stdout } = process; stdout.write('secret');\n", "src/process-destructure-mutant.ts"), [1]);
assert.deepEqual(directOutputViolations("const p = process; p.stderr.write('secret');\n", "src/process-alias-mutant.ts"), [1]);
assert.deepEqual(directOutputViolations("const c = globalThis.console; c.error('secret');\n", "src/global-console-mutant.ts"), [1]);
assert.deepEqual(directOutputViolations("globalThis['process']['stderr']['write']('secret');\n", "src/global-process-mutant.ts"), [1]);
assert.deepEqual(directOutputViolations("const consoleLike = { error: (_v: string) => undefined }; consoleLike.error('ok');\n", "src/unrelated.ts"), []);
process.stdout.write("[ACCEPTANCE] runtime-log-spine-anti-escape PASS\n");
