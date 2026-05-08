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

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_PROCESS_LIMIT;
  }
  return Math.max(1, Math.min(MAX_PROCESS_LIMIT, Math.trunc(limit ?? DEFAULT_PROCESS_LIMIT)));
}

function toMb(kb: number): number {
  return Math.round((kb / 1024) * 10) / 10;
}

function buildTags(command: string, pid: number): string[] {
  const normalizedCommand = command.toLowerCase();
  const tags: string[] = [];

  if (pid === process.pid) {
    tags.push("workbench-server");
  }
  if (normalizedCommand.includes("ollama runner")) {
    tags.push("ollama-runner");
  } else if (normalizedCommand.includes("ollama")) {
    tags.push("ollama");
  }
  if (normalizedCommand.includes("google chrome helper") || normalizedCommand.includes("google chrome")) {
    tags.push("chrome");
  }
  if (normalizedCommand.includes("dist/src/app/server.js")) {
    tags.push("grasseye-app-server");
  }
  if (normalizedCommand.includes("tsx src/app/server.ts")) {
    tags.push("grasseye-dev-server");
  }
  if (normalizedCommand.includes("esbuild")) {
    tags.push("esbuild");
  }
  return tags;
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

  const pid = match[1];
  const ppid = match[2];
  const cpuPercent = match[3];
  const rssKb = match[4];
  const vszKb = match[5];
  const elapsed = match[6];
  const state = match[7];
  const command = match[8];
  if (!pid || !ppid || !cpuPercent || !rssKb || !vszKb || !elapsed || !state || !command) {
    return null;
  }

  const parsedPid = Number.parseInt(pid, 10);
  const parsedPpid = Number.parseInt(ppid, 10);
  const parsedCpuPercent = Number.parseFloat(cpuPercent);
  const parsedRssKb = Number.parseInt(rssKb, 10);
  const parsedVszKb = Number.parseInt(vszKb, 10);

  if (![parsedPid, parsedPpid, parsedCpuPercent, parsedRssKb, parsedVszKb].every(Number.isFinite)) {
    return null;
  }

  return {
    pid: parsedPid,
    ppid: parsedPpid,
    cpuPercent: parsedCpuPercent,
    rssKb: parsedRssKb,
    vszKb: parsedVszKb,
    elapsed,
    state,
    command,
    tags: buildTags(command, parsedPid),
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

export async function getRuntimeResourceUsageSnapshot(input?: { limit?: number; modeInfo?: unknown }) {
  const processLimit = normalizeLimit(input?.limit);
  const [{ processes, collectionError }] = await Promise.all([listProcessSnapshots()]);
  const nodeMemoryUsage = process.memoryUsage();
  const interestingProcesses = processes
    .filter((processSnapshot) => processSnapshot.tags.length > 0)
    .sort((left, right) => right.rssKb - left.rssKb || right.cpuPercent - left.cpuPercent)
    .slice(0, processLimit)
    .map(serializeProcess);
  const topByRss = [...processes]
    .sort((left, right) => right.rssKb - left.rssKb || right.cpuPercent - left.cpuPercent)
    .slice(0, processLimit)
    .map(serializeProcess);
  const topByCpu = [...processes]
    .sort((left, right) => right.cpuPercent - left.cpuPercent || right.rssKb - left.rssKb)
    .slice(0, processLimit)
    .map(serializeProcess);

  return {
    capturedAt: new Date().toISOString(),
    processLimit,
    modeInfo: input?.modeInfo ?? null,
    host: {
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
    },
    nodeProcess: {
      rssBytes: nodeMemoryUsage.rss,
      heapTotalBytes: nodeMemoryUsage.heapTotal,
      heapUsedBytes: nodeMemoryUsage.heapUsed,
      externalBytes: nodeMemoryUsage.external,
      arrayBuffersBytes: nodeMemoryUsage.arrayBuffers,
    },
    processCollectionError: collectionError,
    interestingProcesses,
    topByRss,
    topByCpu,
  };
}