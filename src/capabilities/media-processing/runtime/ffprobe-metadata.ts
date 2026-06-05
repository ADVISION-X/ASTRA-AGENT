import { spawn } from "node:child_process";

export type FfprobeVideoMetadata = {
  width: number;
  height: number;
  durationMs: number;
  format: string;
  videoCodec: string;
  audioCodec: string | null;
  fastStart: boolean;
};

type FfprobeStream = {
  codec_name?: unknown;
  codec_type?: unknown;
  height?: unknown;
  width?: unknown;
};

type FfprobeJson = {
  format?: {
    duration?: unknown;
    format_name?: unknown;
  };
  streams?: FfprobeStream[];
};

const runFfprobeJson = async (input: {
  ffprobePath: string;
  filePath: string;
  timeoutMs: number;
}): Promise<FfprobeJson> =>
  new Promise((resolve, reject) => {
    const child = spawn(input.ffprobePath, [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      input.filePath,
    ], { stdio: ["ignore", "pipe", "ignore"] });
    let stdout = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("ffprobe_timeout"));
    }, input.timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`ffprobe_exit_${code ?? "signal"}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as FfprobeJson);
      } catch {
        reject(new Error("ffprobe_invalid_json"));
      }
    });
  });

const positiveNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

const positiveInteger = (value: unknown): number | null => {
  const number = positiveNumber(value);
  return number === null ? null : Math.trunc(number);
};

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export const probeVideoOutputMetadata = async (input: {
  ffprobePath: string;
  filePath: string;
  timeoutMs: number;
}): Promise<FfprobeVideoMetadata> => {
  const metadata = await runFfprobeJson(input);
  const videoStream = metadata.streams?.find((stream) => stream.codec_type === "video");
  const audioStream = metadata.streams?.find((stream) => stream.codec_type === "audio");
  const width = positiveInteger(videoStream?.width);
  const height = positiveInteger(videoStream?.height);
  const durationSeconds = positiveNumber(Number(metadata.format?.duration));
  const rawFormat = stringValue(metadata.format?.format_name);
  const format = rawFormat?.split(",").includes("mp4") ? "mp4" : rawFormat?.split(",")[0] ?? null;
  const videoCodec = stringValue(videoStream?.codec_name);
  if (width === null || height === null || durationSeconds === null || format === null || videoCodec === null) {
    throw new Error("ffprobe_missing_required_video_metadata");
  }
  return {
    width,
    height,
    durationMs: Math.round(durationSeconds * 1000),
    format,
    videoCodec,
    audioCodec: stringValue(audioStream?.codec_name),
    fastStart: rawFormat?.split(",").includes("mp4") ?? false,
  };
};
