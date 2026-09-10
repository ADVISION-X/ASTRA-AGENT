import { existsSync, readFileSync } from "node:fs";
import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { createLocalFinding, requireIdentifiers, requireSource, retiredPaths, sourcePaths, stringLiterals } from "./inspector-support.js";

export const inspectReleaseAndRetiredPaths = (findings: InspectorFinding[], lawId: string): void => {
  for (const path of retiredPaths) {
    if (existsSync(resolveFromRepo(path))) {
      findings.push(createLocalFinding({
        checkId: "browser-authority/terminal-authority",
        lawId,
        filePath: path,
        message: `${path} is a retired Browser transport/release path and must remain physically absent.`,
      }));
    }
  }
  const manifestPath = "src/lib/browser/chrome-extension/manifest.json";
  const manifest = JSON.parse(readFileSync(resolveFromRepo(manifestPath), "utf8")) as Record<string, unknown>;
  const background = manifest.background as Record<string, unknown> | undefined;
  const action = manifest.action as Record<string, unknown> | undefined;
  const permissions = Array.isArray(manifest.permissions) ? [...manifest.permissions].sort() : [];
  if (manifest.manifest_version !== 3
    || background?.service_worker !== "service-worker.js"
    || action?.default_popup !== "pairing.html"
    || Object.hasOwn(manifest, "externally_connectable")
    || Object.hasOwn(manifest, "storage")
    || JSON.stringify(permissions) !== JSON.stringify(["alarms", "debugger"])
    || JSON.stringify(manifest.host_permissions) !== JSON.stringify(["http://127.0.0.1/*"])) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority",
      lawId,
      filePath: manifestPath,
      message: "The unpacked MV3 manifest must expose one bundled worker, one pairing popup and only the fixed loopback host permission.",
    }));
  }
};

export const inspectAutomaticPairingAndReload = (
  context: InspectorContext,
  findings: InspectorFinding[],
  channelLawId: string,
  claimLawId: string,
  releaseLawId: string,
): void => {
  const bootstrapPath = "src/lib/browser/chrome-extension/pairing-auto-bootstrap.ts";
  const bootstrap = requireSource(context, findings, channelLawId, bootstrapPath);
  const actor = requireSource(context, findings, channelLawId, sourcePaths[1]);
  const popup = requireSource(context, findings, claimLawId, sourcePaths[2]);
  if (!bootstrap || !actor || !popup) return;
  requireIdentifiers(bootstrap, [
    "PairingAutoBootstrap", "readWorkbenchPairingState", "GRASSEYE_AUTO_PAIRING_ALARM",
    "releaseBuildId", "currentReleaseBuildId", "reload", "pair", "inFlight",
  ], findings, channelLawId,
  "Automatic pairing must be single-flight, compare exact build identity, reload stale unpacked code and reuse the sole pair actor.");
  requireIdentifiers(actor, ["autoBootstrap", "canAttemptAutomaticPairing"], findings, channelLawId,
    "The sole extension socket actor must own automatic bootstrap admission.");
  const bootstrapLiterals = stringLiterals(bootstrap);
  for (const literal of [
    "http://127.0.0.1:4173/api/browser-authority/pairing",
    "X-GrassEye-Tool-Extension-Id",
    "emkmbecadncngofidjgocmifhbonifgm",
    "BROWSER_PAIRING_ORIGIN_REJECTED",
    "BROWSER_PAIRING_RESPONSE_INVALID",
  ]) {
    if (bootstrapLiterals.includes(literal)) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/automatic-pairing",
      lawId: channelLawId,
      filePath: bootstrapPath,
      message: `Automatic pairing must retain exact bootstrap contract literal ${literal}.`,
    }));
  }
  const popupText = popup.getFullText();
  if (/pairing-secret|type=["']password["']|clipboard/iu.test(popupText)) findings.push(createLocalFinding({
    checkId: "browser-authority/automatic-pairing",
    lawId: claimLawId,
    filePath: sourcePaths[2],
    message: "The popup must not retain manual secret input, password or clipboard pairing paths.",
  }));
  if (/GRASSEYE_CLAIM_ACTIVE_TARGET|claimActiveTarget|#claim/iu.test(popupText)) findings.push(createLocalFinding({
    checkId: "browser-authority/job-bound-target-claim",
    lawId: claimLawId,
    filePath: sourcePaths[2],
    message: "The popup must not retain a manual active-tab claim control or message.",
  }));
  if (bootstrap.getFullText().includes("chrome.storage") || bootstrap.getFullText().includes("localStorage")) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/automatic-reload",
      lawId: releaseLawId,
      filePath: bootstrapPath,
      message: "Automatic reload and pairing must remain memory-only without extension storage.",
    }));
  }
};
