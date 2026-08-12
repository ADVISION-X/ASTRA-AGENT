import {
  enqueueXuanyuanTask,
  XuanyuanRequestSchema,
  type XuanyuanTaskCoordinator,
} from "../plugins/xuanyuan/index.js";

export const runXuanyuanRoute = (
  rawInput: unknown,
  coordinator: XuanyuanTaskCoordinator,
) => enqueueXuanyuanTask(
  coordinator,
  XuanyuanRequestSchema.parse(rawInput),
);
