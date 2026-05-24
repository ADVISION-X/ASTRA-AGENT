export const run = async (): Promise<void> => {
  await import("../../capabilities/widget/runtime/private.js");
};

void run();