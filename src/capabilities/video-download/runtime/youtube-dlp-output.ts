import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export type YoutubeSubtitleDownload = {
  bytes: Uint8Array;
  contentType: string;
  byteSize: number;
  language: string;
  sourceKind: "manual" | "automatic";
  extension: ".vtt" | ".srt";
};

export type YoutubeOutputFiles = {
  video: {
    bytes: Uint8Array;
    contentType: string;
    byteSize: number;
  } | null;
  subtitles: YoutubeSubtitleDownload[];
};

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

const readVideo = async (filePath: string): Promise<YoutubeOutputFiles["video"]> => {
  const fileStat = await stat(filePath);
  if (fileStat.size <= 1024) return null;
  const bytes = new Uint8Array(await readFile(filePath));
  if (!isSupportedVideoFile(filePath, bytes)) return null;
  return {
    bytes,
    contentType: contentTypeForVideoPath(filePath),
    byteSize: bytes.length,
  };
};

const parseSubtitleName = (fileName: string): {
  language: string;
  sourceKind: "manual" | "automatic";
  extension: ".vtt" | ".srt";
} | null => {
  const matched = fileName.match(/\.([a-zA-Z-]+)(?:\.auto)?\.(vtt|srt)$/u);
  if (!matched?.[1] || !matched[2]) return null;
  return {
    language: matched[1],
    sourceKind: fileName.includes(".auto.") ? "automatic" : "manual",
    extension: `.${matched[2]}` as ".vtt" | ".srt",
  };
};

export const collectYtDlpOutputFiles = async (
  directory: string,
): Promise<YoutubeOutputFiles> => {
  const files = await readdir(directory);
  const videoFile = files.find((file) => /\.(mp4|webm|m4v)$/iu.test(file));
  const video = videoFile ? await readVideo(path.join(directory, videoFile)) : null;
  const subtitles: YoutubeSubtitleDownload[] = [];
  for (const file of files) {
    const parsed = parseSubtitleName(file);
    if (!parsed) continue;
    const bytes = new Uint8Array(await readFile(path.join(directory, file)));
    if (bytes.length === 0) continue;
    subtitles.push({
      ...parsed,
      bytes,
      byteSize: bytes.length,
      contentType: subtitleContentType(parsed.extension),
    });
  }
  return { video, subtitles };
};
