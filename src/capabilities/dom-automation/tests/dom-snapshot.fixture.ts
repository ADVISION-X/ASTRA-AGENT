import type { DomSnapshot } from "../schema.js";

const DOM_SNAPSHOT_FORMS: DomSnapshot["forms"] = [{
  selectorCandidate: "form[data-testid='task-form']",
  id: "task-form",
  labelText: "Task form",
  inputCount: 2,
  buttonCount: 1,
}];

const DOM_SNAPSHOT_INPUTS: DomSnapshot["inputs"] = [{
  tagName: "input",
  type: "search",
  ariaLabel: "Search records",
  labelText: "Search",
  placeholder: "Search",
  disabled: false,
  hidden: false,
  selectorCandidate: "input[type='search']",
  formId: "task-form",
  testId: "search-input",
}];

const DOM_SNAPSHOT_BUTTONS: DomSnapshot["buttons"] = [{
  tagName: "button",
  role: "button",
  ariaLabel: "Search",
  visibleText: "Search",
  disabled: false,
  hidden: false,
  selectorCandidate: "button[data-testid='search-button']",
  formId: "task-form",
  testId: "search-button",
}];

const DOM_SNAPSHOT_FILE_INPUTS: DomSnapshot["fileInputs"] = [{
  tagName: "input",
  type: "file",
  labelText: "Upload file",
  disabled: false,
  hidden: false,
  selectorCandidate: "input[type='file']",
  formId: "task-form",
  testId: "file-input",
  accept: ".pdf",
}];

export const DOM_SNAPSHOT_FIXTURE: DomSnapshot = {
  url: "https://local.example.test/form",
  title: "Local DOM fixture",
  forms: DOM_SNAPSHOT_FORMS,
  inputs: DOM_SNAPSHOT_INPUTS,
  buttons: DOM_SNAPSHOT_BUTTONS,
  links: [],
  fileInputs: DOM_SNAPSHOT_FILE_INPUTS,
  dialogs: [],
  frames: [],
  textBlocks: [],
  tableRows: [],
  roleRows: [],
  genericClickableElements: [],
  detectedStates: [],
  capturedAt: "2026-05-20T00:00:00.000Z",
};
