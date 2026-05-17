// Code Purity — structural health config.
// Governs module file limits, retired path detection, and purity scan roots.
// Does NOT contain business logic, action codes, or AI capability details.

export const CODE_PURITY_CONFIG = {
  // Production dirs to scan for purity violations.
  purityScanDirs: ["src", "scripts/audit"] as string[],

  // Paths excluded from purity scan (archives, generated, docs).
  allowedArchivePaths: ["归档", "prototypes", "archive", "generated"] as string[],

  // Capability module file count limits (structural complexity guard).
  moduleFileLimits: {
    "src/capabilities/mouse-click": 20,
    "src/capabilities/ai": 20,
    "src/capabilities/commander-console": 70,
    "src/capabilities/forensics-persistence": 18,
    "src/capabilities/geometry-guard": 20,
    "src/capabilities/orchestration": 30,
    "src/capabilities/nerve-bus": 14,
    "src/lib/local-runtime": 20,
    "src/lib/online-ai": 8,
    "src/capabilities/screenshot": 20,
    "src/lib/storage": 8,
    "src/capabilities/text-input": 20,
    "src/capabilities/open": 18,
    "src/muscle-memory": 5,
  } as Record<string, number>,

  // Directories that MUST NOT exist (retired capability roots).
  retiredCapabilityRoots: [
    "src/capabilities/page-state",
    "src/capabilities/post-action-verification",
    "src/capabilities/visual-target",
  ] as string[],

  // Prefixes excluded from retired-surface scan (e.g., the scanner files themselves).
  retiredScanExcludedPrefixes: [
    "scripts/audit/domains/code-purity",
    "scripts/audit/domains/quality-kernel",
  ] as string[],
} as const;
