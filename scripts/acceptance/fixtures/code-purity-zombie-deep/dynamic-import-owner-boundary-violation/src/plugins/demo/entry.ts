export const run = async (): Promise<void> => {
  await import("../../capabilities/widget/runtime/private.ts");
};

void run();