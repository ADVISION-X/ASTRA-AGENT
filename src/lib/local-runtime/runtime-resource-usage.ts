import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_PROCESS_LIMIT = 12;
const MAX_PROCESS_LIMIT = 40;

type RawProcessSnapshot = {
  pid: number;
  ppid: number;
  cpuPercent: number;
  rssKb: number;
  vszKb: number;
  elapsed: string;
  state: string;
  command: string;
  tags: string[];
};

type PsLineTextFields = {
  pidText: string;
  ppidText: string;
  cpuPercentText: string;
  rssKbText: string;
  vszKbText: string;
  elapsed: string;
  state: string;
  command: string;
};

const hasCompletePsLineTextFieldTuple = (
  values: readonly [
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
  ],
): values is readonly [string, string, string, string, string, string, string, string] =>
  values.every((value) => value !== undefined);

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_PROCESS_LIMIT;
  }
  return Math.max(1, Math.min(MAX_PROCESS_LIMIT, Math.trunc(limit ?? DEFAULT_PROCESS_LIMIT)));
}

function toMb(kb: number): number {
  return Math.round((kb / 1024) * 10) / 10;
}

const RUNTIME_RESOURCE_USAGE_TAG_RULES = [
  { tag: "workbench-server", matches: (normalizedCommand: string, pid: number) => pid === process.pid },
  { tag: "ollama-runner", matches: (normalizedCommand: string) => normalizedCommand.includes("ollama runner") },
  { tag: "ollama", matches: (normalizedCommand: string) => !normalizedCommand.includes("ollama runner") && normalizedCommand.includes("ollama") },
  { tag: "chrome", matches: (normalizedCommand: string) => normalizedCommand.includes("google chrome helper") || normalizedCommand.includes("google chrome") },
  { tag: "grasseye-app-server", matches: (normalizedCommand: string) => normalizedCommand.includes("dist/src/app/server.js") },
  { tag: "grasseye-dev-server", matches: (normalizedCommand: string) => normalizedCommand.includes("tsx src/app/server.ts") },
  { tag: "esbuild", matches: (normalizedCommand: string) => normalizedCommand.includes("esbuild") },
] as const;

function buildTags(command: string, pid: number): string[] {
  const normalizedCommand = command.toLowerCase();
  return RUNTIME_RESOURCE_USAGE_TAG_RULES.flatMap((rule) => (rule.matches(normalizedCommand, pid) ? [rule.tag] : []));
}

function extractPsLineTextFields(match: RegExpMatchArray): PsLineTextFields | null {
  const values = [match[1], match[2], match[3], match[4], match[5], match[6], match[7], match[8]] as const;
  if (!hasCompletePsLineTextFieldTuple(values)) {
    return null;
  }

  const [pidText, ppidText, cpuPercentText, rssKbText, vszKbText, elapsed, state, command] = values;
  return {
    pidText,
    ppidText,
    cpuPercentText,
    rssKbText,
    vszKbText,
    elapsed,
    state,
    command,
  };
}

function parsePsLineNumericFields(fields: PsLineTextFields) {
  const parsedPid = Number.parseInt(fields.pidText, 10);
  const parsedPpid = Number.parseInt(fields.ppidText, 10);
  const parsedCpuPercent = Number.parseFloat(fields.cpuPercentText);
  const parsedRssKb = Number.parseInt(fields.rssKbText, 10);
  const parsedVszKb = Number.parseInt(fields.vszKbText, 10);

  if (![parsedPid, parsedPpid, parsedCpuPercent, parsedRssKb, parsedVszKb].every(Number.isFinite)) {
    return null;
  }

  return {
    pid: parsedPid,
    ppid: parsedPpid,
    cpuPercent: parsedCpuPercent,
    rssKb: parsedRssKb,
    vszKb: parsedVszKb,
  };
}

function parsePsLineParts(match: RegExpMatchArray) {
  const textFields = extractPsLineTextFields(match);
  if (!textFields) {
    return null;
  }

  const numericFields = parsePsLineNumericFields(textFields);
  if (!numericFields) {
    return null;
  }

  return {
    ...numericFields,
    elapsed: textFields.elapsed,
    state: textFields.state,
    command: textFields.command,
  };
}

function parsePsLine(line: string): RawProcessSnapshot | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const match = line.match(/^\s*(\d+)\s+(\d+)\s+([0-9.]+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.*)$/);
  if (!match) {
    return null;
  }

  const parsed = parsePsLineParts(match);
  if (!parsed) {
    return null;
  }

  return {
    ...parsed,
    tags: buildTags(parsed.command, parsed.pid),
  };
}

async function listProcessSnapshots(): Promise<{ processes: RawProcessSnapshot[]; collectionError: string | null }> {
  try {
    const { stdout } = await execFileAsync(
      "ps",
      ["-axo", "pid=,ppid=,%cpu=,rss=,vsz=,etime=,state=,command="],
      { maxBuffer: 1024 * 1024 * 4 },
    );
    return {
      processes: stdout
        .split(/\r?\n/u)
        .map((line) => parsePsLine(line))
        .filter((processSnapshot): processSnapshot is RawProcessSnapshot => processSnapshot !== null),
      collectionError: null,
    };
  } catch (error) {
    return {
      processes: [],
      collectionError: error instanceof Error ? error.message : String(error),
    };
  }
}

function serializeProcess(processSnapshot: RawProcessSnapshot) {
  return {
    pid: processSnapshot.pid,
    ppid: processSnapshot.ppid,
    cpuPercent: processSnapshot.cpuPercent,
    rssKb: processSnapshot.rssKb,
    rssMb: toMb(processSnapshot.rssKb),
    vszKb: processSnapshot.vszKb,
    vszMb: toMb(processSnapshot.vszKb),
    elapsed: processSnapshot.elapsed,
    state: processSnapshot.state,
    command: processSnapshot.command,
    tags: processSnapshot.tags,
  };
}

function buildResourceUsageCollections(processes: RawProcessSnapshot[], processLimit: number) {
  const byRssThenCpu = [...processes].sort((left, right) => right.rssKb - left.rssKb || right.cpuPercent - left.cpuPercent);
  return {
    interestingProcesses: processes
      .filter((processSnapshot) => processSnapshot.tags.length > 0)
      .sort((left, right) => right.rssKb - left.rssKb || right.cpuPercent - left.cpuPercent)
      .slice(0, processLimit)
      .map(serializeProcess),
    topByRss: byRssThenCpu.slice(0, processLimit).map(serializeProcess),
    topByCpu: [...processes]
      .sort((left, right) => right.cpuPercent - left.cpuPercent || right.rssKb - left.rssKb)
      .slice(0, processLimit)
      .map(serializeProcess),
  };
}

function buildResourceUsageHost() {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    pid: process.pid,
    ppid: process.ppid,
    uptimeSeconds: Math.round(process.uptime()),
    loadAverage: os.loadavg(),
    totalMemoryBytes: os.totalmem(),
    freeMemoryBytes: os.freemem(),
    cpuCount: os.cpus().length,
  };
}

function buildResourceUsageNodeProcess(nodeMemoryUsage: NodeJS.MemoryUsage) {
  return {
    rssBytes: nodeMemoryUsage.rss,
    heapTotalBytes: nodeMemoryUsage.heapTotal,
    heapUsedBytes: nodeMemoryUsage.heapUsed,
    externalBytes: nodeMemoryUsage.external,
    arrayBuffersBytes: nodeMemoryUsage.arrayBuffers,
  };
}

export async function getRuntimeResourceUsageSnapshot(input?: { limit?: number; modeInfo?: unknown }) {
  const processLimit = normalizeLimit(input?.limit);
  const [{ processes, collectionError }] = await Promise.all([listProcessSnapshots()]);
  const nodeMemoryUsage = process.memoryUsage();
  const collections = buildResourceUsageCollections(processes, processLimit);

  return {
    capturedAt: new Date().toISOString(),
    processLimit,
    modeInfo: input?.modeInfo ?? null,
    host: buildResourceUsageHost(),
    nodeProcess: buildResourceUsageNodeProcess(nodeMemoryUsage),
    processCollectionError: collectionError,
    ...collections,
  };
}