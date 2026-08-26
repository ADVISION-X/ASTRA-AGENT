export type HighImpactFinding = {
  category: "api" | "cli" | "event" | "queue" | "table" | "column"
    | "environment-variable" | "dependency" | "listener" | "external-host"
    | "browser-permission" | "cross-repo-contract";
  path: string;
  selector: string;
};

type Change = { status: string; path: string };
type Detector = Readonly<{
  category: HighImpactFinding["category"];
  applies: (change: Change) => boolean;
  pattern: RegExp;
}>;

const productSurface = (change: Change): boolean => /^(?:src|scripts|docs\/specs|\.github\/workflows)\//u.test(change.path)
  || ["package.json", "package-lock.json"].includes(change.path);

const detectors: readonly Detector[] = [
  { category: "api", applies: productSurface,
    pattern: /(?:\b(?:app|router)\.(?:delete|get|head|options|patch|post|put)\s*\(|["'`]\/api\/|createRoute\s*\()/u },
  { category: "cli", applies: (change) => change.path === "package.json" || change.path.startsWith("scripts/"),
    pattern: /(?:["'](?:bin|scripts)["']\s*:|process\.argv|parseArgs\s*\(|#!\s*\/usr\/bin\/env)/u },
  { category: "event", applies: productSurface,
    pattern: /(?:addEventListener\s*\(|dispatchEvent\s*\(|\.emit\s*\(|\.on\s*\(\s*["'`][a-zA-Z])/u },
  { category: "queue", applies: productSurface,
    pattern: /(?:\b(?:enqueue|dequeue|publishToQueue|consumeQueue|queueProducer|queueConsumer)\s*\(|\b(?:Queue|Worker)\s*\()/u },
  { category: "table", applies: productSurface,
    pattern: /\b(?:CREATE|DROP)\s+TABLE\b/iu },
  { category: "column", applies: productSurface,
    pattern: /\bALTER\s+TABLE\b[^;\n]*\b(?:ADD|DROP|RENAME)\s+(?:COLUMN\s+)?/iu },
  { category: "environment-variable", applies: productSurface,
    pattern: /(?:process\.env(?:\.[A-Z][A-Z0-9_]*|\[["'][A-Z][A-Z0-9_]*["']\])|import\.meta\.env\.[A-Z][A-Z0-9_]*)/u },
  { category: "dependency", applies: (change) => ["package.json", "package-lock.json"].includes(change.path),
    pattern: /["'](?:dependencies|devDependencies|optionalDependencies|peerDependencies)["']\s*:|^[ \t]*["'][^"']+["']\s*:\s*["'][~^<>=*0-9]/mu },
  { category: "listener", applies: productSurface,
    pattern: /(?:\.listen\s*\(|createServer\s*\(|addListener\s*\(|new\s+WebSocketServer\s*\(|\.on\s*\(\s*["'`](?:connection|request|upgrade|message))/u },
  { category: "external-host", applies: productSurface,
    pattern: /https?:\/\/(?!(?:127\.0\.0\.1|localhost)(?::|\/|$))[a-z0-9.-]+/iu },
  { category: "browser-permission", applies: (change) => productSurface(change)
      && /(?:manifest\.json$|chrome-extension|browser)/u.test(change.path),
    pattern: /["'](?:host_permissions|optional_host_permissions|permissions)["']\s*:|(?:chrome|browser)\.permissions\.(?:contains|request|remove)\s*\(/u },
  { category: "cross-repo-contract", applies: (change) => change.path.startsWith("docs/specs/") || productSurface(change),
    pattern: /(?:cross-repo-(?:contract|dependency)|providerRepo|consumerRepo|contractId)/u },
];

const selector = (line: string): string => line.trim().replace(/\s+/gu, " ").slice(0, 200);

export const detectHighImpactChanges = (
  changes: readonly Change[],
  addedSource: (change: Change) => string,
): HighImpactFinding[] => {
  const findings: HighImpactFinding[] = [];
  for (const change of changes) {
    const lines = addedSource(change).split("\n");
    for (const detector of detectors) {
      if (!detector.applies(change)) continue;
      const line = lines.find((candidate) => detector.pattern.test(candidate));
      if (line) findings.push({ category: detector.category, path: change.path, selector: selector(line) });
    }
  }
  return findings.sort((left, right) => `${left.category}\0${left.path}\0${left.selector}`
    .localeCompare(`${right.category}\0${right.path}\0${right.selector}`));
};
