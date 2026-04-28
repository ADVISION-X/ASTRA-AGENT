import { createPhase } from "../../core/result.js";
import { fileExists, listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { scanFilesForPatterns } from "../_shared/scan-for-patterns.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const LEGACY_FORENSICS_STORE_PATH = "src/capabilities/forensics-persistence/shared/store/evidence-store-service.ts";
const STORAGE_ADAPTER_PATH = "src/lib/storage/evidence-store/evidence-store-service.ts";

export default createPendingDomainInspector({
  inspector: "GrassEye Security Privacy Owner Inspector",
  inspectorId: "security-privacy-owner",
  capabilityDomain: "security-privacy",
  inspectorEntry: "scripts/audit/domains/security-privacy/inspector.ts",
  ownedPaths: ["src/lib/browser", "src/capabilities/forensics-persistence", "src/lib/storage", "src/lib/local-ai"],
  pendingSummary: "security-privacy implementation pending; manual-first law only; no code-level enforcement yet",
  implementedSummary: "security and privacy boundaries are enforced across local host binding, local data, and no secret export paths",
  extraChecks: async () => {
    const sourceFiles = await listFilesRecursive(pathFromRepoRoot("src"), { extensions: [".ts"] });
    const serverSource = await readTextFile(pathFromRepoRoot("src/app/server.ts"));
    const evidenceStorePath = await fileExists(pathFromRepoRoot(LEGACY_FORENSICS_STORE_PATH))
      ? LEGACY_FORENSICS_STORE_PATH
      : STORAGE_ADAPTER_PATH;
    const evidenceStoreSource = await readTextFile(pathFromRepoRoot(evidenceStorePath));
    const findings = await scanFilesForPatterns(sourceFiles, [
      {
        lawId: "GRASSEYE-SECURITY-PRIVACY-001-V1",
        severity: "error",
        pattern: /console\.(log|info|warn|error)\([^\n]*(access[_-]?token|refresh[_-]?token|session[_-]?token|auth[_-]?token|cookies?|password)/i,
        message: "Sensitive token, cookie, session, or password appears in logs.",
      },
      {
        lawId: "GRASSEYE-SECURITY-PRIVACY-001-V1",
        severity: "error",
        pattern: /export\s+(const|let|var|function|class|async function)\s+(raw|stored|saved|exported)?\s*(cookies?|cookieJar|access[_-]?token|refresh[_-]?token|session[_-]?token|auth[_-]?token|password)\b/i,
        message: "Source appears to export cookies, sessions, or tokens.",
      },
      {
        lawId: "GRASSEYE-SECURITY-PRIVACY-001-V1",
        severity: "error",
        pattern: /0\.0\.0\.0|public exposure/i,
        message: "Public exposure pattern found in source tree.",
      },
      {
        lawId: "GRASSEYE-SECURITY-PRIVACY-001-V1",
        severity: "error",
        pattern: /browserless|remote browser|stealth|anti-detect|fingerprint spoof|proxy pool/i,
        message: "Forbidden remote-browser or anti-detection pattern found in source tree.",
      }
    ]);

    const localBoundaryPassed =
      serverSource.includes('process.env.GRASSEYE_HOST ?? "127.0.0.1"') &&
      evidenceStoreSource.includes("this.dataDir") &&
      evidenceStoreSource.includes("artifactsDir") &&
      !evidenceStoreSource.includes("cookie") &&
      !/export\s+(const|let|var|function|class|async function)\s+(raw|stored|saved|exported)?\s*(cookies?|cookieJar|access[_-]?token|refresh[_-]?token|session[_-]?token|auth[_-]?token|password)\b/i.test(evidenceStoreSource);

    return {
      findings,
      phases: [
        createPhase(
          "local-security-boundary",
          localBoundaryPassed ? "PASS" : "LAW-SCRIPT DRIFT",
          localBoundaryPassed,
          localBoundaryPassed
            ? "Local host binding and local evidence storage stay inside the authorized local environment."
            : "Security boundary drifted away from local-only host or storage posture.",
        ),
        createPhase(
          "sensitive-surface-scan",
          findings.length === 0 ? "PASS" : "CODE VIOLATION",
          findings.length === 0,
          findings.length === 0
            ? "No obvious sensitive export or public exposure pattern was found in source files."
            : "Sensitive export or public exposure pattern was found in source files.",
        ),
      ],
    };
  },
});