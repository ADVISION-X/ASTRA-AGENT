import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { CurrentChromeBrowserController } from "../../src/lib/browser/current-chrome-browser-controller.js";
import { createLocalBrowserSessionConfig } from "../../src/lib/browser/local-browser-session.js";

const execFileAsync = promisify(execFile);
const scenario = process.argv[process.argv.indexOf("--scenario") + 1] ?? null;
const pluginWorkOrder = process.argv[process.argv.indexOf("--plugin-work-order") + 1] ?? null;
const supported = new Set(["ACC-023B-01", "ACC-023B-02", "ACC-023B-03", "ACC-023B-04", "ACC-023B-05"]);

if (pluginWorkOrder) {
  process.stderr.write(`${JSON.stringify({
    status: "PLUGIN_INTERVENTION_NOT_PRODUCTION_VERIFIED",
    pluginWorkOrder,
    reason: "A plugin real-platform journey requires an operator-approved account, task and non-destructive fixture. Static/deterministic owner intervention acceptances do not replace it.",
  })}\n`);
  process.exit(2);
}
if (!scenario || !supported.has(scenario)) {
  process.stderr.write(`${JSON.stringify({
    status: "NOT_PRODUCTION_VERIFIED",
    supportedScenarios: [...supported],
    reason: "Choose one implemented local exact-target scenario. Provider/account and physical-focus scenarios require separate operator-approved fixtures.",
  })}\n`);
  process.exit(2);
}

const runRoot = await mkdtemp(path.join(tmpdir(), "grasseye-exact-target-real-"));
const marker = randomUUID();
const page = (name: string) => `<!doctype html><meta charset="utf-8"><title>${name}</title>
<style>body{min-height:2400px}#action{margin-top:700px}</style>
<h1 id="marker">${name}:${marker}</h1><input id="field"><input id="file" type="file">
<button id="action" onclick="this.dataset.clicked='yes'">action</button>`;
const server = createServer((request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(page(request.url === "/b" ? "B" : "A"));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("REAL_CHROME_FIXTURE_LISTENER_UNAVAILABLE");
const origin = `http://127.0.0.1:${address.port}`;
const browser = new CurrentChromeBrowserController({
  sessionConfig: createLocalBrowserSessionConfig({ platform: process.platform }),
  screenshotDir: path.join(runRoot, "captures"),
  dataDir: process.env.GRASSEYE_DATA_DIR?.trim() || path.resolve(".grasseye-local"),
});
let a: ReturnType<typeof browser.createTargetSession> | null = null;
let b: ReturnType<typeof browser.createTargetSession> | null = null;

const waitForTransport = async (): Promise<void> => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (browser.getHealth().ok) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("NOT_PRODUCTION_VERIFIED: fixed-id MV3 extension/native host transport is not connected");
};
const frontmostApp = async (): Promise<string | null> => {
  if (process.platform !== "darwin") return null;
  const { stdout } = await execFileAsync("/usr/bin/osascript", ["-e", 'tell application "System Events" to get name of first application process whose frontmost is true']);
  return stdout.trim();
};
const readState = <T>(session: ReturnType<typeof browser.createTargetSession>, expression: string) =>
  session.evaluate<T>({ description: "real Chrome exact-target fixture read", script: `return (${expression});` });
const targetOf = (session: ReturnType<typeof browser.createTargetSession>) => {
  const target = session.getTarget?.();
  if (!target) throw new Error("NOT_PRODUCTION_VERIFIED: exact target identity is unavailable");
  return target;
};

try {
  await waitForTransport();
  a = browser.createTargetSession(`real-a:${scenario}`);
  b = browser.createTargetSession(`real-b:${scenario}`);
  const frontBefore = await frontmostApp();
  await a.open({ url: `${origin}/a`, title: "exact target fixture A", reusePolicy: "open-new-tab" });
  await b.open({ url: `${origin}/b`, title: "exact target fixture B", reusePolicy: "open-new-tab" });
  assert.notEqual(targetOf(a).targetRef, targetOf(b).targetRef);

  if (scenario === "ACC-023B-01") {
    const beforeB = await readState<string>(b, "JSON.stringify({value:document.querySelector('#field').value,scrollY,clicked:document.querySelector('#action').dataset.clicked||null})");
    await a.evaluate({ description: "focus exact target fixture input", script: "document.querySelector('#field').focus(); return true;" });
    await a.textInput({ targetLabel: "fixture A field", action: "type-text", text: "A_ONLY" });
    await a.scroll({ targetLabel: "fixture A", deltaX: 0, deltaY: 500 });
    const point = await readState<{ x: number; y: number }>(a, "(() => { const r=document.querySelector('#action').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })() ");
    await a.click({ targetLabel: "fixture A action", point });
    await a.screenshotRegion({ regionLabel: "exact-target-a" });
    assert.equal(await readState<string>(a, "document.querySelector('#field').value"), "A_ONLY");
    assert.equal(await readState<string>(a, "document.querySelector('#action').dataset.clicked"), "yes");
    assert.equal(await readState<string>(b, "JSON.stringify({value:document.querySelector('#field').value,scrollY,clicked:document.querySelector('#action').dataset.clicked||null})"), beforeB);
    assert.equal(await frontmostApp(), frontBefore, "ordinary exact-target commands must not change the frontmost application");
  }
  if (scenario === "ACC-023B-02") {
    const oldDocument = targetOf(a).documentRef;
    await a.open({ url: `${origin}/a?generation=2`, title: "navigate exact target A", reusePolicy: "reuse-exact-url" });
    assert.notEqual(targetOf(a).documentRef, oldDocument, "navigation must rotate BrowserDocumentRef");
    assert.match(await readState<string>(b, "document.querySelector('#marker').textContent"), /^B:/u);
  }
  if (scenario === "ACC-023B-03") {
    const approved = path.join(runRoot, "approved.txt");
    await writeFile(approved, "approved exact-target fixture\n");
    await a.setFileInputFiles({ elementRef: { selector: "#file", targetKind: "file-input" }, filePath: approved, description: "set approved exact-target fixture" });
    assert.equal(await readState<string>(a, "document.querySelector('#file').files[0].name"), "approved.txt");
    assert.equal(await readState<number>(b, "document.querySelector('#file').files.length"), 0);
    await a.screenshotRegion({ regionLabel: "exact-target-file-input" });
    assert.equal(await frontmostApp(), frontBefore, "DOM file input and target screenshot must not change the frontmost application");
  }
  if (scenario === "ACC-023B-04") {
    await a.closeTarget({ reason: "real Chrome closed-target acceptance" });
    await assert.rejects(() => a!.evaluate({ description: "closed target must fail", script: "return true;" }), /TARGET_NOT_FOUND|TARGET_CLOSED/u);
    assert.match(await readState<string>(b, "document.querySelector('#marker').textContent"), /^B:/u);
  }
  if (scenario === "ACC-023B-05") {
    await browser.close();
    await assert.rejects(() => a!.evaluate({ description: "closed controller must fail", script: "return true;" }), /DISCONNECTED|not connected|closed|ECONN/u);
  }
  process.stdout.write(`${JSON.stringify({ status: "CHROME_VERIFIED", scenario, candidate: "working-tree", marker, frontBefore, frontAfter: await frontmostApp() })}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ status: "NOT_PRODUCTION_VERIFIED", scenario, reason: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
} finally {
  await a?.closeTarget({ reason: "real Chrome acceptance cleanup A" }).catch(() => undefined);
  await b?.closeTarget({ reason: "real Chrome acceptance cleanup B" }).catch(() => undefined);
  await browser.close().catch(() => undefined);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(runRoot, { force: true, recursive: true });
}
