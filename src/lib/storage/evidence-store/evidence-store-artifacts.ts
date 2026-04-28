import { copyFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ImageEvidenceInput = {
  kind: "video-screenshot" | "comment-screenshot";
  taskRunId: string;
  roundId: string;
  platformId: string;
  sourceId: string;
  sourceUrl: string;
  regionLabel: string;
  regionType: string;
  summary: string;
  width: number;
  height: number;
  contentLines?: string[];
  sourceFilePath?: string;
};

function xmlEscape(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function createSvgArtifact(title: string, lines: string[]): string {
  const textBlocks = [title, ...lines].map((line, index) => `<text x="24" y="${36 + index * 24}" font-size="16" font-family="monospace">${xmlEscape(line)}</text>`);
  const height = Math.max(220, 60 + textBlocks.length * 24);
  const frameHeight = Math.max(188, 28 + textBlocks.length * 24);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${height}" viewBox="0 0 960 ${height}">
  <rect width="960" height="100%" fill="#0d1117" />
  <rect x="16" y="16" width="928" height="${frameHeight}" rx="12" fill="#161b22" stroke="#30363d" />
  ${textBlocks.join("\n  ")}
</svg>`;
}

export async function persistImageArtifact(input: {
  artifactsDir: string;
  evidenceId: string;
  title: string;
  contentLines?: string[];
  sourceFilePath?: string;
}): Promise<string> {
  if (input.sourceFilePath) {
    const sourceExtension = path.extname(input.sourceFilePath) || ".png";
    const artifactPath = path.join(input.artifactsDir, `${input.evidenceId}${sourceExtension}`);
    await copyFile(input.sourceFilePath, artifactPath);
    return artifactPath;
  }

  const artifactPath = path.join(input.artifactsDir, `${input.evidenceId}.svg`);
  const svg = createSvgArtifact(input.title, input.contentLines ?? []);
  await writeFile(artifactPath, svg, "utf8");
  return artifactPath;
}