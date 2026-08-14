import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import type {
  BrowserTargetSession,
  BrowserNativeMultiFilePickerResult,
} from "./browser-controller.js";
import { createCurrentChromeBrowserActionResult } from "./current-chrome-browser-action-result.js";

type NativePickerInput = Parameters<NonNullable<BrowserTargetSession["selectFilesInNativePicker"]>>[0];
type NativePickerWindowIdentity = { windowX: number; windowY: number; width: number; height: number };

const execFileAsync = promisify(execFile);
const escapeAppleScriptText = (value: string): string => value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
const runAppleScript = async (script: string, options?: { signal?: AbortSignal }): Promise<string> => {
  const { stdout } = await execFileAsync("/usr/bin/osascript", ["-e", script], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    ...(options?.signal ? { signal: options.signal } : {}),
  });
  return stdout.trim();
};

const NATIVE_PICKER_PROCESS_TIMEOUT_MS = 35_000;
const NATIVE_PICKER_CLEANUP_TIMEOUT_MS = 5_000;
const NATIVE_PICKER_FOLDER_NAVIGATION_ATTEMPTS = 3;

const appleScriptList = (values: readonly string[]): string =>
  `{${values.map((value) => `"${escapeAppleScriptText(value)}"`).join(", ")}}`;

const PICKER_FAILURE_HANDLER = `
on failAndClose(reasonCode, observedNames)
  tell application "System Events"
    tell process "Google Chrome"
      if (count of windows) is greater than 0 then
        if (count of sheets of window 1) is 1 then key code 53
      end if
    end tell
  end tell
  set AppleScript's text item delimiters to linefeed
  if (count of observedNames) is 0 then return "FAILED" & linefeed & reasonCode
  return "FAILED" & linefeed & reasonCode & linefeed & (observedNames as text)
end failAndClose
`;

const buildPickerInputContract = (input: {
  stagingDirectoryPath: string;
  expectedFileNames: readonly string[];
  windowIdentity: NativePickerWindowIdentity;
}): string => `
set expectedNames to ${appleScriptList(input.expectedFileNames)}
set reversedNames to ${appleScriptList([...input.expectedFileNames].reverse())}
set expectedCount to count of expectedNames
set observedNames to {}
set stagingDirectoryPath to "${escapeAppleScriptText(resolve(input.stagingDirectoryPath))}"
set expectedWindowPosition to {${input.windowIdentity.windowX}, ${input.windowIdentity.windowY}}
set expectedWindowSize to {${input.windowIdentity.width}, ${input.windowIdentity.height}}
`;

const PICKER_NAVIGATION_SCRIPT = `
with timeout of 25 seconds
  tell application "Google Chrome" to activate
  tell application "System Events"
    tell process "Google Chrome"
      set frontmost to true
      if (count of windows) is 0 then return "FAILED" & linefeed & "NATIVE_PICKER_CHROME_WINDOW_MISSING"
      if (position of window 1) is not expectedWindowPosition or (size of window 1) is not expectedWindowSize then
        return "FAILED" & linefeed & "NATIVE_PICKER_CONTROLLED_WINDOW_MISMATCH"
      end if
      perform action "AXRaise" of window 1

      set pickerSheetReady to false
      repeat with pollIndex from 1 to 50
        set pickerSheetCount to count of sheets of window 1
        if pickerSheetCount is greater than 1 then return "FAILED" & linefeed & "NATIVE_PICKER_AMBIGUOUS"
        if pickerSheetCount is 1 then
          set pickerSheetReady to true
          exit repeat
        end if
        delay 0.1
      end repeat
      if pickerSheetReady is false then return "FAILED" & linefeed & "NATIVE_PICKER_NOT_READY"

      set targetSheet to sheet 1 of window 1
      set folderFieldReady to false
      set folderSheet to missing value
      set folderField to missing value
      repeat with navigationAttempt from 1 to ${NATIVE_PICKER_FOLDER_NAVIGATION_ATTEMPTS}
        keystroke "g" using {command down, shift down}
        repeat with pollIndex from 1 to 50
          set nestedSheetCount to count of sheets of targetSheet
          if nestedSheetCount is greater than 1 then
            return my failAndClose("NATIVE_FOLDER_SHEET_AMBIGUOUS", {})
          end if
          if nestedSheetCount is 1 then
            set folderSheet to sheet 1 of targetSheet
            set folderFieldCount to count of text fields of folderSheet
            if folderFieldCount is greater than 1 then
              return my failAndClose("NATIVE_FOLDER_FIELD_AMBIGUOUS", {})
            end if
            if folderFieldCount is 1 then
              set folderField to text field 1 of folderSheet
              try
                set focused of folderField to true
              end try
              if focused of folderField is true then
                set folderFieldReady to true
                exit repeat
              end if
            end if
          end if
          delay 0.1
        end repeat
        if folderFieldReady is true then exit repeat
      end repeat
      if folderFieldReady is false then return my failAndClose("NATIVE_FOLDER_FIELD_NOT_FOCUSED", {})

      set the clipboard to stagingDirectoryPath
      keystroke "v" using command down
      key code 36
      set folderSheetClosed to false
      repeat with pollIndex from 1 to 50
        if (count of sheets of targetSheet) is 0 then
          set folderSheetClosed to true
          exit repeat
        end if
        delay 0.1
      end repeat
      if folderSheetClosed is false then return my failAndClose("NATIVE_FOLDER_NAVIGATION_NOT_COMMITTED", {})
      keystroke "2" using command down

      set fileOutline to missing value
      repeat with pollIndex from 1 to 50
        try
          set mainSplitGroup to UI element 1 of targetSheet
          set contentSplitGroup to UI element 3 of mainSplitGroup
          set contentScrollArea to UI element 1 of contentSplitGroup
          set candidateOutline to UI element 1 of contentScrollArea
          if role of candidateOutline is "AXOutline" then
            if ((count of rows of candidateOutline) - 1) is expectedCount then
              set fileOutline to candidateOutline
              exit repeat
            end if
          end if
        end try
        delay 0.1
      end repeat
      if fileOutline is missing value then return my failAndClose("NATIVE_FILE_LIST_COUNT_MISMATCH", {})
`;

const PICKER_ORDER_NORMALIZATION_SCRIPT = `
      set observedNames to {}
      repeat with rowIndex from 2 to count of rows of fileOutline
        set fileCell to UI element 1 of row rowIndex of fileOutline
        set fileNameField to UI element 2 of fileCell
        set end of observedNames to (value of fileNameField as text)
      end repeat

      set exactOrder to true
      set reverseOrder to true
      repeat with nameIndex from 1 to expectedCount
        if (item nameIndex of observedNames as text) is not (item nameIndex of expectedNames as text) then set exactOrder to false
        if (item nameIndex of observedNames as text) is not (item nameIndex of reversedNames as text) then set reverseOrder to false
      end repeat

      if exactOrder is false then
        if reverseOrder is false then return my failAndClose("NATIVE_FILE_LIST_MISMATCH", observedNames)
        set headerGroups to every UI element of fileOutline whose role is "AXGroup"
        if (count of headerGroups) is not 1 then return my failAndClose("NATIVE_FILE_SORT_HEADER_MISSING", observedNames)
        set headerGroup to item 1 of headerGroups
        if (count of UI elements of headerGroup) is less than 1 then return my failAndClose("NATIVE_FILE_SORT_HEADER_MISSING", observedNames)
        set nameSortButton to UI element 1 of headerGroup
        if role of nameSortButton is not "AXButton" then return my failAndClose("NATIVE_FILE_SORT_CONTROL_MISSING", observedNames)
        perform action "AXPress" of nameSortButton

        set firstRowSorted to false
        repeat with pollIndex from 1 to 30
          try
            set firstCell to UI element 1 of row 2 of fileOutline
            set firstNameField to UI element 2 of firstCell
            if (value of firstNameField as text) is (item 1 of expectedNames as text) then
              set firstRowSorted to true
              exit repeat
            end if
          end try
          delay 0.1
        end repeat
        if firstRowSorted is false then return my failAndClose("NATIVE_FILE_SORT_DID_NOT_NORMALIZE", observedNames)

        set observedNames to {}
        repeat with rowIndex from 2 to count of rows of fileOutline
          set fileCell to UI element 1 of row rowIndex of fileOutline
          set fileNameField to UI element 2 of fileCell
          set end of observedNames to (value of fileNameField as text)
        end repeat
        repeat with nameIndex from 1 to expectedCount
          if (item nameIndex of observedNames as text) is not (item nameIndex of expectedNames as text) then
            return my failAndClose("NATIVE_FILE_SORTED_LIST_MISMATCH", observedNames)
          end if
        end repeat
      end if
`;

const PICKER_SELECTION_SCRIPT = `
      try
        set selected of row 2 of fileOutline to true
        set focused of fileOutline to true
      on error
        return my failAndClose("NATIVE_FILE_LIST_NOT_FOCUSED", observedNames)
      end try
      keystroke "a" using command down

      set exactSelectionReady to false
      repeat with pollIndex from 1 to 30
        try
          set selectedRows to every row of fileOutline whose selected is true
          if (count of selectedRows) is expectedCount then
            set exactSelectionReady to true
            exit repeat
          end if
        end try
        delay 0.1
      end repeat
      if exactSelectionReady is false then return my failAndClose("NATIVE_SELECTION_UNPROVEN", observedNames)

      set openButton to missing value
      set openButtonCount to 0
      repeat with elementIndex from 1 to count of UI elements of mainSplitGroup
        set candidate to UI element elementIndex of mainSplitGroup
        try
          if role of candidate is "AXButton" then
            set candidateName to name of candidate as text
            if candidateName is "Open" or candidateName is "打开" then
              set openButton to candidate
              set openButtonCount to openButtonCount + 1
            end if
          end if
        end try
      end repeat
      if openButtonCount is not 1 then return my failAndClose("NATIVE_OPEN_BUTTON_AMBIGUOUS", observedNames)

      set openReady to false
      repeat with pollIndex from 1 to 30
        try
          if enabled of openButton is true then
            set openReady to true
            exit repeat
          end if
        end try
        delay 0.1
      end repeat
      if openReady is false then return my failAndClose("NATIVE_OPEN_BUTTON_DISABLED", observedNames)

      perform action "AXPress" of openButton

      set pickerClosed to false
      repeat with pollIndex from 1 to 100
        if (count of sheets of window 1) is 0 then
          set pickerClosed to true
          exit repeat
        end if
        delay 0.1
      end repeat
      if pickerClosed is false then return my failAndClose("NATIVE_PICKER_DID_NOT_CLOSE", observedNames)
    end tell
  end tell
end timeout

set AppleScript's text item delimiters to linefeed
return "SUCCESS" & linefeed & (observedNames as text)
`;

const buildNativePickerScript = (input: {
  stagingDirectoryPath: string;
  expectedFileNames: readonly string[];
  windowIdentity: NativePickerWindowIdentity;
}): string => [
  PICKER_FAILURE_HANDLER,
  buildPickerInputContract(input),
  PICKER_NAVIGATION_SCRIPT,
  PICKER_ORDER_NORMALIZATION_SCRIPT,
  PICKER_SELECTION_SCRIPT,
].join("\n");

const buildNativePickerCleanupScript = (): string => `
with timeout of 3 seconds
  tell application "System Events"
    tell process "Google Chrome"
      if (count of windows) is greater than 0 then
        if (count of sheets of window 1) is 1 then key code 53
      end if
    end tell
  end tell
end timeout
return "CLEANED"
`;

const failureResult = (message: string): BrowserNativeMultiFilePickerResult => ({
  ...createCurrentChromeBrowserActionResult({ ok: false, message }),
  observedFileNames: [],
});

export const parseNativeMultiFilePickerOutput = (
  output: string,
): BrowserNativeMultiFilePickerResult => {
  const [status = "FAILED", ...details] = output.trim().split(/\r?\n/u);
  if (status !== "SUCCESS") {
    return failureResult(details.length > 0
      ? details.join("; observed=")
      : "NATIVE_PICKER_UNKNOWN_RESULT");
  }
  const observedFileNames = details;
  return {
    ...createCurrentChromeBrowserActionResult({
      message: `selected ${observedFileNames.length} approved files through the native picker`,
    }),
    observedFileNames,
  };
};

const closeOrphanedNativePicker = async (): Promise<void> => {
  await runAppleScript(buildNativePickerCleanupScript(), {
    signal: AbortSignal.timeout(NATIVE_PICKER_CLEANUP_TIMEOUT_MS),
  }).catch(() => undefined);
};

export const runNativeMultiFilePickerSelection = async (
  input: NativePickerInput,
  windowIdentity: NativePickerWindowIdentity,
): Promise<BrowserNativeMultiFilePickerResult> => {
  if (input.expectedFileNames.length < 2) {
    return failureResult("NATIVE_MULTI_FILE_PICKER_REQUIRES_MULTIPLE_FILES");
  }
  if (new Set(input.expectedFileNames).size !== input.expectedFileNames.length) {
    return failureResult("NATIVE_MULTI_FILE_PICKER_DUPLICATE_FILE_NAMES");
  }
  const processTimeout = AbortSignal.timeout(NATIVE_PICKER_PROCESS_TIMEOUT_MS);
  const signal = input.abortSignal
    ? AbortSignal.any([input.abortSignal, processTimeout])
    : processTimeout;
  try {
    const output = await runAppleScript(
      buildNativePickerScript({
        stagingDirectoryPath: input.stagingDirectoryPath,
        expectedFileNames: input.expectedFileNames,
        windowIdentity,
      }),
      { signal },
    );
    return parseNativeMultiFilePickerOutput(output);
  } catch (error) {
    await closeOrphanedNativePicker();
    if (input.abortSignal?.aborted) {
      return failureResult("NATIVE_PICKER_ABORTED");
    }
    if (processTimeout.aborted) {
      return failureResult("NATIVE_PICKER_TIMEOUT");
    }
    const message = error instanceof Error ? error.message : String(error);
    return failureResult(
      `NATIVE_PICKER_AUTOMATION_FAILED:${message.replace(/\s+/gu, " ").slice(0, 500)}`,
    );
  }
};

const readFocusedChromeWindowIdentity = async (abortSignal?: AbortSignal): Promise<NativePickerWindowIdentity> => {
  const raw = await runAppleScript(`tell application "Google Chrome"
if (count of windows) is 0 then error "Chrome window unavailable"
set p to position of front window
set s to size of front window
return (item 1 of p as string) & "," & (item 2 of p as string) & "," & (item 1 of s as string) & "," & (item 2 of s as string)
end tell`, abortSignal ? { signal: abortSignal } : undefined);
  const [windowX, windowY, width, height] = raw.split(",").map((value) => Number(value));
  if (![windowX, windowY, width, height].every(Number.isFinite)) throw new Error("focused Chrome window identity is invalid");
  return { windowX: windowX!, windowY: windowY!, width: width!, height: height! };
};

export const selectCurrentChromeNativePickerFiles = async (
  input: NativePickerInput,
): Promise<{ ok: boolean; message: string; observedFileNames: string[] }> => {
  const identity = await readFocusedChromeWindowIdentity(input.abortSignal);
  const result = await runNativeMultiFilePickerSelection(input, identity);
  return { ok: result.ok, message: result.message, observedFileNames: result.observedFileNames };
};

export const pasteCurrentChromeFileFromSystemClipboard = async (
  filePath: string,
  abortSignal?: AbortSignal,
): Promise<void> => {
  const script = [
    `set targetFile to POSIX file "${escapeAppleScriptText(filePath)}" as alias`,
    "set the clipboard to {targetFile}",
    'tell application "System Events"',
    '  tell process "Google Chrome"',
    '    if frontmost is false then error "OPERATOR_INTERRUPTED: Chrome lost focus before clipboard paste"',
    '    keystroke "v" using command down',
    "  end tell",
    "end tell",
  ].join("\n");
  await runAppleScript(script, abortSignal ? { signal: abortSignal } : undefined);
};
