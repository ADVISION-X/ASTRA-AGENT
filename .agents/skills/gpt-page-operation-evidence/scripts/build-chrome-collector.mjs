import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import esbuild from "esbuild";
import { BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE } from "../../../../src/lib/browser/chrome-extension/dom-semantic-text.ts";

const outputIndex = process.argv.indexOf("--output");
const output = outputIndex < 0 ? null : process.argv[outputIndex + 1];
if (!output || !resolve(output).startsWith("/tmp/")) {
  throw new Error("CHROME_COLLECTOR_OUTSIDE_REPO_OUTPUT_REQUIRED");
}
const entry = new URL("./chrome-scene-collector.mjs", import.meta.url).pathname;
await esbuild.build({
  entryPoints: [entry],
  outfile: resolve(output),
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  target: "node24",
  logLevel: "silent",
  plugins: [{
    name: "inline-production-semantic-reader",
    setup(build) {
      build.onLoad({ filter: /chrome-scene-collector\.mjs$/ }, async (args) => {
        let contents = await readFile(args.path, "utf8");
        const readerAnchor = "      const semanticText = browserCanonicalSemanticText;\n";
        const callbackStart = "    const callbackSource = readPage.toString().replace(";
        const callbackEnd = "    const semanticProjectionDrift = rawPacket.pageInputFacts.semanticProjectionDrift === true;";
        const start = contents.indexOf(callbackStart);
        const end = contents.indexOf(callbackEnd, start);
        if (start < 0 || end < 0 || !contents.slice(0, start).includes(readerAnchor)) {
          throw new Error("CHROME_COLLECTOR_BUILD_ANCHOR_DRIFT");
        }
        contents = `${contents.slice(0, start)}    const rawPacket = await roots.evaluateAll(readPage,\n      { marker: productMarker, attachmentUploadArmed: attachmentUploadExpected });\n${contents.slice(end)}`;
        contents = contents.replace(readerAnchor,
          `${BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE}\n${readerAnchor}`);
        return { contents, loader: "js" };
      });
    },
  }],
});
console.log("CHROME_COLLECTOR_STATIC_BUNDLE_READY");
