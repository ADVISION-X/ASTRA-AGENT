import type {
  BrowserCapabilityId,
  BrowserWireCommand,
} from "./browser-protocol.js";

const COMMAND_CAPABILITY_IDS: Readonly<
  Record<Exclude<BrowserWireCommand["kind"], "observe_capability">, BrowserCapabilityId>
> = {
  acquire_target: "target.acquire.v1",
  inspect_target: "target.inspect.v1",
  navigate_target: "target.navigate.v1",
  click_target: "input.pointer.v1",
  move_target: "input.pointer.v1",
  scroll_target: "input.scroll.v1",
  click_dom_target: "dom.click.v1",
  fill_dom_target: "dom.fill.v1",
  text_target: "input.text.v1",
  screenshot_target: "page.screenshot.v1",
  stage_file_artifact_chunk: "file.artifact-chunk.v1",
  set_file_input_artifact: "file.set-input.v1",
  release_target: "target.release.v1",
  close_target: "target.close.v1",
};

export const capabilityIdForCommand = (
  command: BrowserWireCommand,
): BrowserCapabilityId =>
  command.kind === "observe_capability"
    ? command.capabilityId
    : COMMAND_CAPABILITY_IDS[command.kind];
