#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, unlink, utimes, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, parse, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function fail(code, detail = "") {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--") || !argv[index + 1]) fail("ARGUMENT_INVALID", token);
    result[token.slice(2)] = argv[index + 1];
    index += 1;
  }
  return result;
}

function sha256(buffer) {
  return `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
}

async function mustNotExist(path) {
  try {
    await stat(path);
    fail("FIXTURE_ALREADY_EXISTS", path);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function describe(path) {
  const data = await readFile(path);
  return { kind: "SYNTHETIC_FIXTURE", fileName: basename(path), bytes: data.length, sha256: sha256(data) };
}

function describeText(value) {
  return { kind: "SYNTHETIC_FIXTURE", value, length: value.length, sha256: sha256(Buffer.from(value)) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir || !isAbsolute(args.dir)) fail("ABSOLUTE_DIR_REQUIRED");
  if (!args["run-id"] || !/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(args["run-id"])) fail("RUN_ID_INVALID");
  const directory = resolve(args.dir);
  if ([parse(directory).root, "/tmp", "/var/tmp"].includes(directory)) fail("FIXTURE_DIR_TOO_BROAD", directory);
  await mkdir(directory, { recursive: true });

  const marker = `GPT-EVIDENCE-${args["run-id"]}`;
  const sourceTurnMarker = `${marker}-SOURCE-TURN`;
  const textPath = join(directory, `${marker}-sample.txt`);
  const jsonPath = join(directory, `${marker}-sample.json`);
  const zipEntryPath = join(directory, `${marker}-zip-entry.txt`);
  const zipPath = join(directory, `${marker}-sample.zip`);
  const unsupportedPath = join(directory, `${marker}-unsupported.exe`);
  const manifestPath = join(directory, `${marker}-manifest.json`);
  for (const path of [textPath, jsonPath, zipEntryPath, zipPath, unsupportedPath, manifestPath]) {
    await mustNotExist(path);
  }

  const textBody = [
    `${marker}`,
    "This is a synthetic attachment for GPT page-operation evidence collection.",
    "中文、English、emoji: 🧪",
    "No user or production data is present.",
    ""
  ].join("\n");
  const jsonBody = `${JSON.stringify({ marker, synthetic: true, items: [1, 2, 3], note: "离线实证附件" }, null, 2)}\n`;
  const zipEntryBody = `${marker}\nUTF-8 opaque ZIP fixture: 玄学 / evidence / 🧪\n`;
  await writeFile(textPath, textBody, "utf8");
  await writeFile(jsonPath, jsonBody, "utf8");
  await writeFile(zipEntryPath, zipEntryBody, "utf8");
  const fixedTime = new Date("2020-01-01T00:00:00.000Z");
  await utimes(zipEntryPath, fixedTime, fixedTime);

  const zip = spawnSync("/usr/bin/zip", ["-X", "-q", basename(zipPath), basename(zipEntryPath)], {
    cwd: directory,
    encoding: "utf8"
  });
  if (zip.status !== 0) fail("ZIP_CREATION_FAILED", zip.stderr.trim());
  await unlink(zipEntryPath);
  await writeFile(
    unsupportedPath,
    `${marker}\nHarmless text-only unsupported-extension fixture. No executable content.\n`,
    "utf8",
  );

  const richTextPrompt = [
    `${marker}`,
    "请只基于这个合成测试标记生成一份短响应，并严格包含：",
    "# 一级标题",
    "一段同时包含 **粗体**、*斜体*、`inline-code`、中文、English 和 emoji 🧪 的文字。",
    "1. 两项有序列表",
    "2. 第二项",
    "- 两项无序列表",
    "- 第二项",
    "```json",
    `{\"marker\":\"${marker}\",\"synthetic\":true}`,
    "```",
    "最后一行必须恰好是：END-OF-SYNTHETIC-RESPONSE",
    ""
  ].join("\n");
  const imagePrompt = `${marker}\nCreate one simple square test image containing a blue circle, an orange triangle, and the visible synthetic marker ${marker}. No people, logos, or copyrighted characters.`;
  const staleDraft = `${marker} STALE-DRAFT-TO-CLEAR`;

  const attachments = {
    "synthetic-txt": await describe(textPath),
    "synthetic-json": await describe(jsonPath),
    "synthetic-zip": await describe(zipPath),
  };
  const manifest = {
    schemaVersion: "gpt-page-operation-fixtures.v2",
    runId: args["run-id"],
    marker,
    syntheticOnly: true,
    inputs: {
      "synthetic-conversation-marker": describeText(marker),
      "synthetic-source-turn-marker": describeText(sourceTurnMarker),
      "synthetic-rich-text-prompt": describeText(richTextPrompt),
      "synthetic-image-prompt": describeText(imagePrompt),
      "synthetic-stale-draft": describeText(staleDraft),
      ...attachments,
    },
    adversarialFixtures: {
      "unsupported-extension": await describe(unsupportedPath),
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({
    directory,
    manifest: manifestPath,
    marker,
    inputIds: Object.keys(manifest.inputs),
    attachments: Object.values(attachments),
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
