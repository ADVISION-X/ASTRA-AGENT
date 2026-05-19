import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import type { BrowserController, BrowserActionResult, BrowserCaptureResult, BrowserGeometrySnapshot, BrowserStateSnapshot } from "../../src/lib/browser/browser-controller.js";
import {
  clickDomElementOnce,
  fillDomElementOnce,
  locateDomElementOnce,
  readDomSnapshotOnce,
  uploadApprovedFileOnce,
  verifyDomStateOnce,
} from "../../src/capabilities/dom-automation/index.js";

const createdAt = new Date().toISOString();

function action(message: string, ok = true): BrowserActionResult {
  return { browserActionId: `smoke:${message}`, ok, message, createdAt };
}

class SmokeBrowser implements BrowserController {
  getHealth() { return { ok: true, detail: "dom automation smoke harness" }; }
  getSessionState(): BrowserStateSnapshot {
    return { browserMode: "fixture", browserProfileRef: "smoke", browserExecutablePath: null, profileStatus: "profile_ready", profileDirectory: "smoke", profileProvisioning: "operator_supplied", profileVerificationStatus: "operator_verified", profileVerificationReason: "smoke", loginState: "unknown", currentUrl: "file://smoke.html", lastLoginCheckAt: null, loginRequiredReason: null, reviewRequiredReason: null, open: true, currentTitle: "Smoke", browserExecutable: null };
  }
  async getGeometrySnapshot(): Promise<BrowserGeometrySnapshot> {
    return { windowX: 0, windowY: 0, viewportWidth: 800, viewportHeight: 600, screenshotWidth: 800, screenshotHeight: 600, scaleFactor: 1, currentUrl: "file://smoke.html", pageTitle: "Smoke", visibleContentBounds: { x: 0, y: 0, width: 800, height: 600 }, capturedAt: createdAt };
  }
  async open(_input: { url: string; title: string }) { return action("opened smoke page"); }
  async scroll() { return action("scrolled"); }
  async click() { return action("clicked"); }
  async textInput() { return action("typed"); }
  async screenshotRegion(): Promise<BrowserCaptureResult> {
    return { browserActionId: "smoke:capture", pageUrl: "file://smoke.html", pageTitle: "Smoke", regionLabel: "viewport", regionType: "viewport", width: 800, height: 600, viewportWidth: 800, viewportHeight: 600, sourceFilePath: "smoke.png", createdAt };
  }
  async evaluateActiveTab<T>(input: { script: string; description: string }): Promise<T> {
    if (input.description.includes("read governed DOM")) {
      return {
        url: "file://smoke.html",
        title: "Smoke",
        forms: [],
        inputs: [{ tagName: "input", type: "search", placeholder: "Search orders", disabled: false, hidden: false, selectorCandidate: "#search" }],
        buttons: [{ tagName: "button", visibleText: "Search", disabled: false, hidden: false, selectorCandidate: "#searchButton" }],
        links: [],
        fileInputs: [{ tagName: "input", type: "file", disabled: false, hidden: false, selectorCandidate: "#file" }],
        dialogs: [],
        frames: [],
        detectedStates: ["upload_entry_visible"],
        capturedAt: createdAt,
      } as T;
    }
    return { status: "success", message: input.description } as T;
  }
  async wait(durationMs: number) { return action(`waited ${durationMs}`); }
  async close() { return action("closed"); }
}

const tmp = mkdtempSync(join(tmpdir(), "grasseye-dom-smoke-"));
const pdfPath = join(tmp, "invoice.pdf");
const htmlPath = join(tmp, "dom-smoke.html");
writeFileSync(pdfPath, "smoke pdf placeholder");
writeFileSync(htmlPath, "<input id='search' type='search'><button id='searchButton'>Search</button><input id='file' type='file'>");

const browser = new SmokeBrowser();
await browser.open({ url: pathToFileURL(htmlPath).href, title: "DOM automation smoke page" });
const snapshot = await readDomSnapshotOnce(browser);
const searchInput = locateDomElementOnce({ snapshot, targetKind: "search-input", hints: ["search"] });
const searchButton = locateDomElementOnce({ snapshot, targetKind: "button", hints: ["search"] });
const fileInput = locateDomElementOnce({ snapshot, targetKind: "file-input", hints: ["file"] });
const fill = await fillDomElementOnce(browser, { elementRef: searchInput, approvedText: "ORDER-1", clearBeforeType: true, inputPurpose: "order-search" });
const click = await clickDomElementOnce(browser, { elementRef: searchButton, expectedKind: "search", expectedText: "Search" });
const verify = verifyDomStateOnce({ snapshot, expectedStates: ["invoice-upload-entry-visible"], successHints: ["search"], failureHints: [] });
const upload = uploadApprovedFileOnce({ elementRef: fileInput, approvedFilePath: pdfPath, approvedTaskFilePath: pdfPath, allowedExtensions: [".pdf"], uploadPurpose: "approved-pdf-upload" });

if (!fill.ok || !click.ok || verify.status !== "success" || upload.status !== "not_implemented") {
  process.stdout.write("[DOM-AUTOMATION-SMOKE][FAIL] smoke flow did not reach expected governed states\n");
  process.exit(1);
}

process.stdout.write("[DOM-AUTOMATION-SMOKE][PASS] snapshot locate fill click verify upload-boundary checks passed\n");
