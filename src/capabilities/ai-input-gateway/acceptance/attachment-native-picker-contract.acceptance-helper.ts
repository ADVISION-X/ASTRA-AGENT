import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseNativeMultiFilePickerOutput } from "../../../lib/browser/current-chrome-native-multi-file-picker.js";

export const assertNativePickerContracts = async (): Promise<void> => {
  assert.deepEqual(
    parseNativeMultiFilePickerOutput(
      "SUCCESS\n001.json\n002.json\n003.json",
    ).observedFileNames,
    ["001.json", "002.json", "003.json"],
  );
  assert.equal(
    parseNativeMultiFilePickerOutput(
      "FAILED\nNATIVE_FILE_LIST_MISMATCH\nstale-parent-folder",
    ).message,
    "NATIVE_FILE_LIST_MISMATCH; observed=stale-parent-folder",
  );
  const nativePickerSource = await readFile(
    path.resolve("src/lib/browser/current-chrome-native-multi-file-picker.ts"),
    "utf8",
  );
  assert.equal(
    nativePickerSource.includes('attribute "AXFocusedUIElement"'),
    false,
    "native folder navigation must not trust an arbitrary process-focused text field",
  );
  for (const required of [
    "NATIVE_PICKER_FOLDER_NAVIGATION_ATTEMPTS",
    "NATIVE_PICKER_CONTROLLED_WINDOW_MISMATCH",
    "sheets of targetSheet",
    "text fields of folderSheet",
    "NATIVE_FOLDER_NAVIGATION_NOT_COMMITTED",
  ]) {
    assert.equal(
      nativePickerSource.includes(required),
      true,
      `native picker scoped navigation must include ${required}`,
    );
  }
};
