import { createFinding } from "../../core/result.js";
import { getAuditProject, getSourceFileOrThrow } from "../../core/ts-morph.js";
import type { Finding } from "../../core/schema.js";

const CHILD_FILE = "src/capabilities/video-download/children/download-facebook-video-once.ts";
const MANIFEST_FILE = "src/capabilities/video-download/manifest.ts";
const VALIDATION_FILE = "src/capabilities/video-download/runtime/candidate-validation.ts";
const DOWNLOAD_FILE = "src/capabilities/video-download/runtime/media-download.ts";

const astFinding = (
  lawId: string,
  file: string,
  message: string,
  hint: string,
): Finding => createFinding({
    lawId,
    file,
    line: 1,
    severity: "fatal",
    message,
    hint,
  });

const hasExport = (filePath: string, exportName: string): boolean => {
  const project = getAuditProject();
  const sourceFile = getSourceFileOrThrow(project, filePath);
  return sourceFile.getExportedDeclarations().has(exportName);
};

const hasImportFrom = (
  filePath: string,
  importedName: string,
  moduleFragment: string,
): boolean => {
  const project = getAuditProject();
  const sourceFile = getSourceFileOrThrow(project, filePath);
  return sourceFile.getImportDeclarations().some((declaration) =>
    declaration.getModuleSpecifierValue().includes(moduleFragment)
      && declaration.getNamedImports().some((namedImport) => namedImport.getName() === importedName));
};

const hasCallExpression = (filePath: string, calleeName: string): boolean => {
  const project = getAuditProject();
  const sourceFile = getSourceFileOrThrow(project, filePath);
  return sourceFile.getDescendants().some((node) =>
    node.getKindName() === "CallExpression" && node.getText().startsWith(`${calleeName}(`));
};

type RequiredTextCheck = {
  lawId: string;
  filePath: string;
  token: string;
  message: string;
  hint: string;
};

const hasRequiredText = (input: RequiredTextCheck): Finding[] => {
  const project = getAuditProject();
  const sourceFile = getSourceFileOrThrow(project, input.filePath);
  return sourceFile.getFullText().includes(input.token)
    ? []
    : [astFinding(input.lawId, input.filePath, input.message, input.hint)];
};

const collectExportFindings = (): Finding[] => {
  const findings: Finding[] = [];
  if (!hasExport(CHILD_FILE, "downloadFacebookVideoOnce")) {
    findings.push(astFinding(
      "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-003-V1",
      CHILD_FILE,
      "Facebook child capability export is missing",
      "Export downloadFacebookVideoOnce from the child runtime file.",
    ));
  }
  if (!hasExport(MANIFEST_FILE, "VIDEO_DOWNLOAD_CATALOG_ENTRIES")) {
    findings.push(astFinding(
      "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-003-V1",
      MANIFEST_FILE,
      "video-download catalog extension export is missing",
      "Export VIDEO_DOWNLOAD_CATALOG_ENTRIES from the owner manifest.",
    ));
  }
  return findings;
};

const collectChildRuntimeFindings = (): Finding[] => {
  const findings: Finding[] = [];
  if (!hasImportFrom(CHILD_FILE, "FACEBOOK_MEDIA_PROBE_SCRIPT", "facebook-page-probe-script")) {
    findings.push(astFinding("GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-004-V1", CHILD_FILE, "Facebook child does not import the browser DOM media probe", "Collect media candidates through the owner probe script."));
  }
  for (const calleeName of ["validateFacebookMediaCandidate", "downloadValidatedMedia"]) {
    if (!hasCallExpression(CHILD_FILE, calleeName)) {
      findings.push(astFinding("GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-004-V1", CHILD_FILE, `Facebook child does not call ${calleeName}`, "Keep validation and download as separate enforced runtime steps."));
    }
  }
  return findings;
};

const collectRequiredTextFindings = (): Finding[] => [
  ...hasRequiredText({
    lawId: "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-002-V1",
    filePath: VALIDATION_FILE,
    token: "video\\.[a-z0-9.-]+\\.fbcdn\\.net",
    message: "Facebook CDN allowlist regex is missing",
    hint: "Validate candidate hosts before any media request.",
  }),
  ...hasRequiredText({
    lawId: "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-004-V1",
    filePath: VALIDATION_FILE,
    token: "Range",
    message: "Range probe header is missing",
    hint: "Probe a small byte range before full media download.",
  }),
  ...hasRequiredText({
    lawId: "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-004-V1",
    filePath: VALIDATION_FILE,
    token: "ftyp",
    message: "MP4 ftyp validation is missing",
    hint: "Require MP4 header proof before artifact creation.",
  }),
  ...hasRequiredText({
    lawId: "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-005-V1",
    filePath: DOWNLOAD_FILE,
    token: "maxBytes",
    message: "download byte ceiling is missing",
    hint: "Reject media downloads that exceed the configured maxBytes.",
  }),
];

export const collectVideoDownloadAstEvidenceFindings = (): Finding[] => [
  ...collectExportFindings(),
  ...collectChildRuntimeFindings(),
  ...collectRequiredTextFindings(),
];
