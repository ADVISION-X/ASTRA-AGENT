import { Node, SyntaxKind, type ElementAccessExpression, type Identifier, type PropertyAccessExpression, type SourceFile } from "ts-morph";

import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import { getSourceFileAtRepoPath } from "./collect-dom-automation-project.js";
import type { DomAutomationAuditProject, DomAutomationValidationResult } from "./dom-automation-project-types.js";
import { collectStringLiteralNodes, resolveStaticString } from "./dom-automation-static-strings.js";
import { buildValidationResult } from "./dom-automation-validation-result.js";

const DOM_CORE_FORBIDDEN_VOCAB = [
  "amazon",
  "sellercentral",
  "seller central",
  "marketplace",
  "invoice upload",
  "amazonorderid",
  "order id",
] as const;

const LOG_FIELD_FORBIDDEN = [
  "cookie",
  "token",
  "password",
  "localStorage",
  "sessionStorage",
  "fullHtml",
  "pdfContent",
  "rawHtml",
] as const;

const SCRIPT_LITERAL_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: "document.cookie", regex: /document\s*(?:\.cookie|\[\s*['"]cookie['"]\s*\])/iu },
  { label: "localStorage", regex: /(window|globalThis)?\s*(?:\.localStorage|\[\s*['"]localStorage['"]\s*\]|\[\s*['"]local['"]\s*\+\s*['"]Storage['"]\s*\])/iu },
  { label: "sessionStorage", regex: /(window|globalThis)?\s*(?:\.sessionStorage|\[\s*['"]sessionStorage['"]\s*\]|\[\s*['"]session['"]\s*\+\s*['"]Storage['"]\s*\])/iu },
  { label: "outerHTML", regex: /(?:\.outerHTML|\[\s*['"]outerHTML['"]\s*\]|\[\s*['"]outer['"]\s*\+\s*['"]HTML['"]\s*\])/iu },
  { label: "document.documentElement.innerHTML", regex: /document\s*\.\s*documentElement\s*\.\s*innerHTML/iu },
  { label: "password.value", regex: /password[^\n]{0,80}\.value|input\s*\[\s*type\s*=\s*['"]password['"]\s*\][^\n]{0,80}\.value/iu },
] as const;

const antiEscapeFinding = (...input: readonly [
  lawId: string,
  file: string,
  line: number,
  message: string,
  hint: string,
]): Finding => {
  const [lawId, file, line, message, hint] = input;
  return createFinding({ lawId, file, line, severity: "fatal", message, hint });
};

const fileRepoPath = (
  auditProject: DomAutomationAuditProject,
  sourceFile: SourceFile,
): string => sourceFile.getFilePath().replace(`${auditProject.project.getDirectoryOrThrow(".").getPath()}/`, "");

const validateDomCoreBusinessVocabulary = (
  auditProject: DomAutomationAuditProject,
): Finding[] => {
  const findings: Finding[] = [];
  const scopedFiles = auditProject.sourceFiles.dom.filter((sourceFile) => fileRepoPath(auditProject, sourceFile) !== "src/capabilities/dom-automation/tests/dom-upload.fixture.ts");
  for (const sourceFile of scopedFiles) {
    const repoPath = fileRepoPath(auditProject, sourceFile);
    for (const literal of collectStringLiteralNodes(sourceFile)) {
      const normalized = literal.text.toLowerCase();
      const matched = DOM_CORE_FORBIDDEN_VOCAB.find((token) => normalized.includes(token));
      if (matched) {
        findings.push(antiEscapeFinding(
          "GRASSEYE-DOM-008-V1",
          repoPath,
          literal.line,
          `DOM core contains platform-specific business vocabulary: ${matched}`,
          "Move platform-specific wording and selectors to the plugin owner.",
        ));
      }
    }
  }
  return findings;
};

const isForbiddenSensitiveProperty = (propertyText: string): boolean => {
  const normalized = propertyText.replace(/\s+/g, "").toLowerCase();
  return [
    "document.cookie",
    "window.localstorage",
    "window.sessionstorage",
    "globalthis.localstorage",
    "globalthis.sessionstorage",
    "document.documentelement.innerhtml",
  ].includes(normalized) || normalized.endsWith(".outerhtml");
};

const propertyAccessFinding = (
  repoPath: string,
  propertyAccess: PropertyAccessExpression,
): Finding[] => isForbiddenSensitiveProperty(propertyAccess.getText())
  ? [antiEscapeFinding(
    "GRASSEYE-DOM-002-V1",
    repoPath,
    propertyAccess.getStartLineNumber(),
    `forbidden sensitive DOM property access: ${propertyAccess.getText()}`,
    "Do not read cookies, storage, password values, or full HTML inside DOM automation.",
  )]
  : [];

const pluginDomApiFinding = (
  repoPath: string,
  propertyAccess: PropertyAccessExpression,
): Finding[] => repoPath.startsWith("src/plugins/amazon-invoice-upload/")
  && ["querySelector", "querySelectorAll"].includes(propertyAccess.getName())
  ? [antiEscapeFinding(
    "GRASSEYE-DOM-008-V1",
    repoPath,
    propertyAccess.getStartLineNumber(),
    `plugin bypasses DOM facade with direct DOM API: ${propertyAccess.getText()}`,
    "Amazon plugin must not query the DOM directly.",
  )]
  : [];

const elementAccessFinding = (
  repoPath: string,
  elementAccess: ElementAccessExpression,
): Finding[] => {
  const propertyName = resolveStaticString(elementAccess.getArgumentExpression())?.toLowerCase();
  return propertyName && ["cookie", "localstorage", "sessionstorage", "outerhtml", "innerhtml"].includes(propertyName)
    ? [antiEscapeFinding(
      "GRASSEYE-DOM-002-V1",
      repoPath,
      elementAccess.getStartLineNumber(),
      `forbidden sensitive element-access escape: ${elementAccess.getText()}`,
      "Do not route sensitive DOM reads through bracket notation or string concatenation.",
    )]
    : [];
};

const pluginPrimitiveIdentifierFinding = (
  repoPath: string,
  identifier: Identifier,
): Finding[] => repoPath.startsWith("src/plugins/amazon-invoice-upload/")
  && ["runAppleScript", "clickAt", "scrollAt"].includes(identifier.getText())
  ? [antiEscapeFinding(
    "GRASSEYE-DOM-008-V1",
    repoPath,
    identifier.getStartLineNumber(),
    `plugin references forbidden browser primitive symbol: ${identifier.getText()}`,
    "Amazon plugin must not touch browser primitives directly.",
  )]
  : [];

const validateForbiddenPropertyAccess = (
  auditProject: DomAutomationAuditProject,
): Finding[] => {
  const findings: Finding[] = [];
  const scopedFiles = [
    ...auditProject.sourceFiles.domRuntime,
    ...auditProject.sourceFiles.plugin,
  ];
  for (const sourceFile of scopedFiles) {
    const repoPath = fileRepoPath(auditProject, sourceFile);
    for (const propertyAccess of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
      findings.push(...propertyAccessFinding(repoPath, propertyAccess));
      findings.push(...pluginDomApiFinding(repoPath, propertyAccess));
    }
    for (const elementAccess of sourceFile.getDescendantsOfKind(SyntaxKind.ElementAccessExpression)) {
      findings.push(...elementAccessFinding(repoPath, elementAccess));
    }
    for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
      findings.push(...pluginPrimitiveIdentifierFinding(repoPath, identifier));
    }
  }
  return findings;
};

const validateScriptLiteralAntiEscape = (
  auditProject: DomAutomationAuditProject,
): Finding[] => {
  const findings: Finding[] = [];
  const currentChromeFile = getSourceFileAtRepoPath(auditProject.project, "src/lib/browser/current-chrome-browser-controller-execution.ts");
  const scopedFiles = [
    ...auditProject.sourceFiles.domRuntime,
    ...(currentChromeFile ? [currentChromeFile] : []),
  ];
  for (const sourceFile of scopedFiles) {
    const repoPath = fileRepoPath(auditProject, sourceFile);
    for (const literal of collectStringLiteralNodes(sourceFile)) {
      const matched = SCRIPT_LITERAL_PATTERNS.find((candidate) => candidate.regex.test(literal.text));
      if (matched) {
        findings.push(antiEscapeFinding(
          "GRASSEYE-DOM-002-V1",
          repoPath,
          literal.line,
          `forbidden DOM script literal leaks sensitive browser surface: ${matched.label}`,
          "Do not emit script literals that read cookie, storage, password, or full HTML fields.",
        ));
      }
    }
  }
  const currentChromeText = currentChromeFile?.getFullText() ?? "";
  if (!/outerHTML|document\.documentElement\.innerHTML/u.test(currentChromeText)) {
    findings.push(antiEscapeFinding(
      "GRASSEYE-DOM-002-V1",
      "src/lib/browser/current-chrome-browser-controller.ts",
      1,
      "evaluateActiveTab guard does not block full-HTML escape patterns",
      "Extend the browser owner guardrail to reject outerHTML and document.documentElement.innerHTML reads.",
    ));
  }
  return findings;
};

const validateLogFields = (
  auditProject: DomAutomationAuditProject,
): Finding[] => {
  const findings: Finding[] = [];
  const scopedFiles = [
    ...auditProject.sourceFiles.domRuntime,
    ...auditProject.sourceFiles.plugin,
  ];
  for (const sourceFile of scopedFiles) {
    const repoPath = fileRepoPath(auditProject, sourceFile);
    sourceFile.forEachDescendant((node) => {
      if (!Node.isPropertyAssignment(node) && !Node.isShorthandPropertyAssignment(node)) {
        return;
      }
      const name = node.getName();
      if (LOG_FIELD_FORBIDDEN.includes(name as (typeof LOG_FIELD_FORBIDDEN)[number])) {
        findings.push(antiEscapeFinding(
          "GRASSEYE-DOM-010-V1",
          repoPath,
          node.getStartLineNumber(),
          `forbidden sensitive log or payload field: ${name}`,
          "Do not log cookies, tokens, passwords, storage, raw HTML, or PDF content.",
        ));
      }
    });
  }
  return findings;
};

const validateSensitiveDataAntiEscape = (
  auditProject: DomAutomationAuditProject,
): DomAutomationValidationResult => {
  const findings = [
    ...validateDomCoreBusinessVocabulary(auditProject),
    ...validateForbiddenPropertyAccess(auditProject),
    ...validateScriptLiteralAntiEscape(auditProject),
    ...validateLogFields(auditProject),
  ];
  return buildValidationResult({
    name: "sensitive-data-anti-escape",
    findings,
    coveredClauseIds: [
      "GRASSEYE-DOM-002-V1",
      "GRASSEYE-DOM-008-V1",
      "GRASSEYE-DOM-010-V1",
      "BLUEPRINT-08",
      "BLUEPRINT-11",
    ],
    passSummary: "sensitive data, business vocabulary, and log surfaces stay inside governed DOM and plugin boundaries.",
    failSummary: "DOM automation contains sensitive-data or anti-escape violations.",
  });
};
