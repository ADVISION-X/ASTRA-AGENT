import type { GptChildHandlerMap } from "../child-handler.js";
import { imageResponseChildHandlers } from "./image-response-children.js";
import { textResponseChildHandlers } from "./text-response-children.js";

export const responseChildHandlers = Object.freeze({
  ...textResponseChildHandlers,
  ...imageResponseChildHandlers,
}) satisfies GptChildHandlerMap;
