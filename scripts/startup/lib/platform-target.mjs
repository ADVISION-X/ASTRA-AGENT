import { createInterface } from "node:readline/promises";

const ALLOWED_PLATFORM_TARGETS = new Set(["tiktok-web", "facebook-web"]);

function getPlatformFlagValue(argv) {
  const platformFlagIndex = argv.findIndex((value) => value === "--platform" || value.startsWith("--platform="));
  const inlinePlatformTarget = platformFlagIndex >= 0 && argv[platformFlagIndex]?.startsWith("--platform=")
    ? argv[platformFlagIndex].slice("--platform=".length).trim()
    : "";
  const positionalPlatformTarget = platformFlagIndex >= 0 && argv[platformFlagIndex] === "--platform"
    ? (argv[platformFlagIndex + 1] ?? "").trim()
    : "";
  return inlinePlatformTarget || positionalPlatformTarget;
}

function normalizePlatformChoice(value) {
  if (value === "1") {
    return "facebook-web";
  }
  if (value === "2") {
    return "tiktok-web";
  }
  return value;
}

export function parseStartupFlags(argv, env = process.env) {
  const flagPlatformTarget = getPlatformFlagValue(argv);
  const envPlatformTarget = env.GRASSEYE_PLATFORM_TARGET?.trim() ?? "";
  return {
    updateRequested: argv.includes("--update"),
    skipOpen: argv.includes("--no-open") || env.GRASSEYE_SKIP_OPEN === "1",
    requestedPlatformTarget: flagPlatformTarget || envPlatformTarget,
    platformSource: flagPlatformTarget ? "flag" : envPlatformTarget ? "env" : "missing",
  };
}

export function shouldPromptForStartupPlatform(flags, io = process) {
  return !flags.requestedPlatformTarget && Boolean(io.stdin && io.stdout && io.stdin.isTTY && io.stdout.isTTY);
}

async function promptForPlatformTarget(io = process) {
  const prompt = createInterface({ input: io.stdin, output: io.stdout });

  try {
    while (true) {
      const answer = normalizePlatformChoice((await prompt.question("Select startup platform [1] facebook-web [2] tiktok-web: ")).trim());
      if (ALLOWED_PLATFORM_TARGETS.has(answer)) {
        return answer;
      }
      io.stdout.write("Invalid platform. Enter 1, 2, facebook-web, or tiktok-web.\n");
    }
  } finally {
    prompt.close();
  }
}

export async function resolveStartupPlatformTarget(flags, io = process) {
  const requestedPlatformTarget = flags.requestedPlatformTarget?.trim() ?? "";
  if (ALLOWED_PLATFORM_TARGETS.has(requestedPlatformTarget)) {
    return {
      ...flags,
      platformTarget: requestedPlatformTarget,
      platformSource: flags.platformSource,
    };
  }

  if (requestedPlatformTarget) {
    throw new Error("STARTUP_PLATFORM_TARGET_INVALID: expected facebook-web|tiktok-web.");
  }

  if (shouldPromptForStartupPlatform(flags, io)) {
    return {
      ...flags,
      platformTarget: await promptForPlatformTarget(io),
      platformSource: "prompt",
    };
  }

  throw new Error("STARTUP_PLATFORM_TARGET_REQUIRED: provide --platform=facebook-web|tiktok-web, set GRASSEYE_PLATFORM_TARGET, or run from an interactive terminal and choose a platform.");
}