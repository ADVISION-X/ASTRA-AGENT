import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { open, readdir, stat } from "node:fs/promises";
import path from "node:path";

export type YoutubeSubtitleDownload = {
  filePath: string;
  contentType: string;
  byteSize: number;
  language: string;
  sourceKind: "manual" | "automatic";
  extension: ".vtt" | ".srt";
};

type YoutubeOutputFiles = {
  video: {
    filePath: string;
    contentType: string;
    byteSize: number;
    durationMs: number;
    width: number;
    height: number;
  } | null;
  subtitles: YoutubeSubtitleDownload[];
};

type FfprobeStream = {
  codec_type?: unknown;
  width?: unknown;
  height?: unknown;
};

type FfprobeJson = {
  format?: { duration?: unknown };
  streams?: FfprobeStream[];
};

const execFileAsync = promisify(execFile);

const contentTypeForVideoPath = (filePath: string): string =>
  filePath.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4";

const subtitleContentType = (extension: ".vtt" | ".srt"): string =>
  extension === ".vtt" ? "text/vtt" : "application/x-subrip";

const isSupportedVideoFile = (filePath: string, bytes: Uint8Array): boolean => {
  const name = filePath.toLowerCase();
  const header = new TextDecoder("ascii").decode(bytes.slice(0, 16));
  return (
    (name.endsWith(".mp4") || name.endsWith(".m4v")) && header.slice(4, 12).includes("ftyp")
  ) || (
    name.endsWith(".webm") && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
  );
};

export const verifyFfprobeAvailable = async (): Promise<void> => {
  await execFileAsync("ffprobe", ["-version"], { timeout: 5_000, maxBuffer: 1024 * 1024 });
};

const numberField = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

const verifyMediaContainer = async (filePath: string): Promise<{
  durationMs: number;
  width: number;
  height: number;
} | null> => {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,width,height",
      "-of",
      "json",
      filePath,
    ], { timeout: 15_000, maxBuffer: 1024 * 1024 });
    const parsed = JSON.parse(stdout) as FfprobeJson;
    const videoStream = parsed.streams?.find((stream) => stream.codec_type === "video") ?? null;
    const duration = Number(parsed.format?.duration);
    const width = numberField(videoStream?.width);
    const height = numberField(videoStream?.height);
    if (!videoStream || !Number.isFinite(duration) || duration <= 0 || width === null || height === null) {
      return null;
    }
    return {
      durationMs: Math.round(duration * 1000),
      width,
      height,
    };
  } catch {
    return null;
  }
};

const readVideo = async (filePath: string): Promise<YoutubeOutputFiles["video"]> => {
  const fileStat = await stat(filePath);
  if (fileStat.size <= 1024) return null;
  const handle = await open(filePath, "r");
  const headerBytes = new Uint8Array(16);
  try {
    await handle.read(headerBytes, 0, headerBytes.length, 0);
  } finally {
    await handle.close();
  }
  if (!isSupportedVideoFile(filePath, headerBytes)) return null;
  const mediaProbe = await verifyMediaContainer(filePath);
  if (!mediaProbe) return null;
  return {
    filePath,
    contentType: contentTypeForVideoPath(filePath),
    byteSize: fileStat.size,
    durationMs: mediaProbe.durationMs,
    width: mediaProbe.width,
    height: mediaProbe.height,
  };
};

const parseSubtitleName = (fileName: string): {
  language: string;
  sourceKind: "manual" | "automatic";
  extension: ".vtt" | ".srt";
} | null => {
  const parts = fileName.split(".");
  const rawExtension = parts.at(-1);
  if (rawExtension !== "vtt" && rawExtension !== "srt") return null;
  const sourceKind = parts.at(-2) === "auto" ? "automatic" : "manual";
  const language = sourceKind === "automatic" ? parts.at(-3) : parts.at(-2);
  if (!language || ![...language].every((char) =>
    char === "-" ||
    char >= "A" && char <= "Z" ||
    char >= "a" && char <= "z")) {
    return null;
  }
  return {
    language,
    sourceKind,
    extension: `.${rawExtension}` as ".vtt" | ".srt",
  };
};

export const collectYtDlpOutputFiles = async (
  directory: string,
): Promise<YoutubeOutputFiles> => {
  const files = await readdir(directory);
  const videoFile = files.find((file) => {
    const lower = file.toLowerCase();
    return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".m4v");
  });
  const video = videoFile ? await readVideo(path.join(directory, videoFile)) : null;
  const subtitles: YoutubeSubtitleDownload[] = [];
  for (const file of files) {
    const parsed = parseSubtitleName(file);
    if (!parsed) continue;
    const filePath = path.join(directory, file);
    const fileStat = await stat(filePath);
    if (fileStat.size === 0) continue;
    subtitles.push({
      ...parsed,
      filePath,
      byteSize: fileStat.size,
      contentType: subtitleContentType(parsed.extension),
    });
  }
  return { video, subtitles };
};
