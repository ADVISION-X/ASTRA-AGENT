import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { CurrentChromeBrowserController } from "../../src/lib/browser/current-chrome-browser-controller.js";
import { resolveProductionBrowserProfileEnrollment } from "../../src/lib/browser/profile/browser-profile-config.js";

const execFileAsync = promisify(execFile);
const argumentValue = (name: string): string | null => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
};
const scenario = argumentValue("--scenario");
const pluginWorkOrder = argumentValue("--plugin-work-order");
const supported = new Set(Array.from({ length: 10 }, (_, index) => `ACC-023B-${String(index + 1).padStart(2, "0")}`));

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
<style>
body{min-height:2400px}
#action-owner{display:inline-block;height:32px;margin-top:700px;position:relative;width:120px}
#action{height:32px;inset:0;opacity:.01;position:absolute;width:120px;z-index:20}
</style>
<h1 id="marker">${name}:${marker}</h1><input id="field">
<kat-file-upload id="file-owner"><span><input id="file" type="file" hidden></span></kat-file-upload>
<span id="action-owner"><input id="action" type="submit" value="action" onclick="this.dataset.clicked='yes'"><span>action</span></span>
<script>
customElements.define("kat-file-upload", class extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({mode:"open"});
    root.innerHTML = '<input id="kat-file-attachment" type="file">';
    root.querySelector("input").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file?.name !== "approved-nine.txt") return;
      const item = document.createElement("kat-file-item");
      item.setAttribute("name", file.name);
      item.setAttribute("file-status", "ready");
      root.appendChild(item);
      event.target.value = "";
    });
  }
});
document.querySelector("#field").addEventListener("change", (event) => {
  event.target.dataset.committed = event.target.value;
});
</script>`;
const server = createServer((request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(page(request.url === "/b" ? "B" : "A"));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("REAL_CHROME_FIXTURE_LISTENER_UNAVAILABLE");
const origin = `http://127.0.0.1:${address.port}`;
const profileEnrollment = resolveProductionBrowserProfileEnrollment({ platform: process.platform });
const browser = await CurrentChromeBrowserController.create({
  profileEnrollment,
  screenshotDir: path.join(runRoot, "captures"),
  dataDir: process.env.GRASSEYE_DATA_DIR?.trim() || path.resolve(".grasseye-local"),
});
let a: ReturnType<typeof browser.createTargetSession> | null = null;
let b: ReturnType<typeof browser.createTargetSession> | null = null;

const waitForTransport = async (): Promise<void> => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
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
const pointOf = (session: ReturnType<typeof browser.createTargetSession>, selector: string) =>
  readState<{ x: number; y: number }>(session, `(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
const stage = async <T>(name: string, action: () => Promise<T>): Promise<T> => {
  try {
    return await action();
  } catch (error) {
    throw new Error(`${name}:${error instanceof Error ? error.message : String(error)}`);
  }
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
    await a.click({ targetLabel: "fixture A field", point: await pointOf(a, "#field") });
    await a.textInput({ targetLabel: "fixture A field", action: "type-text", text: "A_ONLY" });
    await stage("scenario01-scroll", () => a!.scroll({ targetLabel: "fixture A", deltaX: 0, deltaY: 500 }));
    const point = await pointOf(a, "#action");
    await stage("scenario01-click", () => a!.click({ targetLabel: "fixture A action", point }));
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
    await assert.rejects(() => a!.evaluate({ description: "closed controller must fail", script: "return true;" }), /DISCONNECTED|not connected|closed|ECONN|TARGET_CLOSED/u);
  }
  if (scenario === "ACC-023B-06") {
    const beforeB = await readState<string>(b, "JSON.stringify({url:location.href,title:document.title,value:document.querySelector('#field').value,scrollY})");
    const value = await a.evaluate<{ answer: number; marker: string }>({
      description: "execute governed top-level return function body",
      script: "const left = 19; const right = 23; return {answer:left + right, marker:document.querySelector('#marker').textContent};",
    });
    assert.equal(value.answer, 42);
    assert.match(value.marker, /^A:/u);
    assert.equal(await readState<string>(b, "JSON.stringify({url:location.href,title:document.title,value:document.querySelector('#field').value,scrollY})"), beforeB);
  }
  if (scenario === "ACC-023B-07") {
    const beforeB = await readState<string>(b, "JSON.stringify({clicked:document.querySelector('#action').dataset.clicked||null,scrollY})");
    const actionPoint = await pointOf(a, "#action");
    assert.equal(await readState<string>(a, `document.elementFromPoint(${actionPoint.x},${actionPoint.y})?.id`), "action");
    await assert.rejects(
      () => a!.clickLocatedDomElement({
        targetLabel: "fixture A changed identity attack",
        element: { selector: "#action", identity: { tagName: "input", type: "submit", id: "different-action" } },
      }),
      /TARGET_IDENTITY_CHANGED/u,
    );
    assert.equal(await readState<string | null>(a, "document.querySelector('#action').dataset.clicked||null"), null);
    await stage("scenario07-click", async () => a!.clickLocatedDomElement({
      targetLabel: "fixture A dedicated click",
      element: { selector: "#action", identity: { tagName: "input", type: "submit", id: "action", visibleText: "action" } },
      expectedText: "action",
    }));
    assert.equal(await readState<string>(a, "document.querySelector('#action').dataset.clicked"), "yes");
    assert.equal(await readState<string>(b, "JSON.stringify({clicked:document.querySelector('#action').dataset.clicked||null,scrollY})"), beforeB);
  }
  if (scenario === "ACC-023B-08") {
    const beforeB = await readState<string>(b, "document.querySelector('#field').value");
    await assert.rejects(
      () => a!.fillLocatedDomElement!({
        targetLabel: "fixture A changed fill identity attack",
        element: { selector: "#field", identity: { tagName: "input", type: "input", id: "different-field" } },
        approvedText: "MUST_NOT_APPEAR",
        clearBeforeType: true,
      }),
      /TARGET_IDENTITY_CHANGED/u,
    );
    assert.equal(await readState<string>(a, "document.querySelector('#field').value"), "");
    await a.fillLocatedDomElement!({
      targetLabel: "fixture A dedicated fill",
      element: { selector: "#field", identity: { tagName: "input", type: "input", id: "field" } },
      approvedText: "DEDICATED_TEXT_TARGET",
      clearBeforeType: true,
    });
    assert.equal(await readState<string>(a, "document.querySelector('#field').value"), "DEDICATED_TEXT_TARGET");
    assert.equal(await readState<string>(a, "document.querySelector('#field').dataset.committed"), "DEDICATED_TEXT_TARGET");
    assert.equal(await readState<string>(b, "document.querySelector('#field').value"), beforeB);
  }
  if (scenario === "ACC-023B-09") {
    const approved = path.join(runRoot, "approved-nine.txt");
    await writeFile(approved, "scenario nine\n");
    await a.setFileInputFiles({ elementRef: { selector: "#file", targetKind: "file-input" }, filePath: approved, description: "scenario nine exact-target file input" });
    assert.deepEqual(await readState<{ name: string; status: string; count: number; proxyCount: number }>(a, "({name:document.querySelector('#file-owner').shadowRoot.querySelector('kat-file-item').getAttribute('name'),status:document.querySelector('#file-owner').shadowRoot.querySelector('kat-file-item').getAttribute('file-status'),count:document.querySelector('#file-owner').shadowRoot.querySelector('#kat-file-attachment').files.length,proxyCount:document.querySelector('#file').files.length})"), { name: "approved-nine.txt", status: "ready", count: 0, proxyCount: 0 });
    assert.equal(await readState<number>(b, "document.querySelector('#file-owner').shadowRoot.querySelector('#kat-file-attachment').files.length"), 0);
    assert.equal(await frontmostApp(), frontBefore);
  }
  if (scenario === "ACC-023B-10") {
    const beforeB = await readState<string>(b, "JSON.stringify({url:location.href,title:document.title,value:document.querySelector('#field').value})");
    await assert.rejects(
      () => a!.evaluate({ description: "governed evaluation exception", script: "throw new Error('CONTROLLED_EVALUATION_FAILURE');" }),
      /CONTROLLED_EVALUATION_FAILURE/u,
    );
    assert.equal(await readState<string>(b, "JSON.stringify({url:location.href,title:document.title,value:document.querySelector('#field').value})"), beforeB);
    assert.equal(await a.evaluate<number>({ description: "session remains exact after observed failure", script: "return 42;" }), 42);
  }
  process.stdout.write(`${JSON.stringify({ status: "CHROME_VERIFIED", scenario, candidate: "working-tree", marker, frontBefore, frontAfter: await frontmostApp() })}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ status: "NOT_PRODUCTION_VERIFIED", scenario, reason: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
} finally {
  await a?.closeTarget({ reason: "real Chrome acceptance cleanup A" }).catch(() => undefined);
  await b?.closeTarget({ reason: "real Chrome acceptance cleanup B" }).catch(() => undefined);
  await browser.close().catch(() => undefined);
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(runRoot, { force: true, recursive: true });
}
