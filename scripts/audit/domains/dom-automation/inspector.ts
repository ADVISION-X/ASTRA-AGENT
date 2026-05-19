import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { Node, Project, type SourceFile } from "ts-morph";
import { getAuditProject } from "../../core/ts-morph.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorResult } from "../../core/schema.js";

const LAW_IDS = [
  "GRASSEYE-DOM-001-V1",
  "GRASSEYE-DOM-002-V1",
  "GRASSEYE-DOM-003-V1",
  "GRASSEYE-DOM-004-V1",
  "GRASSEYE-DOM-005-V1",
  "GRASSEYE-DOM-006-V1",
  "GRASSEYE-DOM-007-V1",
  "GRASSEYE-DOM-008-V1",
  "GRASSEYE-DOM-009-V1",
  "GRASSEYE-DOM-010-V1",
] as const;

const REQUIRED_PATHS = [
  "src/capabilities/dom-automation",
  "src/capabilities/dom-automation/schema.ts",
  "src/capabilities/dom-automation/runtime",
  "src/capabilities/dom-automation/contracts",
  "src/plugins/amazon-invoice-upload",
];

const REQUIRED_ABILITIES = [
  "READ_DOM_SNAPSHOT_ONCE",
  "LOCATE_DOM_ELEMENT_ONCE",
  "FILL_DOM_ELEMENT_ONCE",
  "CLICK_DOM_ELEMENT_ONCE",
  "UPLOAD_APPROVED_FILE_ONCE",
  "VERIFY_DOM_STATE_ONCE",
  "WAIT_FOR_DOM_STATE_ONCE",
];

const VISUAL_FORBIDDEN = [
  ...REQUIRED_ABILITIES,
  "querySelector",
  "getByRole",
  "input[type=file]",
];

const AMAZON_FORBIDDEN = [
  "amazon",
  "sellercentral",
  "seller central",
  "invoice upload",
  "order id",
  "amazonOrderId",
  "marketplace",
];

const PLUGIN_FORBIDDEN = [
  "CurrentChromeBrowserController",
  "querySelectorAll",
  "document.querySelector",
  "execute javascript directly",
  "runAppleScript",
  "clickAt",
  "scrollAt",
];

const BROWSER_FORBIDDEN = ["launchPersistentContext", "chromium.launch", "chromium.launchPersistentContext"];

const SENSITIVE_FORBIDDEN = [
  "document.cookie",
  "localStorage",
  "sessionStorage",
  "password.value",
  "input[type=password].value",
  "hidden input value",
  "outerHTML",
  "document.documentElement.innerHTML",
];

const LOG_FIELD_FORBIDDEN = [
  "cookie",
  "token",
  "password",
  "localStorage",
  "sessionStorage",
  "fullHtml",
  "pdfContent",
  "rawHtml",
];

function filesUnder(relDir: string): SourceFile[] {
  return walkFiles(pathFromRepoRoot(relDir))
    .map((abs) => getAuditProject().addSourceFileAtPathIfExists(abs))
    .filter((sf): sf is SourceFile => Boolean(sf));
}

function walkFiles(absDir: string, acc: string[] = []): string[] {
  if (!existsSync(absDir)) return acc;
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const full = join(absDir, entry.name);
    if (entry.isDirectory()) walkFiles(full, acc);
    if (entry.isFile() && /\.(ts|tsx|js|mjs|json)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

function finding(lawId: string, file: string, message: string, hint: string, line = 1): Finding {
  return createFinding({ lawId, file, line, severity: "fatal", message, hint });
}

function textNodes(sf: SourceFile): Array<{ text: string; line: number }> {
  const nodes: Array<{ text: string; line: number }> = [];
  sf.forEachDescendant((node) => {
    if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
      nodes.push({ text: node.getLiteralText(), line: node.getStartLineNumber() });
    }
    if (Node.isIdentifier(node)) nodes.push({ text: node.getText(), line: node.getStartLineNumber() });
  });
  return nodes;
}

function astTokenFindings(scope: SourceFile[], tokens: string[], lawId: string, message: string, hint: string): Finding[] {
  const findings: Finding[] = [];
  for (const sf of scope) {
    const rel = toRepoRelativePath(sf.getFilePath());
    for (const node of textNodes(sf)) {
      const lower = node.text.toLowerCase();
      const matched = tokens.find((token) => lower.includes(token.toLowerCase()));
      if (matched) findings.push(finding(lawId, rel, `${message}: ${matched}`, hint, node.line));
    }
  }
  return findings;
}

function structureFindings(): Finding[] {
  return REQUIRED_PATHS.filter((relPath) => !existsSync(pathFromRepoRoot(relPath)))
    .map((relPath) => finding("GRASSEYE-DOM-001-V1", relPath, "required DOM automation structure is missing", "Create the required source path inside the DOM owner boundary."));
}

function manifestFindings(): Finding[] {
  const manifestPath = "scripts/audit/domains/dom-automation/manifest.json";
  const abs = pathFromRepoRoot(manifestPath);
  if (!existsSync(abs)) return [finding("GRASSEYE-DOM-001-V1", manifestPath, "DOM owner manifest is missing", "Add the DOM owner manifest.")];
  const manifest = JSON.parse(readFileSync(abs, "utf8")) as { capabilityDomain?: string; allowedLawIds?: string[] };
  const missing = LAW_IDS.filter((lawId) => !(manifest.allowedLawIds ?? []).includes(lawId));
  const findings: Finding[] = [];
  if (manifest.capabilityDomain !== "dom-automation") {
    findings.push(finding("GRASSEYE-DOM-001-V1", manifestPath, "manifest capabilityDomain is not dom-automation", "Bind this owner manifest to dom-automation."));
  }
  for (const lawId of missing) findings.push(finding(lawId, manifestPath, "manifest does not authorize DOM lawId", "Add the active DOM lawId to allowedLawIds."));
  return findings;
}

function abilityRegistryFindings(): Finding[] {
  const project = getAuditProject();
  const catalog = project.addSourceFileAtPathIfExists(pathFromRepoRoot("src/muscle-memory/catalog.ts"));
  const manifest = project.addSourceFileAtPathIfExists(pathFromRepoRoot("src/capabilities/dom-automation/manifest.ts"));
  const findings: Finding[] = [];
  if (!catalog || !manifest) {
    return [finding("GRASSEYE-DOM-001-V1", "src/muscle-memory/catalog.ts", "source registry files are missing", "Keep DOM ability registration in source registry, not generated JSON.")];
  }
  const registryText = `${catalog.getFullText()}\n${manifest.getFullText()}`;
  for (const ability of REQUIRED_ABILITIES) {
    if (!registryText.includes(ability)) findings.push(finding("GRASSEYE-DOM-001-V1", "src/capabilities/dom-automation/manifest.ts", `missing DOM ability registration: ${ability}`, "Register every DOM atomic ability through source registry code."));
  }
  if (!registryText.includes("DOM_AUTOMATION_CATALOG_ENTRIES")) {
    findings.push(finding("GRASSEYE-DOM-001-V1", "src/muscle-memory/catalog.ts", "DOM catalog entries are not joined into MuscleMemory source registry", "Import and append DOM source catalog entries."));
  }
  return findings;
}

function browserControllerFindings(project: Project): Finding[] {
  const findings = astTokenFindings(project.getSourceFiles("src/**/*.ts"), BROWSER_FORBIDDEN, "GRASSEYE-DOM-001-V1", "forbidden second browser launch/controller surface", "Reuse CurrentChromeBrowserController.");
  for (const sf of project.getSourceFiles("src/**/*.ts")) {
    sf.forEachDescendant((node) => {
      const rel = toRepoRelativePath(sf.getFilePath());
      if (Node.isClassDeclaration(node) && /BrowserController$/.test(node.getName() ?? "") && !rel.endsWith("current-chrome-browser-controller.ts")) {
        findings.push(finding("GRASSEYE-DOM-001-V1", rel, "second BrowserController class is forbidden", "Keep browser ownership in the existing CurrentChromeBrowserController.", node.getStartLineNumber()));
      }
      if (Node.isHeritageClause(node) && node.getText().includes("implements BrowserController") && !rel.endsWith("current-chrome-browser-controller.ts")) {
        findings.push(finding("GRASSEYE-DOM-001-V1", rel, "new BrowserController implementation is forbidden", "Reuse the existing browser owner.", node.getStartLineNumber()));
      }
    });
  }
  return findings;
}

function uploadBoundaryFindings(): Finding[] {
  const sf = getAuditProject().addSourceFileAtPathIfExists(pathFromRepoRoot("src/capabilities/dom-automation/runtime/dom-upload.ts"));
  if (!sf) return [finding("GRASSEYE-DOM-006-V1", "src/capabilities/dom-automation/runtime/dom-upload.ts", "DOM upload runtime file is missing", "Keep upload validation in the DOM owner.")];
  const text = sf.getFullText();
  const required = ["existsSync", "statSync", "allowedExtensions", "approvedFilePath", "approvedTaskFilePath"];
  return required.filter((token) => !text.includes(token))
    .map((token) => finding("GRASSEYE-DOM-006-V1", "src/capabilities/dom-automation/runtime/dom-upload.ts", `upload boundary missing ${token}`, "Validate existence, file type, and approved task file path before upload."));
}

function reviewStateFindings(): Finding[] {
  const sf = getAuditProject().addSourceFileAtPathIfExists(pathFromRepoRoot("src/capabilities/dom-automation/schema.ts"));
  if (!sf) return [finding("GRASSEYE-DOM-009-V1", "src/capabilities/dom-automation/schema.ts", "DOM schema is missing", "Declare DOM verification states.")];
  const text = sf.getFullText();
  return ["login_required", "captcha_or_2fa_required", "review_required", "ambiguous", "not_found", "failed", "success"].filter((state) => !text.includes(state))
    .map((state) => finding("GRASSEYE-DOM-009-V1", "src/capabilities/dom-automation/schema.ts", `missing review/verification state: ${state}`, "DOM verification must expose all handoff states."));
}

function logFieldFindings(): Finding[] {
  const files = ["src/capabilities/dom-automation/runtime", "src/plugins/amazon-invoice-upload", "src/lib/local-runtime"].flatMap((dir) => walkFiles(pathFromRepoRoot(dir)));
  const findings: Finding[] = [];
  for (const abs of files) {
    const rel = relative(pathFromRepoRoot("."), abs);
    const sf = getAuditProject().addSourceFileAtPathIfExists(abs);
    if (!sf) continue;
    sf.forEachDescendant((node) => {
      if (!Node.isPropertyAssignment(node) && !Node.isShorthandPropertyAssignment(node)) return;
      const name = node.getName();
      if (LOG_FIELD_FORBIDDEN.includes(name)) findings.push(finding("GRASSEYE-DOM-010-V1", rel, `forbidden sensitive log/property field: ${name}`, "Do not emit sensitive fields from DOM automation logs.", node.getStartLineNumber()));
    });
  }
  return findings;
}

export async function runDomAutomationInspector(_context: InspectorContext): Promise<InspectorResult> {
  const project = getAuditProject();
  const findings = [
    ...manifestFindings(),
    ...structureFindings(),
    ...astTokenFindings(filesUnder("src/visual-mission"), VISUAL_FORBIDDEN, "GRASSEYE-DOM-001-V1", "DOM automation leaked into visual mission", "Keep DOM abilities out of visual mission owner."),
    ...astTokenFindings(filesUnder("src/capabilities/dom-automation"), AMAZON_FORBIDDEN, "GRASSEYE-DOM-008-V1", "business platform vocabulary leaked into DOM capability group", "Move platform-specific vocabulary to the plugin owner."),
    ...astTokenFindings(filesUnder("src/plugins/amazon-invoice-upload"), PLUGIN_FORBIDDEN, "GRASSEYE-DOM-008-V1", "Amazon plugin is touching private DOM/browser implementation", "Call DOM ability facade only."),
    ...browserControllerFindings(project),
    ...astTokenFindings(filesUnder("src/capabilities/dom-automation/runtime"), SENSITIVE_FORBIDDEN, "GRASSEYE-DOM-002-V1", "DOM code contains forbidden sensitive browser read/output", "Do not read or output cookie, storage, password values, hidden values, or full HTML."),
    ...uploadBoundaryFindings(),
    ...abilityRegistryFindings(),
    ...reviewStateFindings(),
    ...logFieldFindings(),
  ];
  const phases = ["authority-home", "structure", "visual-decoupling", "plugin-boundary", "browser-controller-boundary", "sensitive-data", "ability-registry", "review-required"]
    .map((name) => createPhase(name, findings.length === 0 ? "PASS" : "CODE VIOLATION", findings.length === 0, `${name} checked.`));
  return finalizeInspectorResult({
    inspector: "dom-automation",
    inspectorId: "dom-automation-owner",
    capabilityDomain: "dom-automation",
    findings,
    phases,
    summary: findings.length === 0 ? "DOM automation owner boundary is clean." : "DOM automation owner boundary has blocking findings.",
  });
}
